# Mana costs and payment

<!-- clause: ENG-MANA-001 -->
Mana costs are parsed into colored, generic, colorless, hybrid, phyrexian, and variable components supported by the existing parser. Payment planning is a pure calculation over a snapshot of the mana pool and source permanents.

<!-- clause: ENG-MANA-002 -->
An accepted payment produces a deterministic command sequence and consumes only the resources selected by that plan. An insufficient payment returns a warning or cancellation path without leaving an incomplete state. Forced sandbox payment remains explicit to the user.

<!-- clause: ENG-MANA-003 -->
Automatic tapping is limited to costs whose available choices can be represented by the existing plan. A choice-bearing or restriction-bearing cost remains guided or manual. Mana abilities that use the no-stack transaction path retain one atomic undo boundary.
