export interface ToastsProps {
  warnings: string[];
  onClear: () => void;
}

/** Transient warning toasts, stacked bottom-left. Click (or auto-timeout) clears them. */
export function Toasts({ warnings, onClear }: ToastsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="toasts" data-testid="warnings">
      {warnings.map((w, i) => (
        <div key={`${i}-${w}`} className="toast" onClick={onClear}>
          {w}
        </div>
      ))}
    </div>
  );
}
