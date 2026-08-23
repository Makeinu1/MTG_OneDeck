#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as ts from 'typescript';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_SOURCE_ROOTS = Object.freeze(['src/main.tsx', 'src/online/cloudflare/worker.ts']);
const PAGES_ASSET_DIRECTORY = 'dist/assets';
const FIXED_MARKERS = Object.freeze([
  'src/online/bootstrap/catalog/catalogV1.ts',
  'src/online/bootstrap/fourDeckBootstrapV1.ts',
  'src/online/bootstrap/fixtures/o4p-06a-four-deck-card-catalog-v1.json',
  'o4p-06a-four-deck-card-catalog-v1',
  'O4P06A_CARD_CATALOG_V1',
  'catalogV1',
  'fourDeckBootstrapV1',
  'bootstrapFourDeckGenesisV1',
  'o4p-06a-four-deck-card-catalog-v1.json',
]);
const PAGE_LEGACY_MARKERS = Object.freeze([
  ...FIXED_MARKERS,
  'online-forming-lobby-deck-submit-v1',
  'online-forming-lobby-deck-submitted-v1',
  'online-forming-lobby-ready-v1',
  'online-forming-lobby-start-v1',
  'online-forming-lobby-started-v1',
  'online-forming-lobby-start-with-table-v1',
]);
const WORKER_LEGACY_SUCCESS_MARKERS = Object.freeze([
  ...FIXED_MARKERS,
  'online-forming-lobby-deck-submitted-v1',
  'online-forming-lobby-started-v1',
]);

export type ProductionRuntimeVerificationOptions = Readonly<{
  readonly repositoryRoot?: string;
  readonly pagesDist?: string;
  readonly workerBundle?: string;
  readonly sourceRoots?: readonly string[];
}>;

export type ProductionImportGraph = Readonly<{
  readonly roots: readonly string[];
  readonly files: readonly string[];
}>;

export type ArtifactScan = Readonly<{
  readonly files: readonly string[];
  readonly markers: readonly string[];
}>;

export type ProductionRuntimeVerificationResult = Readonly<{
  readonly graph: ProductionImportGraph;
  readonly pages: ArtifactScan;
  readonly worker: ArtifactScan | null;
}>;

class VerificationFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'O4P07CVerificationFailure';
  }
}

type VerifierScriptElement = Readonly<{
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  closest(selector: string): unknown;
}>;
type VerifierNodeLocation = Readonly<{
  readonly startTag?: Readonly<{
    readonly attrs?: Readonly<Record<string, Readonly<{ readonly startOffset: number; readonly endOffset: number }>>>;
  }>;
}>;
type VerifierDom = Readonly<{
  window: Readonly<{
    document: Readonly<{
      querySelectorAll(selector: string): Iterable<VerifierScriptElement>;
      querySelector(selector: string): unknown;
    }>;
    close(): void;
  }>;
  nodeLocation(node: unknown): VerifierNodeLocation | null | undefined;
}>;
type VerifierDomConstructor = new (
  html: string,
  options: Readonly<{ includeNodeLocations: true; runScripts: 'outside-only'; url: string }>,
) => VerifierDom;

function loadVerifierDomConstructor(): VerifierDomConstructor {
  const moduleValue: unknown = createRequire(import.meta.url)('jsdom');
  if (moduleValue === null || typeof moduleValue !== 'object' || Array.isArray(moduleValue)) fail('unavailable Pages HTML parser');
  const descriptor = Object.getOwnPropertyDescriptor(moduleValue, 'JSDOM');
  const constructorValue: unknown = descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  if (typeof constructorValue !== 'function') fail('unavailable Pages HTML parser');
  return constructorValue as VerifierDomConstructor;
}

const VerifierDomParser = loadVerifierDomConstructor();

function normalizedPath(value: string): string {
  return value.split(sep).join('/');
}

