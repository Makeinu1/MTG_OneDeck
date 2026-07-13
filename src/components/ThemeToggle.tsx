import { useTheme, type ThemePreference } from '../ui/theme';

const OPTIONS: Array<{ value: ThemePreference; label: string; short: string }> = [
  { value: 'system', label: '端末設定に合わせる', short: '自動' },
  { value: 'light', label: 'ライトテーマ', short: '明' },
  { value: 'dark', label: 'ダークテーマ', short: '暗' },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className={`theme-toggle${compact ? ' theme-toggle--compact' : ''}`} role="group" aria-label="表示テーマ">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-toggle__option"
          data-testid={`theme-${option.value}`}
          data-active={preference === option.value || undefined}
          aria-pressed={preference === option.value}
          title={option.label}
          onClick={() => setPreference(option.value)}
        >
          {compact ? option.short : option.label}
        </button>
      ))}
    </div>
  );
}
