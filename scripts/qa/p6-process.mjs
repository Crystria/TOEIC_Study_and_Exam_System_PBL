/** Stop an owned service before reusing its port or dropping its handle. */
export async function stopChild(child, { signal = 'SIGTERM', graceMs = 5000, killMs = 5000 } = {}) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  let timer;
  let killTimer;
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    const onExit = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    child.once('exit', onExit);
    child.once('error', onError);
    timer = setTimeout(() => {
      child.kill('SIGKILL');
      killTimer = setTimeout(() => {
        cleanup();
        reject(new Error('QA child did not exit after SIGKILL: ' + child.pid));
      }, killMs);
    }, graceMs);
    child.kill(signal);
  });
}

/** An unreferenced timer lets a clean CLI exit naturally, but bounds leaked handles. */
export function guardShutdown({ graceMs = 10000, onTimeout = () => {} } = {}) {
  const timer = setTimeout(() => {
    const message =
      'P6 shutdown timed out; report is saved. Active resource types: ' +
      process.getActiveResourcesInfo().join(', ');
    console.error(message);
    onTimeout(message);
    process.exit(1);
  }, graceMs);
  timer.unref();
  return timer;
}
