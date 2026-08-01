/** Shared chrome frame color presets (main app + overlay). */
export const CHROME_COLOR_PRESETS = [
  { id: 'silver', label: 'Silver', value: '#d4d8de' },
  { id: 'blood', label: 'Blood', value: '#9b1c2e' },
  { id: 'gold', label: 'Gold', value: '#c9a962' },
  { id: 'ice', label: 'Ice', value: '#9eb8c9' },
  { id: 'obsidian', label: 'Obsidian', value: '#6b7280' },
  { id: 'rose', label: 'Rose', value: '#c4a0a8' },
] as const;

export const DEFAULT_CHROME_COLOR = '#d4d8de';

export function normalizeChromeColor(value: string | undefined | null): string {
  if (!value) return DEFAULT_CHROME_COLOR;
  const v = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toLowerCase() : DEFAULT_CHROME_COLOR;
}
