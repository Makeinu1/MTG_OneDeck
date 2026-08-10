# Responsive interaction

<!-- clause: UI-RESP-001 -->
The responsive contract covers 375x812 portrait, 812x375 landscape, and 1440x900 desktop viewports. Each viewport keeps the active card, primary action, phase, stack, warnings, and undo surface discoverable.

<!-- clause: UI-RESP-002 -->
Dense zones may scroll or collapse, but the user can reach every operation through a visible control or context action. Content is not hidden behind a fixed overlay, and focus remains inside an active dialog until the dialog is resolved or cancelled.

<!-- clause: UI-RESP-003 -->
Responsive verification is a manual scenario only when layout or interaction changes. A non-UI change does not require browser evidence.
