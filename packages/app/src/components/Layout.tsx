import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { applyTheme, readTheme, type Theme } from '../lib/theme.ts';
import { useStore } from '../lib/useStore.tsx';

const links = [
  ['/', 'Dashboard'],
  ['/exam', 'Full exam'],
  ['/study', 'Study'],
  ['/analytics', 'Analytics'],
  ['/history', 'History'],
  ['/bank', 'Question bank'],
  ['/settings', 'Settings'],
] as const;

export function ThemeToggle() {
  const [t, setT] = useState<Theme>(readTheme());
  useEffect(() => applyTheme(t), [t]);
  return (
    <select aria-label="Theme" className="input w-auto py-1 text-sm" value={t} onChange={(e) => setT(e.target.value as Theme)}>
      <option value="system">System theme</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}

export default function Layout() {
  const { store } = useStore();
  return (
    <div className="min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">Skip to content</a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="text-base font-semibold tracking-tight">FOM Exam Simulator</NavLink>
          <nav aria-label="Primary" className="flex flex-wrap gap-1 text-sm">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded px-3 py-1.5 ${isActive ? 'bg-surface-2 font-medium' : 'text-ink-2 hover:text-ink'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>
        {!store.persistent && (
          <div className="bg-warn/20 px-4 py-1 text-center text-xs text-ink">Browser storage is unavailable (private window or blocked). Progress will be lost when this tab closes; export a backup from Settings.</div>
        )}
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-xs muted">
        Unofficial study tool. Not affiliated with or endorsed by NCBAHM. All questions are original; raw practice accuracy is not an official scaled score. <NavLink to="/about" className="underline">About the exam mapping</NavLink>.
      </footer>
    </div>
  );
}
