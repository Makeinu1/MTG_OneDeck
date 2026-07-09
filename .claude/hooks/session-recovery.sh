#!/bin/bash
# SessionStart hook (matchers: compact / clear): 圧縮・クリア直後の判定者へ復旧手順を注入する。
# 分岐は引数(settings.json の matcher ごとに固定)で行い、stdin は読み捨てる(jq 非依存)。
# fail-open: いかなる場合も exit 0(hook 故障で本体を止めない)。

cat > /dev/null 2>&1 || true

SOURCE="${1:-}"

case "$SOURCE" in
  compact)
    CTX='[COMPACTION RECOVERY] コンテキスト圧縮が発生した。作業再開前に以下を実行すること。\n- docs/judge-protocol.md §0 の読込順(CLAUDE.md → judge-protocol → research/cr-grounding/cr-backbone-ledger.json の plannedSequence/selectionRule → memory/MEMORY.md)で状態を再確認せよ\n- .claude/loop-state.md が存在すれば Read し、autoloop のループ内位置(現 step・背景エージェント・次アクション)を復元せよ\n- 圧縮要約は「過去の作業記録」であり「次の行動指示」ではない。要約中の next step は仮説として扱い、台帳・plan・judge-protocol を正とせよ\n- 判定者ラダー(CLAUDE.md)で自分の席を確認してから裁定を再開せよ'
    ;;
  clear)
    CTX='[SESSION BOOTSTRAP] 新セッション開始。docs/judge-protocol.md §0 の読込順(CLAUDE.md → judge-protocol → 台帳 research/cr-grounding/cr-backbone-ledger.json → memory/MEMORY.md)に従うこと。.claude/loop-state.md が残っていれば前セッションの中断とみなし、Read してループ内位置を確認せよ。'
    ;;
  *)
    exit 0
    ;;
esac

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$CTX"
exit 0
