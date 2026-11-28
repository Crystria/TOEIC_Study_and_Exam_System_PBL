import type { Metadata } from 'next';
import { ChatView } from '@/components/ai-chat/chat-view';
import type { ChatPreview } from '@/lib/ai-chat/types';
import '@/styles/ai-chat.css';

export const metadata: Metadata = { title: 'Trợ lý học tập AI' };

export default function AiChatPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const allowed: ChatPreview[] = ['loading', 'error', 'reply-error', 'timeout', 'exhausted'];
  const preview = allowed.find((value) => value === searchParams.preview) ?? 'ready';
  return <ChatView key={preview} preview={preview} />;
}
