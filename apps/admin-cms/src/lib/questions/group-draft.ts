export const groupParts = [3, 4, 6, 7] as const;

// Group type is free text in the service contract; these are editable suggestions.
export const groupTypeSuggestions: Record<number, readonly string[]> = {
  3: ['CONVERSATION'],
  4: ['TALK'],
  6: ['TEXT_COMPLETION'],
  7: ['SINGLE_PASSAGE', 'DOUBLE_PASSAGE', 'TRIPLE_PASSAGE'],
};

export function moveGroupItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function groupContentErrors(
  group: {
    part: number;
    type: string;
    passageText: string;
    transcript: string;
    assets: readonly { kind: string; content: string | null; storageKey: string | null }[];
  },
  questionCount: number,
  { validatePart6 = true }: { validatePart6?: boolean } = {},
): string[] {
  const errors: string[] = [];
  if (!(groupParts as readonly number[]).includes(group.part))
    errors.push('Chọn Part 3, 4, 6 hoặc 7.');
  if (!group.type.trim()) errors.push('Nhập loại nhóm.');
  if (questionCount < 1) errors.push('Nhóm phải có ít nhất một câu hỏi.');
  if ([3, 4].includes(group.part) && !group.transcript.trim())
    errors.push('Nhóm Part 3 và Part 4 cần transcript. Bạn có thể gắn audio sau khi tạo nhóm.');
  if (group.part === 6 && validatePart6) {
    const positions = [...group.passageText.matchAll(/\[\[(\d+)\]\]/g)].map((match) =>
      Number(match[1]),
    );
    if (
      !group.passageText.trim() ||
      positions.length !== questionCount ||
      new Set(positions).size !== positions.length ||
      !Array.from({ length: questionCount }, (_, i) => i + 1).every((position) =>
        positions.includes(position),
      )
    )
      errors.push(
        `Đoạn văn Part 6 cần đúng ${questionCount} vị trí trống, đánh số từ [[1]] đến [[${questionCount}]], mỗi số xuất hiện một lần.`,
      );
  }
  if (
    group.part === 7 &&
    !group.passageText.trim() &&
    !group.assets.some((asset) =>
      asset.kind === 'TEXT' ? asset.content?.trim() : asset.storageKey?.trim(),
    )
  )
    errors.push('Nhóm Part 7 cần đoạn văn hoặc ít nhất một tài liệu.');
  group.assets.forEach((asset, index) => {
    if (asset.kind === 'TEXT' && (!asset.content?.trim() || asset.storageKey))
      errors.push(`Tài liệu ${index + 1} cần nội dung văn bản.`);
    if (asset.kind !== 'TEXT' && (!asset.storageKey || asset.content))
      errors.push(
        `Tài liệu media ${index + 1} không hợp lệ. Hãy gỡ tài liệu và gắn lại tại chi tiết nhóm.`,
      );
  });
  return errors;
}
