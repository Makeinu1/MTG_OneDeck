#!/bin/bash
# SessionStart hook (matchers: compact / clear): 圧縮・クリア直後の判定者へ復旧手順を注入する。
# 分岐は引数(settings.json の matcher ごとに固定)で行い、stdin は読み捨てる(jq 非依存)。
# fail-open: いかなる場合も exit 0(hook 故障で本体を止めない)。

cat > /dev/null 2>&1 || true

SOURCE="${1:-}"

case "$SOURCE" in
  compact)
    CTX='[COMPACTION RECOVERY] 作業再開前にAGENTS.mdの役割を確認し、npm run codex:context -- [--domain <id>]を実行せよ。投影がstale/integrity errorなら進めず、docs/judge-protocol.md §0に従って台帳全文へfallbackする。圧縮要約のnext stepは仮説であり、検証済み投影とloop-stateを正とする。'
    ;;
  clear)
    CTX='[SESSION BOOTSTRAP] AGENTS.md確認後、npm run codex:context -- [--domain <id>]を実行し、docs/judge-protocol.md §0に従え。過去task transcriptを再読せず、stale loop-stateは正本扱いしない。'
    ;;
  *)
    exit 0
    ;;
esac

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$CTX"
exit 0
