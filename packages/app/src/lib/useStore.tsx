import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Service } from '@fom/core';
import { getStore, type Store } from './store.ts';

interface Ctx {
  store: Store;
  svc: Service;
  /** Run a mutation, persist, and re-render dependents. */
  mutate<T>(fn: (svc: Service) => T): T;
  /** Bumped after every mutation; use as a dependency to recompute derived data. */
  version: number;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    getStore().then(setStore, (e: unknown) => setError((e as Error).message));
  }, []);
  const mutate = useCallback(<T,>(fn: (svc: Service) => T): T => {
    if (!store) throw new Error('Store not ready');
    const out = fn(store.svc);
    store.scheduleSave();
    setVersion((v) => v + 1);
    return out;
  }, [store]);
  const value = useMemo<Ctx | null>(() => (store ? { store, svc: store.svc, mutate, version } : null), [store, mutate, version]);
  if (error) return <div className="p-8 text-critical">Failed to initialize the local database: {error}</div>;
  if (!value) return <div className="flex h-full items-center justify-center muted">Loading question bank…</div>;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside provider');
  return c;
}
