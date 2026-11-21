import type { Theme } from './types';

export function applyTheme(theme: Theme) {
  localStorage.setItem('studentos-theme', theme);
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export const storedTheme = (): Theme => (localStorage.getItem('studentos-theme') as Theme) || 'system';