function displayPath(root: string, value: string): string {
  const candidate = relative(root, value);
  return candidate === '' ? '.' : normalizedPath(candidate);
}

function isWithin(root: string, value: string): boolean {
  const canonicalRoot = resolve(root);
  const candidate = resolve(value);
  return candidate === canonicalRoot || candidate.startsWith(`${canonicalRoot}${sep}`);
}

function canonicalRepositoryRoot(input: string): string {
  const lexical = resolve(input);
  let stat;
  try {
    stat = lstatSync(lexical);
  } catch (error: unknown) {
    fail(`unreadable repository root: ${lexical} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!stat.isDirectory()) fail(`repository root is not a directory: ${lexical}`);
  try {
    return realpathSync(lexical);
  } catch (error: unknown) {
    fail(`unreadable repository root: ${lexical} (${error instanceof Error ? error.message : String(error)})`);
  }
}

function canonicalExistingPath(path: string, repositoryRoot: string | undefined, context: string): string {
  const lexical = resolve(path);
  if (repositoryRoot !== undefined && !isWithin(repositoryRoot, lexical)) fail(`${context} outside repository: ${lexical}`);
  let entry;
  try {
    entry = readdirSync(dirname(lexical), { withFileTypes: true }).find((candidate) => candidate.name === basename(lexical));
  } catch (error: unknown) {
    fail(`unreadable ${context}: ${lexical} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (entry === undefined) fail(`missing ${context}: ${lexical}`);
  if (entry.isSymbolicLink()) fail(`symlink ${context}: ${lexical}`);
  if (!entry.isFile()) fail(`${context} is not a file: ${lexical}`);
  let canonical;
  try {
    canonical = realpathSync(lexical);
  } catch (error: unknown) {
    fail(`unreadable ${context}: ${lexical} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (canonical !== lexical) fail(`symlink ${context}: ${lexical}`);
  if (repositoryRoot !== undefined && !isWithin(repositoryRoot, canonical)) fail(`${context} outside repository: ${canonical}`);
  return canonical;
}

function fail(message: string): never {
  throw new VerificationFailure(message);
}

function readRequired(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error: unknown) {
    fail(`unreadable file: ${path} (${error instanceof Error ? error.message : String(error)})`);
  }
}

function sourceCandidates(basePath: string): readonly string[] {
  return Object.freeze([
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.json`,
    `${basePath}.css`,
    resolve(basePath, 'index.ts'),
    resolve(basePath, 'index.tsx'),
    resolve(basePath, 'index.js'),
    resolve(basePath, 'index.jsx'),
    resolve(basePath, 'index.mjs'),
    resolve(basePath, 'index.css'),
  ]);
}

export function resolveProductionRelativeImport(filePath: string, specifier: string, repositoryRoot?: string): string {
  if (!specifier.startsWith('.')) fail(`unsupported relative import: ${specifier} from ${filePath}`);
  const basePath = resolve(dirname(filePath), specifier);
  const candidates = extname(basePath) === '' ? sourceCandidates(basePath) : [basePath];
  const matches = candidates.filter((candidate) => {
    try {
      const entry = readdirSync(dirname(candidate), { withFileTypes: true }).find((current) => current.name === basename(candidate));
      return entry?.isFile() === true;
    } catch {
      return false;
    }
  });
  const unique = [...new Set(matches)];
  if (unique.length === 0) fail(`unresolved relative import: ${specifier} from ${filePath}`);
  if (extname(basePath) === '') {
    const moduleMatches = unique.filter((candidate) => extname(candidate) === '' || /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/i.test(candidate));
    if (moduleMatches.length === 0) fail(`unresolved relative import: ${specifier} from ${filePath}`);
    if (moduleMatches.length !== 1) fail(`ambiguous relative import: ${specifier} from ${filePath} -> ${moduleMatches.join(', ')}`);
    return canonicalExistingPath(moduleMatches[0], repositoryRoot, 'production import');
  }
  if (unique.length !== 1) fail(`ambiguous relative import: ${specifier} from ${filePath} -> ${unique.join(', ')}`);
  return canonicalExistingPath(unique[0], repositoryRoot, 'production import');
}

function scriptKind(path: string): ts.ScriptKind {
  const extension = extname(path).toLowerCase();
  if (extension === '.tsx' || extension === '.jsx') return ts.ScriptKind.TSX;
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function isValueImportDeclaration(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (clause === undefined || clause.isTypeOnly) return clause === undefined;
  if (clause.name !== undefined) return true;
  if (clause.namedBindings === undefined) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function addStaticValueImport(specifiers: Set<string>, node: ts.Node, context: string): void {
  if (!ts.isStringLiteralLike(node)) fail(`unsupported ${context} specifier in production source`);
  specifiers.add(node.text);
}

function isImportMeta(node: ts.Node): boolean {
  return ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta';
}

function isImportMetaLoaderCall(node: ts.CallExpression): boolean {
  const expression = node.expression;
  if (ts.isPropertyAccessExpression(expression)) return isImportMeta(expression.expression);
  return ts.isElementAccessExpression(expression) && isImportMeta(expression.expression);
}

function staticPropertyName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
}

function propertyChain(node: ts.Expression): readonly string[] | null {
  if (ts.isIdentifier(node)) return [node.text];
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null;
  const name = staticPropertyName(node);
  if (name === null) return null;
  const parent = propertyChain(node.expression);
  return parent === null ? null : [...parent, name];
}

function isUnsupportedBrowserCodeLoader(node: ts.Node): boolean {
  if (ts.isNewExpression(node)) {
    const constructor = ts.isIdentifier(node.expression)
      ? node.expression.text
      : ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression)
        ? staticPropertyName(node.expression)
        : null;
    return constructor === 'Worker' || constructor === 'SharedWorker';
  }
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === 'importScripts';
  if (!ts.isPropertyAccessExpression(node.expression) && !ts.isElementAccessExpression(node.expression)) return false;
  const name = staticPropertyName(node.expression);
  if (name === 'Worker' || name === 'SharedWorker' || name === 'importScripts' || name === 'addModule') return true;
  if (name !== 'register') return false;
  const chain = propertyChain(node.expression);
  return chain !== null && chain.slice(-3).join('.') === 'navigator.serviceWorker.register';
}

function valueImportSpecifiers(sourceText: string, filePath: string): readonly string[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind(filePath));
  const specifiers = new Set<string>();
  function visit(node: ts.Node): void {
    if (isUnsupportedBrowserCodeLoader(node)) {
      fail('unsupported browser code loader in production source');
    } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isValueImportDeclaration(node)) addStaticValueImport(specifiers, node.moduleSpecifier, 'import');
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      const namedExports = node.exportClause !== undefined && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : [];
      const valueExport = !node.isTypeOnly && (node.exportClause === undefined || !ts.isNamedExports(node.exportClause) || namedExports.some((element) => !element.isTypeOnly));
      if (valueExport) addStaticValueImport(specifiers, node.moduleSpecifier, 'export');
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (expression === undefined) fail('unsupported import-equals reference in production source');
      addStaticValueImport(specifiers, expression, 'import-equals');
    } else if (ts.isCallExpression(node) && isImportMetaLoaderCall(node)) {
      fail('unsupported import.meta loader call in production source');
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length < 1 || node.arguments.length > 2) fail('unsupported dynamic import arity in production source');
      addStaticValueImport(specifiers, node.arguments[0], 'dynamic import');
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      fail('unsupported require call in production source');
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return Object.freeze([...specifiers]);
}

