'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Destination = { href: string } | 'back' | null;

// App Router has no route blocker. Capture the shell's Links and use a same-URL
// history entry to restore the form before asking about a browser Back action.
export function useSettingsNavigation(dirty: boolean, guardKey = 'toeicSettingsGuard') {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leaving = useRef(false);
  const [destination, setDestination] = useState<Destination>(null);
  useEffect(() => {
    if (!window.history.state?.[guardKey]) {
      window.history.pushState(
        { ...window.history.state, [guardKey]: true },
        '',
        window.location.href,
      );
    }
    let restoring = false;
    const click = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.download || (anchor.target && anchor.target !== '_self')) return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname && url.search === window.location.search)
      )
        return;
      event.preventDefault();
      // Do not stop propagation: the shell still closes its mobile menu.
      setDestination({ href: `${url.pathname}${url.search}${url.hash}` });
    };
    const pop = (event: PopStateEvent) => {
      if (leaving.current) return;
      if (restoring && event.state?.[guardKey]) {
        restoring = false;
        setDestination('back');
        return;
      }
      if (event.state?.[guardKey]) return;
      if (dirtyRef.current) {
        restoring = true;
        window.history.forward();
      } else {
        leaving.current = true;
        window.history.back();
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && !leaving.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', pop);
    window.addEventListener('beforeunload', unload);
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', pop);
      window.removeEventListener('beforeunload', unload);
    };
  }, [guardKey]);
  const leave = () => {
    leaving.current = true;
    dirtyRef.current = false;
    if (destination === 'back') window.history.go(-2);
    else if (destination) router.push(destination.href);
    setDestination(null);
  };
  return { pending: destination !== null, cancel: () => setDestination(null), leave };
}
