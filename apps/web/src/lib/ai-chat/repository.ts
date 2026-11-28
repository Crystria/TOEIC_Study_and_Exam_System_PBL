import { sampleChatResponse } from './fixture';
import type { ChatPreview, DemoChatRepository } from './types';
import { CHAT_TIMEOUT_MS, validateChatContent } from './validation';

export class DemoChatError extends Error {
  constructor(readonly issue: 'error' | 'timeout') {
    super(issue === 'timeout' ? 'Demo response timed out' : 'Demo response unavailable');
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

// In-memory only. No API, keys, storage, account quota or other feature dependencies.
export function createDemoChatRepository(preview: ChatPreview): DemoChatRepository {
  let failLoad = preview === 'error';
  let failReply = preview === 'reply-error' || preview === 'timeout';
  return {
    async load(signal) {
      await pause(preview === 'loading' ? 1800 : 250, signal);
      if (failLoad) {
        failLoad = false;
        throw new DemoChatError('error');
      }
    },
    async reply(content, signal) {
      const error = validateChatContent(content);
      if (error) throw new Error(error);
      const simulateFailure = failReply;
      failReply = false;
      await pause(simulateFailure && preview === 'timeout' ? CHAT_TIMEOUT_MS : 700, signal);
      if (simulateFailure) throw new DemoChatError(preview === 'timeout' ? 'timeout' : 'error');
      return sampleChatResponse(content);
    },
  };
}