function assertNoFixedSourceMarker(filePath: string, sourceText: string, root: string): void {
  const normalized = normalizedPath(filePath);
  for (const marker of FIXED_MARKERS) {
    if (normalized.includes(marker) || sourceText.includes(marker)) fail(`forbidden fixed-runtime marker ${marker} in ${displayPath(root, filePath)}`);
  }
}

export function collectProductionValueImportGraph(options: Readonly<{
  readonly repositoryRoot: string;
  readonly sourceRoots: readonly string[];
}>): ProductionImportGraph {
  const root = canonicalRepositoryRoot(options.repositoryRoot);
  const roots = options.sourceRoots.map((entry) => canonicalExistingPath(resolve(root, entry), root, 'production entry'));
  const pending = [...roots];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop() as string;
    if (visited.has(current)) continue;
    if (!existsSync(current)) fail(`missing production entry: ${displayPath(root, current)}`);
    const sourceText = readRequired(current);
    assertNoFixedSourceMarker(current, sourceText, root);
    visited.add(current);
    for (const specifier of valueImportSpecifiers(sourceText, current)) {
      if (specifier.startsWith('.')) pending.push(resolveProductionRelativeImport(current, specifier, root));
      else if (specifier.startsWith('/') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(specifier)) fail(`unsupported absolute import: ${specifier} from ${current}`);
    }
  }
  return Object.freeze({
    roots: Object.freeze(roots.map((entry) => displayPath(root, entry))),
    files: Object.freeze([...visited].sort().map((entry) => displayPath(root, entry))),
  });
}

