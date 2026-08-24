# O4P-08D Fresh-Context Cold Audit Brief

Milestone: `O4P-08D`
Risk: `R3 / BROAD`

Audit only the frozen candidate fingerprint supplied by the Judge. Read the D
contract and acceptance brief, inspect source and Judge reviews, and run bounded
tests as needed. Do not edit files and do not infer intent from implementation
history.

Adversarially verify:

- exact create v5 and variable recover v5 without legacy byte drift;
- immutable configuration and exact 2/4 lobby/start blockers;
- complete player/table projection with v1-equivalent privacy and no P3/P4 in
  a two-player room;
- Personal Workbench, Table Display, Display Pairing, Guided Actions, action
  binding, focus/correction/combat targets, and four-player regression;
- recovery/kick/invite/error secret safety and browser persistence boundaries;
- 375x812, 812x375, 1440x900 accessibility/overflow/console evidence;
- no Duel Commander, legality gate, account, matchmaking, ban, team, dependency,
  governance, or unrelated product widening.

Return findings only, classified BLOCKER/HIGH/MEDIUM/LOW, with file and line.
BLOCKER/HIGH must be zero before release.
