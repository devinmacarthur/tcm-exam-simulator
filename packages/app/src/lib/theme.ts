export type Theme = 'system' | 'light' | 'dark';

export function readTheme(): Theme {
  try { return (localStorage.getItem('fom-theme') as Theme) || 'system'; } catch { return 'system'; }
}

export function applyTheme(t: Theme) {
  try { localStorage.setItem('fom-theme', t); } catch { /* ignore */ }
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const h = () => { if (readTheme() === 'system') applyTheme('system'); };
  mq.addEventListener('change', h);
  return () => mq.removeEventListener('change', h);
}
