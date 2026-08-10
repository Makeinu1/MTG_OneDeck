# O4P-01L-O Fixture and Scenario draft

Status: implemented-not-audited; fixture assets were judge-integrated after
the bounded O/P recovery lanes stopped before edits.

`rule-authority-v1.json` records the four-player control, visibility, search,
play, and decision-authority scenario. The executable scenario test composes it
with the existing immutable Turn Priority fixture, validates the exact
six-field Bundle, and checks frozen JSON, actor/selector separation,
metadata-only search completion, EOT expiry, pending activation, and source
pruning. Face-down Exile uses the frozen exact object subject plus expected
Exile zone and visibility grant; no new play subject variant is introduced.

Card movement, shuffle, reveal events, cast legality, network projection,
combat, and player exit remain deferred.
