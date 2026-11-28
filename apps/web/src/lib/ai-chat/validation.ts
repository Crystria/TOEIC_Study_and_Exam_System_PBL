// Verified against SRS 3.6.1 / UC-02 and CSDL 3.2.6. These are not account counters.
export const CHAT_MAX_CHARACTERS = 1000;
export const CHAT_DEMO_TURN_LIMIT = 20;
export const CHAT_TIMEOUT_MS = 10_000;

// Unicode code points match Python/Pydantic string length, including astral characters.
// The SRS does not specify grapheme clusters or normalization.
export const chatCharacterCount = (content: string) => Array.from(content).length;

export function validateChatContent(content: string): string | null {
  if (!content.trim()) return 'Vui lòng nhập câu hỏi trước khi gửi.';
  if (chatCharacterCount(content) > CHAT_MAX_CHARACTERS)
    return 'Câu hỏi chỉ được tối đa 1.000 ký tự. Vui lòng rút gọn nội dung.';
  return null;
}

export function shouldSendChatKey(event: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
}): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}
