import React from 'react';
import type { ChatMessage, ChatTransactionDraft, Category } from '../../../../shared/types';
import UserMessage from './UserMessage';
import AIMessage from './AIMessage';
import TypingIndicator from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessage[];
  categories: Category[];
  isLoading: boolean;
  onSaveTransaction: (messageId: string, draft: ChatTransactionDraft) => Promise<void>;
  onDiscardDraft: (messageId: string, draftId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  categories,
  isLoading,
  onSaveTransaction,
  onDiscardDraft,
}) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="chat-empty-state">
        <div className="chat-empty-icon">💬</div>
        <div className="chat-empty-title">开始对话</div>
        <div className="chat-empty-hint">
          试试说 "今天午饭花了50" 或 "打车35元"
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        message.role === 'user' ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AIMessage
            key={message.id}
            message={message}
            categories={categories}
            onSaveTransaction={(draft) => onSaveTransaction(message.id, draft)}
            onDiscardDraft={(draftId) => onDiscardDraft(message.id, draftId)}
          />
        )
      ))}
      {isLoading && <TypingIndicator />}
    </>
  );
};

export default MessageList;