function assetFiles(root: string): readonly string[] {
  const lexicalRoot = resolve(root);
  let rootStat;
  try {
    rootStat = lstatSync(lexicalRoot);
  } catch {
    fail(`missing artifact directory: ${lexicalRoot}`);
  }
  if (!rootStat.isDirectory()) fail(`artifact root is not a directory: ${lexicalRoot}`);
  let canonicalRoot: string;
  try {
    canonicalRoot = realpathSync(lexicalRoot);
  } catch (error: unknown) {
    fail(`unreadable artifact directory: ${lexicalRoot} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (canonicalRoot !== lexicalRoot) fail(`ambiguous artifact symlink: ${lexicalRoot}`);
  const result: string[] = [];
  const visit = (current: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error: unknown) {
      fail(`unreadable artifact directory: ${current} (${error instanceof Error ? error.message : String(error)})`);
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isSymbolicLink()) fail(`ambiguous artifact symlink: ${path}`);
      if (entry.isDirectory()) {
        let canonicalPath: string;
        try {
          canonicalPath = realpathSync(path);
        } catch (error: unknown) {
          fail(`unreadable artifact directory: ${path} (${error instanceof Error ? error.message : String(error)})`);
        }
        if (canonicalPath !== path || !isWithin(canonicalRoot, canonicalPath)) fail(`ambiguous artifact symlink: ${path}`);
        visit(path);
      }
      else if (entry.isFile()) result.push(path);
      else fail(`unsupported artifact entry: ${path}`);
    }
  };
  visit(root);
  return Object.freeze(result.sort());
}

function scanFiles(root: string, files: readonly string[], markers: readonly string[], predicate: (path: string) => boolean): ArtifactScan {
  const selected = files.filter(predicate);
  if (selected.length === 0) fail(`missing artifact output under ${root}`);
  const found: string[] = [];
  for (const path of selected) {
    const sourceText = readRequired(path);
    if (sourceText.length === 0) fail(`missing artifact output: ${displayPath(root, path)}`);
    for (const marker of markers) if (sourceText.includes(marker)) found.push(`${displayPath(root, path)}:${marker}`);
  }
  if (found.length > 0) fail(`forbidden artifact marker(s): ${found.join(', ')}`);
  return Object.freeze({ files: Object.freeze(selected.map((path) => displayPath(root, path))), markers: Object.freeze([]) });
}

function pagesScriptReferences(pagesDist: string, indexHtml: string): readonly string[] {
  let dom: VerifierDom;
  try {
    dom = new VerifierDomParser(indexHtml, {
      includeNodeLocations: true,
      runScripts: 'outside-only',
      url: 'https://pages-artifact.invalid/',
    });
  } catch (error: unknown) {
    fail(`invalid Pages index.html (${error instanceof Error ? error.message : String(error)})`);
  }
  const references: string[] = [];
  try {
    if (dom.window.document.querySelector('base[href]') !== null) fail('unsupported Pages base element');
    if (dom.window.document.querySelector('noscript') !== null) fail('unsupported Pages noscript element');
    const scripts = [...dom.window.document.querySelectorAll('script')]
      .filter((script) => script.closest('template,noscript') === null);
    for (const script of scripts) {
      if ((script.getAttribute('type') ?? '').trim().toLowerCase() !== 'module' || script.hasAttribute('nomodule')) {
        fail('unsupported Pages script element');
      }
      const raw = script.getAttribute('src');
      if (raw === null || raw.length === 0) fail('missing Pages script source');
      const location = dom.nodeLocation(script);
      const attribute = location?.startTag?.attrs?.src;
      if (attribute === undefined || !Number.isSafeInteger(attribute.startOffset) || !Number.isSafeInteger(attribute.endOffset) || attribute.endOffset <= attribute.startOffset) fail('unlocatable Pages script source');
      const sourceAttribute = indexHtml.slice(attribute.startOffset, attribute.endOffset);
      if (!/^src\s*=\s*(["'])[\s\S]*\1$/i.test(sourceAttribute)) fail(`unquoted Pages script source: ${raw}`);
      if (raw !== raw.trim()) fail(`invalid Pages script source whitespace: ${raw}`);
      if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(raw)) fail(`absolute Pages script source: ${raw}`);
      if (/[%?#\\]/.test(raw)) fail(`invalid Pages script source encoding: ${raw}`);
      if (!raw.startsWith('/')) fail(`Pages script outside assets: ${raw}`);
      const segments = raw.split('/');
      if (segments.some((segment, index) => index > 0 && segment.length === 0) || segments.includes('.') || segments.includes('..')) fail(`invalid Pages script output: ${raw}`);
      let url: URL;
      try {
        url = new URL(raw, 'https://pages-artifact.invalid/');
      } catch {
        fail(`invalid Pages script source: ${raw}`);
      }
      if (url.origin !== 'https://pages-artifact.invalid') fail(`external Pages script source: ${raw}`);
      if (url.pathname !== raw || url.search !== '' || url.hash !== '') fail(`invalid Pages script source: ${raw}`);
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        fail(`invalid encoded Pages script source: ${raw}`);
      }
      const relativePath = pathname.startsWith('/MTG_OneDeck/assets/')
        ? `assets/${pathname.slice('/MTG_OneDeck/assets/'.length)}`
        : pathname.startsWith('/assets/')
          ? `assets/${pathname.slice('/assets/'.length)}`
          : (() => { fail(`Pages script outside assets: ${raw}`); })();
      if (!/\.(?:js|mjs|cjs)$/i.test(relativePath) || relativePath.includes('..')) fail(`invalid Pages script output: ${raw}`);
      const absolutePath = resolve(pagesDist, relativePath);
      const distPrefix = `${resolve(pagesDist)}${sep}`;
      if (!absolutePath.startsWith(distPrefix)) fail(`Pages script escapes output: ${raw}`);
      references.push(absolutePath);
    }
  } finally {
    dom.window.close();
  }
  if (references.length === 0) fail('missing executable Pages module script reference in index.html');
  if (new Set(references).size !== references.length) fail('duplicate Pages script reference in index.html');
  return Object.freeze(references);
}

export function scanBuiltPagesArtifacts(pagesDist: string, repositoryRoot?: string): ArtifactScan {
  const lexicalPagesDist = resolve(pagesDist);
  if (repositoryRoot !== undefined && !isWithin(repositoryRoot, lexicalPagesDist)) fail(`Pages artifact directory outside repository: ${lexicalPagesDist}`);
  const files = assetFiles(lexicalPagesDist);
  const indexPath = resolve(lexicalPagesDist, 'index.html');
  if (!files.includes(indexPath)) fail(`missing Pages index.html under ${lexicalPagesDist}`);
  try {
    if (!lstatSync(resolve(lexicalPagesDist, 'assets')).isDirectory()) fail(`missing Pages asset directory: ${PAGES_ASSET_DIRECTORY}`);
  } catch {
    fail(`missing Pages asset directory: ${PAGES_ASSET_DIRECTORY}`);
  }
  const references = pagesScriptReferences(lexicalPagesDist, readRequired(indexPath));
  for (const reference of references) {
    if (!files.includes(reference)) fail(`missing Pages referenced script: ${displayPath(lexicalPagesDist, reference)}`);
  }
  return scanFiles(lexicalPagesDist, files, PAGE_LEGACY_MARKERS, (path) => /\.(?:js|mjs|cjs)$/i.test(path));
}

export function scanWorkerDryRunBundle(workerBundle: string): ArtifactScan {
  const pathStat = existsSync(workerBundle) ? lstatSync(workerBundle) : null;
  if (pathStat === null) fail(`missing Worker dry-run bundle: ${workerBundle}`);
  if (pathStat.isFile()) {
    const sourceText = readRequired(workerBundle);
    if (sourceText.length === 0) fail(`missing Worker dry-run output: ${workerBundle}`);
    const found = WORKER_LEGACY_SUCCESS_MARKERS.filter((marker) => sourceText.includes(marker));
    if (found.length > 0) fail(`forbidden Worker bundle marker(s): ${found.join(', ')}`);
    return Object.freeze({ files: Object.freeze([workerBundle]), markers: Object.freeze([]) });
  }
  if (!pathStat.isDirectory()) fail(`unsupported Worker dry-run bundle: ${workerBundle}`);
  return scanFiles(workerBundle, assetFiles(workerBundle), WORKER_LEGACY_SUCCESS_MARKERS, () => true);
}

export function verifyO4P07CProductionRuntime(options: ProductionRuntimeVerificationOptions = {}): ProductionRuntimeVerificationResult {
  const root = canonicalRepositoryRoot(options.repositoryRoot ?? repositoryRoot);
  const graph = collectProductionValueImportGraph({
    repositoryRoot: root,
    sourceRoots: options.sourceRoots ?? DEFAULT_SOURCE_ROOTS,
  });
  const pages = scanBuiltPagesArtifacts(resolve(root, options.pagesDist ?? 'dist'), root);
  const worker = options.workerBundle === undefined ? null : scanWorkerDryRunBundle(resolve(root, options.workerBundle));
  return Object.freeze({ graph, pages, worker });
}

function parseArgs(args: readonly string[]): ProductionRuntimeVerificationOptions {
  const options: { pagesDist?: string; workerBundle?: string } = {};
  for (const arg of args) {
    if (arg.startsWith('--pages-dist=')) {
      if (options.pagesDist !== undefined || arg.length === '--pages-dist='.length) fail(`invalid argument: ${arg}`);
      options.pagesDist = arg.slice('--pages-dist='.length);
    } else if (arg.startsWith('--worker-bundle=')) {
      if (options.workerBundle !== undefined || arg.length === '--worker-bundle='.length) fail(`invalid argument: ${arg}`);
      options.workerBundle = arg.slice('--worker-bundle='.length);
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return Object.freeze(options);
}

const isCli = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  try {
    const result = verifyO4P07CProductionRuntime(parseArgs(process.argv.slice(2)));
    assert(result.graph.files.length > 0);
    console.log(`verify:o4p-07c-production-runtime PASS graph=${result.graph.files.length} pages-js=${result.pages.files.length} worker=${result.worker === null ? 'deferred' : result.worker.files.length}`);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
