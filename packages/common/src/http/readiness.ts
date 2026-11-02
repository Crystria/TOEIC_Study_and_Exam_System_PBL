export async function probe(checks: Record<string, () => Promise<unknown>>, timeoutMs = 1500) {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          check(),
          new Promise<never>((_r, reject) => {
            timer = setTimeout(() => reject(new Error('Probe timeout')), timeoutMs);
          }),
        ]);
        return [name, 'ok'] as const;
      } catch {
        return [name, 'unavailable'] as const;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return {
    ready: entries.every(([, status]) => status === 'ok'),
    checks: Object.fromEntries(entries),
  };
}
