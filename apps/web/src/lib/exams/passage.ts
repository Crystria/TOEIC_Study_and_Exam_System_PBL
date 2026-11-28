/** Display source numbers without changing the DTO's one-based blank tokens. */
export function formatPassageBlanks(passage: string, instruction: string | null | undefined) {
  const range = /\bQuestions?\s+(\d+)\s*[-–—]\s*(\d+)\b/i.exec(instruction ?? '');
  if (!range) return passage;
  const start = Number(range[1]),
    end = Number(range[2]),
    positions = [...passage.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]));
  if (
    start < 1 ||
    end > 200 ||
    end < start ||
    positions.length !== end - start + 1 ||
    [...positions].sort((a, b) => a - b).some((position, index) => position !== index + 1)
  )
    return passage;
  return passage.replace(
    /\[\[(\d+)\]\]/g,
    (_, position: string) => `_______ (${start + Number(position) - 1})`,
  );
}
