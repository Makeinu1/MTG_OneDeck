# AV7-P SFX palette previews

This directory contains only reproducible, development-only audition previews. The generated WAV files are in `previews/`; it is not a production asset directory.

Regenerate every WAV and its manifest from the untouched local source tree:

```sh
node research/audio/sfx-palette/render-previews.mjs
```

The renderer conservatively trims every existing physical source and adds 2 ms edge fades. `synthesize-originals.mjs` creates the spell and commander magical layers from fixed-seed bounded synthesis. All previews are 48 kHz stereo 16-bit PCM WAV; `manifest.json` records the exact source, provenance, transform, output SHA-256, probe metadata, and measured peak.

Kenney Casino Audio sources are CC0 (see `sound/kenney_casino-audio/License.txt`). The former voice and long-invocation candidates remain marked `comparisonOnly` in the manifest for provenance only; they are not playable from the fixture. The two magical layers are project-made originals.

No Cockatrice or `sound/spells/` source is used.
