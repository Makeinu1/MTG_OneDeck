import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readFileSync, readSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TOKEN_FIELDS = [
  ['input_tokens', 'inputTokens'],
  ['cached_input_tokens', 'cachedInputTokens'],
  ['output_tokens', 'outputTokens'],
  ['reasoning_output_tokens', 'reasoningOutputTokens'],
];

const isObject = (value) => value !== null && typeof value === 'object';
const numberOrZero = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const recordTimestamp = (record) => {
  const raw = record?.timestamp ?? record?.payload?.timestamp;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const value = typeof raw === 'number' ? raw : Date.parse(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const elapsedFromRecords = (records) => {
  const timestamps = records.map(recordTimestamp).filter((value) => value !== null);
  if (timestamps.length < 2) return null;
  return Math.max(...timestamps) - Math.min(...timestamps);
};

const availability = (available, source, error) => ({
  available,
  source,
  ...(error ? { error } : {}),
});

const sessionMetaId = (record) =>
  record?.type === 'session_meta' && typeof record.payload?.id === 'string'
    ? record.payload.id
    : undefined;

const parentIdFromSource = (source) => {
  if (!isObject(source)) return undefined;
  const value = source.subagent?.thread_spawn?.parent_thread_id;
  return typeof value === 'string' ? value : undefined;
};

const sourceKind = (source) => {
  if (typeof source === 'string') return source;
  if (!isObject(source)) return 'unknown';
  if (isObject(source.subagent)) return 'subagent';
  return Object.keys(source).sort()[0] ?? 'unknown';
};

const findIsolationBoundary = (records, currentSessionId) => {
  const foreignMetaIndexes = records.flatMap((record, index) => {
    const id = sessionMetaId(record);
    return id && id !== currentSessionId ? [index] : [];
  });
  if (foreignMetaIndexes.length === 0) {
    return {
      index: records.findIndex((record) => sessionMetaId(record) === currentSessionId),
      inheritedContext: false,
      strategy: 'all-last-token-usage-after-current-session-meta',
      confidence: 'high',
    };
  }

  const lastForeignMeta = Math.max(...foreignMetaIndexes);
  let boundary = lastForeignMeta;
  let bootstrapStarted = false;
  for (let index = lastForeignMeta + 1; index < records.length; index += 1) {
    const record = records[index];
    const isTaskBootstrap =
      record?.type === 'event_msg' &&
      (record.payload?.type === 'task_started' ||
        record.payload?.type === 'user_message');
    const isBootstrapMessage =
      record?.type === 'response_item' &&
      record.payload?.type === 'message' &&
      (record.payload?.role === 'developer' || record.payload?.role === 'user');

    if (!bootstrapStarted && (isTaskBootstrap || isBootstrapMessage)) {
      bootstrapStarted = true;
      boundary = index;
      continue;
    }
    if (!bootstrapStarted) continue;
    if (
      isBootstrapMessage ||
      (isTaskBootstrap && index === boundary + 1)
    ) {
      boundary = index;
      continue;
    }
    break;
  }

  return {
    index: boundary,
    inheritedContext: true,
    strategy: 'sum-last-token-usage-after-initial-current-bootstrap',
    confidence: boundary > lastForeignMeta ? 'high' : 'medium',
  };
};

const countNestedToolCalls = (input) => {
  if (typeof input !== 'string') return 0;
  return [...input.matchAll(/\btools\.[A-Za-z0-9_$]+\s*\(/g)].length;
};

const decodeJavaScriptString = (literal) => {
  if (literal.startsWith('"')) {
    try {
      return JSON.parse(literal);
    } catch {
      return null;
    }
  }
  if (literal.startsWith('`') && literal.includes('${')) return null;
  return literal
    .slice(1, -1)
    .replace(/\\([\\'"`])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
};

const nestedExecCommands = (input) => {
  if (typeof input !== 'string') return [];
  const commandPattern =
    /\btools\.exec_command\s*\(\s*\{[\s\S]*?\bcmd\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
  return [...input.matchAll(commandPattern)]
    .map((match) => decodeJavaScriptString(match[1]))
    .filter((command) => typeof command === 'string');
};

const functionArguments = (record) => {
  if (record?.type !== 'response_item' || record.payload?.type !== 'function_call') {
    return null;
  }
  const args = record.payload.arguments;
  if (isObject(args)) return args;
  if (typeof args !== 'string') return null;
  try {
    const parsed = JSON.parse(args);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const directExecCommand = (record) => {
  if (record?.payload?.name !== 'exec_command') return null;
  const args = functionArguments(record);
  return typeof args?.cmd === 'string' ? args.cmd : null;
};

const countFullCheckCommands = (command) => {
  if (typeof command !== 'string') return 0;
  const invocationPattern =
    /(?:^|&&|\|\||;|\n)\s*(?:[A-Za-z_][A-Za-z0-9_]*=[^\s;&|]+\s+)*npm\s+run\s+check(?!:)(?=\s|$)/g;
  return [...command.matchAll(invocationPattern)].length;
};

const isPotentialFullCheckCommand = (command) => {
  if (countFullCheckCommands(command) > 0) return true;
  if (typeof command !== 'string') return false;
  return /(?:^|\s)(?:\/bin\/)?(?:ba|z)?sh\s+(?:-[A-Za-z]+\s+)*(?:"[^"\n]*\bnpm\s+run\s+check(?!:)(?=\s|[";]|$)[^"\n]*"|'[^'\n]*\bnpm\s+run\s+check(?!:)(?=\s|[';]|$)[^'\n]*')/.test(
    command,
  );
};

const collectOutputStrings = (value, depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const strings = [value];
    if (depth < 4 && /^[\s]*[\[{]/.test(value)) {
      try {
        strings.push(...collectOutputStrings(JSON.parse(value), depth + 1));
      } catch {
        // Ordinary output text is not JSON.
      }
    }
    return strings;
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectOutputStrings(item, depth + 1));
  }
  if (!isObject(value)) return [];
  return Object.values(value).flatMap((item) => collectOutputStrings(item, depth + 1));
};

const countObservedFullCheckStarts = (value) =>
  collectOutputStrings(value).reduce(
    (total, output) =>
      total +
      [...output.matchAll(/(?:^|\n)> [^\r\n]+ check\r?\n> node scripts\/checks\/machine-checks\.mjs(?:\r?\n|$)/g)]
        .length,
    0,
  );

const runningCellIds = (value) => {
  const ids = new Set();
  for (const output of collectOutputStrings(value)) {
    for (const match of output.matchAll(/Script running with cell ID ([0-9]+)/g)) {
      ids.add(match[1]);
    }
  }
  return [...ids];
};

export function analyzeSessionRecords(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const firstMeta = records.find((record) => sessionMetaId(record));
  if (!firstMeta) throw new Error('Session has no session_meta record');

  const sessionId = firstMeta.payload.id;
  const parentSessionId = parentIdFromSource(firstMeta.payload.source);
  const isolation = findIsolationBoundary(records, sessionId);
  const currentRecords = records.slice(Math.max(0, isolation.index + 1));
  const usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    uncachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  };
  let modelCycles = 0;

  for (const record of currentRecords) {
    if (record?.type !== 'event_msg' || record.payload?.type !== 'token_count') {
      continue;
    }
    const lastUsage = record.payload?.info?.last_token_usage;
    if (!isObject(lastUsage)) continue;
    modelCycles += 1;
    for (const [source, target] of TOKEN_FIELDS) {
      usage[target] += numberOrZero(lastUsage[source]);
    }
  }
  usage.uncachedInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens,
  );

  const execInputs = currentRecords.flatMap((record) =>
    record?.type === 'response_item' &&
    record.payload?.type === 'custom_tool_call' &&
    record.payload?.name === 'exec'
      ? [record.payload.input]
      : [],
  );
  const pendingByCallId = new Map();
  const pendingByCellId = new Map();
  let fullCheckInvocations = 0;
  for (const record of currentRecords) {
    if (record?.type !== 'response_item') continue;
    const callId = record.payload?.call_id;
    let candidates = 0;
    if (
      record.payload?.type === 'custom_tool_call' &&
      record.payload?.name === 'exec'
    ) {
      candidates = nestedExecCommands(record.payload.input).filter(
        isPotentialFullCheckCommand,
      ).length;
    }
    if (
      record.payload?.type === 'function_call' &&
      record.payload?.name === 'exec_command' &&
      isPotentialFullCheckCommand(directExecCommand(record))
    ) {
      candidates = 1;
    }
    if (
      record.payload?.type === 'function_call' &&
      record.payload?.name === 'wait'
    ) {
      const cellId = functionArguments(record)?.cell_id;
      const cellKey = typeof cellId === 'string' ? cellId : String(cellId ?? '');
      if (pendingByCellId.has(cellKey)) {
        candidates = pendingByCellId.get(cellKey);
        pendingByCellId.delete(cellKey);
      }
    }
    if (candidates > 0 && typeof callId === 'string') {
      pendingByCallId.set(callId, candidates);
    }
    if (
      record.payload?.type === 'custom_tool_call_output' ||
      record.payload?.type === 'function_call_output'
    ) {
      const pending =
        typeof callId === 'string' ? (pendingByCallId.get(callId) ?? 0) : 0;
      if (typeof callId === 'string') pendingByCallId.delete(callId);
      const observedStarts = countObservedFullCheckStarts(record.payload.output);
      const attributable = Math.min(observedStarts, pending);
      fullCheckInvocations += attributable;
      const remaining = pending - attributable;
      if (remaining > 0) {
        const [cellId] = runningCellIds(record.payload.output);
        if (cellId) {
          pendingByCellId.set(
            cellId,
            (pendingByCellId.get(cellId) ?? 0) + remaining,
          );
        }
      }
    }
  }
  const turnContext = [...records]
    .reverse()
    .find((record) => record?.type === 'turn_context')?.payload;
  const lineageIds = [
    sessionId,
    parentSessionId,
    ...records.map(sessionMetaId),
  ].filter((id, index, values) => typeof id === 'string' && values.indexOf(id) === index);
  const elapsedMs = elapsedFromRecords(currentRecords);
  const tokenUsageAvailable = modelCycles > 0;
  const terminalUsage = {
    cachedInputTokens: tokenUsageAvailable ? usage.cachedInputTokens : null,
    uncachedInputTokens: tokenUsageAvailable ? usage.uncachedInputTokens : null,
    modelCycles,
    compactions: currentRecords.filter(
      (record) =>
        record?.type === 'compacted' ||
        (record?.type === 'event_msg' && record.payload?.type === 'context_compacted'),
    ).length,
    repairWaves: null,
    fullChecks: fullCheckInvocations,
    ciRuns: null,
    elapsedMs,
  };
  const terminalUsageAvailability = {
    cachedInputTokens: availability(
      tokenUsageAvailable,
      tokenUsageAvailable ? 'token_count.last_token_usage.cached_input_tokens' : 'platform-unavailable',
      tokenUsageAvailable ? undefined : 'no current token_count records',
    ),
    uncachedInputTokens: availability(
      tokenUsageAvailable,
      tokenUsageAvailable ? 'input_tokens-minus-cached_input_tokens' : 'platform-unavailable',
      tokenUsageAvailable ? undefined : 'no current token_count records',
    ),
    modelCycles: availability(true, 'token_count-record-count'),
    compactions: availability(true, 'compaction-record-count'),
    repairWaves: availability(
      false,
      'platform-unavailable',
      'session records have no authoritative repair-wave event',
    ),
    fullChecks: availability(true, 'call-scoped-observed-machine-check-start'),
    ciRuns: availability(
      false,
      'platform-unavailable',
      'tool calls do not establish a unique completed CI run',
    ),
    elapsedMs: availability(
      elapsedMs !== null,
      elapsedMs !== null ? 'first-to-last-current-record-timestamp' : 'platform-unavailable',
      elapsedMs === null ? 'fewer than two current records have timestamps' : undefined,
    ),
  };

  return {
    sessionId,
    model:
      turnContext?.model ?? turnContext?.collaboration_mode?.settings?.model ?? 'unknown',
    effort:
      turnContext?.effort ??
      turnContext?.reasoning_effort ??
      turnContext?.collaboration_mode?.settings?.reasoning_effort ??
      'unknown',
    sourceKind: sourceKind(firstMeta.payload.source),
    parentSessionId: parentSessionId ?? null,
    inheritedContext: isolation.inheritedContext,
    lineageIds,
    deduplication: {
      strategy: isolation.strategy,
      confidence: isolation.confidence,
    },
    sourceFile: options.filePath ? basename(options.filePath) : null,
    usage,
    modelCycles,
    compactions: currentRecords.filter(
      (record) =>
        record?.type === 'compacted' ||
        (record?.type === 'event_msg' && record.payload?.type === 'context_compacted'),
    ).length,
    execCells: execInputs.length,
    parallelExecCells: execInputs.filter(
      (input) =>
        typeof input === 'string' &&
        /\bPromise\.(?:all|allSettled)\s*\(/.test(input) &&
        countNestedToolCalls(input) > 1,
    ).length,
    nestedToolCalls: execInputs.reduce(
      (total, input) => total + countNestedToolCalls(input),
      0,
    ),
    directFunctionCalls: currentRecords.filter(
      (record) =>
        record?.type === 'response_item' && record.payload?.type === 'function_call',
    ).length,
    fullCheckInvocations,
    fullCheckDetection: {
      strategy: 'call-scoped-observed-machine-check-start',
      confidence: 'high',
      caveat: 'output-suppressed or dynamically-built invocations are not observable',
    },
    terminalUsage,
    terminalUsageAvailability,
  };
}

const percentDelta = (control, treatment) => {
  if (control === 0) return treatment === 0 ? 0 : null;
  return Number((((treatment - control) / control) * 100).toFixed(2));
};

export function compareUsageReports(control, treatment) {
  const metricPairs = {
    inputTokens: [control.usage?.inputTokens, treatment.usage?.inputTokens],
    cachedInputTokens: [
      control.usage?.cachedInputTokens,
      treatment.usage?.cachedInputTokens,
    ],
    uncachedInputTokens: [
      control.usage?.uncachedInputTokens,
      treatment.usage?.uncachedInputTokens,
    ],
    outputTokens: [control.usage?.outputTokens, treatment.usage?.outputTokens],
    reasoningOutputTokens: [
      control.usage?.reasoningOutputTokens,
      treatment.usage?.reasoningOutputTokens,
    ],
    modelCycles: [control.modelCycles, treatment.modelCycles],
    compactions: [control.compactions, treatment.compactions],
    execCells: [control.execCells, treatment.execCells],
    parallelExecCells: [control.parallelExecCells, treatment.parallelExecCells],
    nestedToolCalls: [control.nestedToolCalls, treatment.nestedToolCalls],
    directFunctionCalls: [
      control.directFunctionCalls,
      treatment.directFunctionCalls,
    ],
    fullCheckInvocations: [
      control.fullCheckInvocations,
      treatment.fullCheckInvocations,
    ],
  };
  const percentageDeltas = Object.fromEntries(
    Object.entries(metricPairs).map(([key, [before, after]]) => [
      key,
      percentDelta(numberOrZero(before), numberOrZero(after)),
    ]),
  );
  const primary = ['inputTokens', 'uncachedInputTokens', 'modelCycles'].map(
    (key) => percentageDeltas[key],
  );
  const comparable = primary.filter((value) => value !== null);
  const efficiencySignal =
    comparable.some((value) => value < 0) && comparable.every((value) => value <= 0)
      ? 'positive'
      : comparable.some((value) => value > 0) && comparable.every((value) => value >= 0)
        ? 'negative'
        : 'mixed';

  return {
    controlSessionId: control.sessionId ?? null,
    treatmentSessionId: treatment.sessionId ?? null,
    percentageDeltas,
    efficiencySignal,
    qualityGate: 'external',
  };
}

const readJsonLines = (filePath) =>
  readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSONL at record ${index + 1}`);
      }
    });

const collectJsonlFiles = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
    }
  };
  visit(root);
  return files;
};

export function findSessionFile(sessionId, sessionsRoot) {
  return locateSessionFile(sessionId, sessionsRoot).filePath;
}

function parseReceiptRecords(content) {
  return content
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSONL at receipt record ${index + 1}`);
      }
    });
}

function firstSessionMetaRecord(content) {
  let offset = 0;
  while (offset < content.length) {
    const newline = content.indexOf(0x0a, offset);
    const end = newline < 0 ? content.length : newline;
    const line = content.subarray(offset, end).toString('utf8').trim();
    if (line !== '') {
      try {
        const record = JSON.parse(line);
        if (sessionMetaId(record)) return record;
      } catch {
        throw new Error('Invalid JSONL before session metadata');
      }
    }
    if (newline < 0) break;
    offset = newline + 1;
  }
  return null;
}

const receiptPrefixCache = new Map();

function cachedReceiptPrefix(filePath, content) {
  const byteLength = content.length;
  const prefixSha256 = createHash('sha256').update(content).digest('hex');
  const cache = receiptPrefixCache.get(filePath) ?? new Map();
  const exact = cache.get(byteLength);
  if (exact?.prefixSha256 === prefixSha256) {
    return { prefixSha256, records: exact.records, report: exact.report };
  }

  let records;
  const smallerLengths = [...cache.keys()]
    .filter((length) => length < byteLength)
    .sort((left, right) => right - left);
  const predecessorLength = smallerLengths[0];
  const predecessor = predecessorLength === undefined ? null : cache.get(predecessorLength);
  if (
    predecessor &&
    createHash('sha256').update(content.subarray(0, predecessorLength)).digest('hex') ===
      predecessor.prefixSha256
  ) {
    records = predecessor.records.concat(parseReceiptRecords(content.subarray(predecessorLength)));
  } else {
    records = parseReceiptRecords(content);
  }
  cache.set(byteLength, { prefixSha256, records, report: null });
  receiptPrefixCache.set(filePath, cache);
  return { prefixSha256, records, report: null };
}

function readExactPrefix(filePath, length) {
  const descriptor = openSync(filePath, 'r');
  try {
    const initialSize = fstatSync(descriptor).size;
    if (length > initialSize) return { content: null, currentByteLength: initialSize };
    const content = Buffer.allocUnsafe(length);
    let offset = 0;
    while (offset < length) {
      const bytesRead = readSync(descriptor, content, offset, length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const currentByteLength = fstatSync(descriptor).size;
    if (offset !== length || currentByteLength < length) {
      throw new Error(`Short session receipt read: ${filePath}`);
    }
    return { content, currentByteLength };
  } finally {
    closeSync(descriptor);
  }
}

function locateSessionFile(sessionId, sessionsRoot, byteLength) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(sessionId)) throw new Error('Session id must be an exact UUID');
  const matches = [];
  for (const filePath of collectJsonlFiles(sessionsRoot)) {
    if (!basename(filePath).includes(sessionId)) continue;
    const loaded = byteLength === undefined
      ? { content: readFileSync(filePath), currentByteLength: null }
      : readExactPrefix(filePath, byteLength);
    if (loaded.content === null) continue;
    if (
      byteLength !== undefined &&
      byteLength < loaded.currentByteLength &&
      loaded.content[byteLength - 1] !== 0x0a
    ) {
      throw new Error(`Session receipt does not end at a JSONL record: ${sessionId}`);
    }
    const firstMeta = byteLength === undefined
      ? parseReceiptRecords(loaded.content).find((record) => sessionMetaId(record))
      : firstSessionMetaRecord(loaded.content);
    if (firstMeta?.payload?.id === sessionId) matches.push({ filePath, ...loaded });
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Session not found: ${sessionId}`
        : `Session id is not unique: ${sessionId}`,
    );
  }
  return matches[0];
}

export function readSessionUsageReceipt(sessionId, sessionsRoot, byteLength) {
  if (byteLength !== undefined && (!Number.isSafeInteger(byteLength) || byteLength <= 0)) {
    throw new Error(`Invalid session receipt byte length: ${sessionId}`);
  }
  const located = locateSessionFile(sessionId, sessionsRoot, byteLength);
  const { content: prefix, filePath } = located;
  const length = byteLength ?? prefix.length;
  const currentByteLength = byteLength === undefined ? prefix.length : located.currentByteLength;
  const cached = cachedReceiptPrefix(filePath, prefix);
  const report = cached.report ?? analyzeSessionRecords(cached.records, { filePath });
  receiptPrefixCache.get(filePath).get(length).report = report;
  return {
    filePath,
    byteLength: length,
    currentByteLength,
    prefixSha256: cached.prefixSha256,
    report,
  };
}

const parseArguments = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--session', '--compare', '--sessions-root'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    result[argument.slice(2)] = value;
    index += 1;
  }
  if (!result.session) throw new Error('--session is required');
  return result;
};

export function runUsageCli(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  const sessionsRoot = resolve(
    args['sessions-root'] ?? join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions'),
  );
  const loadReport = (id) => {
    const filePath = findSessionFile(id, sessionsRoot);
    return analyzeSessionRecords(readJsonLines(filePath), { filePath });
  };
  const report = loadReport(args.session);
  const output = args.compare
    ? {
        report,
        comparison: compareUsageReports(loadReport(args.compare), report),
      }
    : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runUsageCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
