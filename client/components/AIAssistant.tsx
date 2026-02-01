import { useState } from 'react';
import { RiRobot2Line } from 'react-icons/ri';
import { AssistantDrawer } from '@/components/AssistantDrawer';
import { useDifyChat } from '@/pages/home/useDifyChat';
import { User } from '@shared/types';

interface AIAssistantProps {
  user: User | null;
}

export default function AIAssistant({ user }: AIAssistantProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const {
    messages,
    streamText,
    streaming,
    error: streamError,
    send,
    sections,
  } = useDifyChat();

  // Only show AI Assistant for authenticated users
  if (!user) {
    return null;
  }

  // Debug: Log when component renders
  console.log('AIAssistant rendering for user:', user?.email || user?.id);

  return (
    <>
      {/* Floating Chat Button - Always Visible */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl hover:shadow-3xl transition-all hover:scale-110 z-[9999] flex items-center justify-center cursor-pointer border-0 outline-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Open AI assistant chat"
        title="Open AI Assistant Chat"
        style={{ 
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999
        }}
      >
        <RiRobot2Line className="w-7 h-7" />
        {streaming && (
          <span className="absolute -top-1 -right-1 flex w-4 h-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full w-4 h-4 bg-primary-500"></span>
          </span>
        )}
      </button>

      <AssistantDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        messages={messages}
        streamText={streamText}
        streaming={streaming}
        streamError={streamError}
        sections={sections}
        onSend={send}
      />
    </>
  );
}

