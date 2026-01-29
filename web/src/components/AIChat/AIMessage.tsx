import React from 'react';
import { Card, Space } from 'antd';
import dayjs from 'dayjs';
import TransactionCard from './TransactionCard';
import type { ChatMessage, ChatTransactionDraft, Category } from '../../../../shared/types';

interface AIMessageProps {
  message: ChatMessage;
  categories: Category[];
  onSaveTransaction: (draft: ChatTransactionDraft) => Promise<void>;
  onDiscardDraft: (draftId: string) => void;
}

const AIMessage: React.FC<AIMessageProps> = ({
  message,
  categories,
  onSaveTransaction,
  onDiscardDraft,
}) => {
  const hasDrafts = message.drafts && message.drafts.length > 0;

  const handleSave = async (savedDraft: ChatTransactionDraft) => {
    await onSaveTransaction(savedDraft);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      marginBottom: 12,
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <Card
        size="small"
        style={{
          maxWidth: '75%',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          borderTopLeftRadius: 4,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        bodyStyle={{
          padding: '10px 14px'
        }}
      >
        <div style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: '#333333',
          wordBreak: 'break-word'
        }}>
          {message.content}
        </div>

        {hasDrafts && (
          <div style={{
            marginTop: 12
          }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {message.drafts!.filter(d => !d.superseded).map((draft) => (
                <div
                  key={draft._draftId}
                  style={{
                    opacity: draft.saved ? 0.7 : 1,
                    position: 'relative'
                  }}
                >
                  <TransactionCard
                    draft={draft}
                    categories={categories}
                    onSave={handleSave}
                    onDiscard={onDiscardDraft}
                  />
                  {draft.saved && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(82, 196, 26, 0.9)',
                      color: '#fff',
                      padding: '4px 12px',
                      borderRadius: 4,
                      fontSize: 12
                    }}>
                      ✓ 已保存
                    </div>
                  )}
                </div>
              ))}
            </Space>
          </div>
        )}

        <div style={{
          fontSize: 11,
          color: '#999999',
          textAlign: 'left',
          marginTop: 8
        }}>
          {dayjs(message.timestamp).format('HH:mm')}
        </div>
      </Card>
    </div>
  );
};

export default AIMessage;
