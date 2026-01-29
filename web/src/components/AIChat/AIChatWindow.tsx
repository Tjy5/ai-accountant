import React, { useRef, useEffect, useState } from 'react';
import { Button, Drawer, Tooltip, Badge } from 'antd';
import {
  MessageOutlined,
  DeleteOutlined,
  SettingOutlined,
  CloseOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { useChatState, useAIChat } from './hooks';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ChatTransactionDraft, Category } from '../../../../shared/types';
import './AIChatWindow.css';

interface AIChatWindowProps {
  categories?: Category[];
  onTransactionSaved?: () => void;
  onOpenSettings?: () => void;
}

const AIChatWindow: React.FC<AIChatWindowProps> = ({
  categories = [],
  onTransactionSaved,
  onOpenSettings,
}) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatState = useChatState();
  const { messages, isLoading, getPendingDrafts, markDraftSaved, removeDraft } = chatState;

  const { sendMessage, saveTransaction, saveAllTransactions, clearContext } = useAIChat({
    chatState,
    onTransactionSaved,
  });

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  const handleSaveTransaction = async (messageId: string, draft: ChatTransactionDraft) => {
    const success = await saveTransaction(draft);
    if (success) {
      markDraftSaved(messageId, draft._draftId);
    }
  };

  const handleSaveAll = async () => {
    const pendingDrafts = getPendingDrafts();
    if (pendingDrafts.length === 0) return;

    const success = await saveAllTransactions(pendingDrafts);
    if (success) {
      // Mark all drafts as saved
      messages.forEach(msg => {
        if (msg.drafts) {
          msg.drafts.forEach(draft => {
            if (!draft.saved && !draft.superseded) {
              markDraftSaved(msg.id, draft._draftId);
            }
          });
        }
      });
    }
  };

  const handleDiscardDraft = (messageId: string, draftId: string) => {
    removeDraft(messageId, draftId);
  };

  const handleClear = async () => {
    await clearContext();
  };

  const pendingCount = getPendingDrafts().length;

  const drawerTitle = (
    <div className="ai-chat-header">
      <span className="ai-chat-title">AI 智能记账助手</span>
      <div className="ai-chat-header-actions">
        {pendingCount > 0 && (
          <Button
            type="primary"
            size="small"
            onClick={handleSaveAll}
          >
            保存全部 ({pendingCount})
          </Button>
        )}
        <Tooltip title="清空对话">
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={handleClear}
            disabled={messages.length === 0}
          />
        </Tooltip>
        {onOpenSettings && (
          <Tooltip title="AI 设置">
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={onOpenSettings}
            />
          </Tooltip>
        )}
        <Tooltip title={expanded ? '收起' : '展开'}>
          <Button
            type="text"
            icon={expanded ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={() => setExpanded(!expanded)}
          />
        </Tooltip>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Button */}
      <div className="ai-chat-fab">
        <Badge count={pendingCount} offset={[-5, 5]}>
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<MessageOutlined />}
            onClick={() => setVisible(true)}
            className="ai-chat-fab-button"
          />
        </Badge>
      </div>

      {/* Chat Drawer */}
      <Drawer
        title={drawerTitle}
        placement="right"
        open={visible}
        onClose={() => setVisible(false)}
        width={expanded ? 600 : 380}
        className="ai-chat-drawer"
        closeIcon={<CloseOutlined />}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column' },
        }}
      >
        <div className="ai-chat-container">
          <div className="ai-chat-messages">
            <MessageList
              messages={messages}
              categories={categories}
              isLoading={isLoading}
              onSaveTransaction={handleSaveTransaction}
              onDiscardDraft={handleDiscardDraft}
            />
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-input-area">
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              loading={isLoading}
            />
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default AIChatWindow;
