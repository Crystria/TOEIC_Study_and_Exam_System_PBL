'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createWorkspaceStore } from '@/lib/demo/workspace-store';

type Store = ReturnType<typeof createWorkspaceStore>;
const Context = createContext<{
  store: Store;
  notice: string;
  setNotice: (text: string) => void;
} | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createWorkspaceStore());
  const [notice, setNotice] = useState('');
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const releaseRemoved = () => {
      const active = new Set(store.getSnapshot().media.map((m) => m.url));
      urls.current.forEach((url) => {
        if (!active.has(url)) URL.revokeObjectURL(url);
      });
      urls.current = active;
    };
    const unsubscribe = store.subscribe(releaseRemoved);
    return () => {
      unsubscribe();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current.clear();
    };
  }, [store]);
  return <Context.Provider value={{ store, notice, setNotice }}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider is required');
  const { store } = context;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...context, state };
}
