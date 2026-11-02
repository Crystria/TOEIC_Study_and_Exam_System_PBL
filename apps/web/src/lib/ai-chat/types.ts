export type ChatPreview = 'ready' | 'loading' | 'error' | 'reply-error' | 'timeout' | 'exhausted';

export interface DemoChatTurn {
  id: string;
  content: string;
  status: 'pending' | 'success' | 'error' | 'timeout';
  response?: string;
}

export interface DemoChatState {
  turns: DemoChatTurn[];
  successfulTurns: number;
}

export type ChatAction =
  | { type: 'send'; id: string; content: string }
  | { type: 'success'; id: string; response: string }
  | { type: 'failure'; id: string; issue: 'error' | 'timeout' };

export interface DemoChatRepository {
  load: (signal: AbortSignal) => Promise<void>;
  reply: (content: string, signal: AbortSignal) => Promise<string>;
}
