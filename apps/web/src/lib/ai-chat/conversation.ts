import type { ChatAction, DemoChatState } from './types';
import { CHAT_DEMO_TURN_LIMIT, validateChatContent } from './validation';

export function createDemoChatState(exhausted = false): DemoChatState {
  return { turns: [], successfulTurns: exhausted ? CHAT_DEMO_TURN_LIMIT : 0 };
}

export function updateDemoChat(state: DemoChatState, action: ChatAction): DemoChatState {
  const last = state.turns.at(-1);
  if (action.type === 'send') {
    if (
      last?.status === 'pending' ||
      state.successfulTurns >= CHAT_DEMO_TURN_LIMIT ||
      validateChatContent(action.content)
    )
      return state;
    const turn = { id: action.id, content: action.content, status: 'pending' as const };
    if (last && (last.status === 'error' || last.status === 'timeout')) {
      if (action.id !== last.id) return state;
      return { ...state, turns: [...state.turns.slice(0, -1), turn] };
    }
    if (state.turns.some((item) => item.id === action.id)) return state;
    return { ...state, turns: [...state.turns, turn] };
  }
  // Reject duplicate completions and stale responses, including after retries/unmount.
  if (!last || last.id !== action.id || last.status !== 'pending') return state;
  const turn =
    action.type === 'success'
      ? { ...last, status: 'success' as const, response: action.response }
      : { ...last, status: action.issue };
  return {
    turns: [...state.turns.slice(0, -1), turn],
    successfulTurns: state.successfulTurns + (action.type === 'success' ? 1 : 0),
  };
}
