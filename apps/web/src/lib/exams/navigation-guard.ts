/** Keep an active exam on screen until its submission has been confirmed. */
export function installExamNavigationGuard(
  target: Window,
  id: string,
  onBlocked: () => void,
): { release: () => void; dispose: () => void } {
  const examUrl = target.location.href;
  const examLocation = new URL(examUrl);
  // Retain Next's router tree and __NA marker when restoring this history entry.
  const examState = { ...target.history.state, toeicExamGuard: id };
  let released = false;
  let disposed = false;
  const guarded = () => !released && !disposed;

  // A Strict Mode effect reinstallation must not add another dummy entry.
  if (target.history.state?.toeicExamGuard !== id) target.history.pushState(examState, '', examUrl);

  const onPopState = (event: PopStateEvent) => {
    if (!guarded()) return;
    if (event.state?.toeicExamGuard === id && target.location.href === examUrl) return;
    // Run before Next's bubble listener so it never restores the departed route.
    event.stopImmediatePropagation();
    // Pushing the captured exam also handles jumps across several history entries.
    target.history.pushState(examState, '', examUrl);
    onBlocked();
  };

  const onClick = (event: MouseEvent) => {
    if (
      !guarded() ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const element = event.target as Element | null;
    const anchor = element?.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    const anchorTarget = anchor.getAttribute('target')?.toLowerCase();
    if (anchorTarget && !['_self', '_parent', '_top'].includes(anchorTarget)) return;
    const href = anchor.getAttribute('href');
    if (href === null) return;
    const destination = new URL(href, examUrl);
    if (
      destination.origin === examLocation.origin &&
      destination.pathname === examLocation.pathname &&
      destination.search === examLocation.search
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onBlocked();
  };

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!guarded()) return;
    // Browsers own the confirmation UI; closing a tab cannot be forcibly vetoed.
    event.preventDefault();
    event.returnValue = '';
  };

  target.addEventListener('popstate', onPopState, true);
  target.addEventListener('click', onClick, true);
  target.addEventListener('beforeunload', onBeforeUnload);
  return {
    release: () => {
      released = true;
    },
    dispose: () => {
      disposed = true;
      target.removeEventListener('popstate', onPopState, true);
      target.removeEventListener('click', onClick, true);
      target.removeEventListener('beforeunload', onBeforeUnload);
    },
  };
}
