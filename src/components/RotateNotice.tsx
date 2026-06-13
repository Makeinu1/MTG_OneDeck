export function RotateNotice() {
  return (
    <div className="rotate-notice" data-testid="rotate-notice" aria-live="polite">
      <div className="rotate-notice__panel">
        <div className="rotate-notice__icon" aria-hidden="true">
          📱
        </div>
        <p className="rotate-notice__title">横向きにしてください</p>
        <p className="rotate-notice__body">この画面はスマートフォンの横向き表示に対応しています。</p>
      </div>
    </div>
  );
}
