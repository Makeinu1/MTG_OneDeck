/**
 * trackManifest — AV0 凍結済みの基準曲 TrackManifest。
 * docs/audio-visual-contract.md §6 に凍結された値のみを保持する。
 */

export interface BeatAnchor {
  beatIndex: number;
  atSeconds: number;
}

export interface TrackSection {
  kind: 'groove' | 'break' | 'rejoin';
  startSec: number;
  endSec: number;
}

export interface TrackManifest {
  id: string;
  src: string;
  sha256: string;
  bpmNominal: number;
  loopStartSec: number;
  loopEndSec: number;
  gainDb: number;
  beatAnchors: BeatAnchor[];
  sections: TrackSection[];
}

export const DARK_GAME_TRACK: TrackManifest = {
  id: 'candidate-b-tight-128-bars',
  src: `${import.meta.env.BASE_URL}audio/bgm/candidate-b-tight-128-bars.mp3`,
  sha256: '6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c',
  bpmNominal: 122.000736,
  loopStartSec: 0,
  loopEndSec: 251.798458,
  gainDb: -4.5,
  beatAnchors: [
    { beatIndex: 0, atSeconds: 0 },
    { beatIndex: 32, atSeconds: 15.737404 },
    { beatIndex: 64, atSeconds: 31.474808 },
    { beatIndex: 96, atSeconds: 47.212211 },
    { beatIndex: 128, atSeconds: 62.949615 },
    { beatIndex: 160, atSeconds: 78.687019 },
    { beatIndex: 192, atSeconds: 94.424423 },
    { beatIndex: 224, atSeconds: 110.161826 },
    { beatIndex: 256, atSeconds: 125.89923 },
    { beatIndex: 288, atSeconds: 141.636634 },
    { beatIndex: 320, atSeconds: 157.374038 },
    { beatIndex: 352, atSeconds: 173.111442 },
    { beatIndex: 384, atSeconds: 188.848845 },
    { beatIndex: 416, atSeconds: 204.586249 },
    { beatIndex: 448, atSeconds: 220.323653 },
    { beatIndex: 480, atSeconds: 236.061057 },
    { beatIndex: 512, atSeconds: 251.798458 },
  ],
  sections: [],
};
