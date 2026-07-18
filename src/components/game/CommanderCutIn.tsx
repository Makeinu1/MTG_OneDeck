import type { CommanderCutInData } from './gameController';

export function CommanderCutIn({ cue }: { cue: CommanderCutInData }) {
  const style = cue.imageUrl
    ? ({ '--commander-art': `url("${cue.imageUrl.replaceAll('"', '\\"')}")` } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="commander-cutin"
      data-testid="commander-cutin"
      data-landed={cue.landed || undefined}
      style={style}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="commander-cutin__shade" aria-hidden="true" />
      <div className="commander-cutin__slash commander-cutin__slash--left" aria-hidden="true" />
      <div className="commander-cutin__slash commander-cutin__slash--right" aria-hidden="true" />
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
      <div className="commander-cutin__impact" aria-hidden="true" />
    </div>
  );
}
