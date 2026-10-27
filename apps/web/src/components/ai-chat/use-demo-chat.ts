'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDemoChatState, updateDemoChat } from '@/lib/ai-chat/conversation';
import { createDemoChatRepository, DemoChatError } from '@/lib/ai-chat/repository';
import type { ChatAction, ChatPreview } from '@/lib/ai-chat/types';
import { CHAT_DEMO_TURN_LIMIT, validateChatContent } from '@/lib/ai-chat/validation';

export function useDemoChat(preview: ChatPreview) {
  const [repository] = useState(() => createDemoChatRepository(preview));
  const [state, setState] = useState(() => createDemoChatState(preview === 'exhausted'));
  const current = useRef(state);
  const [draft, setDraft] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadVersion, setLoadVersion] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const apply = (action: ChatAction) => {
    current.current = updateDemoChat(current.current, action);
    setState(current.current);
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');
    repository.load(controller.signal).then(
      () => {
        if (!controller.signal.aborted) setLoadStatus('ready');
      },
      () => {
        if (!controller.signal.aborted) setLoadStatus('error');
      },
    );
    return () => controller.abort();
  }, [repository, loadVersion]);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
    },
    [],
  );

  const changeDraft = useCallback((value: string) => {
    setDraft(value);
    setValidation((previous) => (previous ? validateChatContent(value) : null));
  }, []);

  async function send(): Promise<boolean> {
    if (
      activeRequest.current ||
      loadStatus !== 'ready' ||
      current.current.successfulTurns >= CHAT_DEMO_TURN_LIMIT
    )
      return false;
    const error = validateChatContent(draft);
    setValidation(error);
    if (error) return false;
    const content = draft;
    const last = current.current.turns.at(-1);
    const id =
      last && (last.status === 'error' || last.status === 'timeout')
        ? last.id
        : `chat-demo-${crypto.randomUUID()}`;
    const controller = new AbortController();
    activeRequest.current = controller; // Synchronous lock also covers two events in the same frame.
    apply({ type: 'send', id, content });
    try {
      const response = await repository.reply(content, controller.signal);
      if (controller.signal.aborted) return false;
      apply({ type: 'success', id, response });
      setDraft('');
      return true;
    } catch (issue) {
      if (controller.signal.aborted) return false;
      apply({ type: 'failure', id, issue: issue instanceof DemoChatError ? issue.issue : 'error' });
      return false; // Preserve the exact draft, including line breaks, on all failures.
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  const last = state.turns.at(-1);
  return {
    state,
    draft,
    changeDraft,
    validation,
    send,
    loadStatus,
    retryLoad: () => setLoadVersion((version) => version + 1),
    pending: last?.status === 'pending',
    failed: last?.status === 'error' || last?.status === 'timeout',
    exhausted: state.successfulTurns >= CHAT_DEMO_TURN_LIMIT,
  };
}
