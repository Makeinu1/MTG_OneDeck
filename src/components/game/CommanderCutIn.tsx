/**
 * CommanderCutIn — AV4 restrained white-platinum halo ritual visual.
 * docs/audio-visual-contract.md §5.
 *
 * Duration is driven by --dur-ritual (650ms). Reduced motion = fade/static.
 * No slash, no explosion, no landed state.
 */

export interface CommanderCutInData {
  cardId: string;
  faceIndex: number;
  name: string;
  typeLine: string;
  imageUrl?: string;
}

export function CommanderCutIn({ cue }: { cue: CommanderCutInData }) {
  const style = cue.imageUrl
    ? ({ '--commander-art': `url("${cue.imageUrl.replaceAll('"', '\\"')}")` } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="commander-cutin"
      data-testid="commander-cutin"
      style={style}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="commander-cutin__shade" aria-hidden="true" />
      <div className="commander-cutin__halo" aria-hidden="true" />
      <div className="commander-cutin__band">
        <div className="commander-cutin__art" aria-hidden="true" />
        <div className="commander-cutin__card" aria-hidden="true">
          {cue.imageUrl ? <img src={cue.imageUrl} alt="" /> : <span>◇</span>}
        </div>
        <div className="commander-cutin__copy">
          <small>統率者</small>
          <strong>《{cue.name}》</strong>
          <span>{cue.typeLine}</span>
        </div>
      </div>
    </div>
  );
}
