import React from 'react';
import { Card } from 'antd';
import dayjs from 'dayjs';
import type { ChatMessage } from '../../../../shared/types';

interface UserMessageProps {
  message: ChatMessage;
}

const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 12,
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <Card
        size="small"
        style={{
          maxWidth: '70%',
          backgroundColor: '#1890ff',
          borderRadius: 12,
          borderTopRightRadius: 4
        }}
        bodyStyle={{
          padding: '10px 14px',
          color: '#ffffff',
          wordBreak: 'break-word'
        }}
      >
        <div style={{
          fontSize: 14,
          lineHeight: 1.6
        }}>
          {message.content}
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.7)',
          textAlign: 'right',
          marginTop: 6
        }}>
          {dayjs(message.timestamp).format('HH:mm')}
        </div>
      </Card>
    </div>
  );
};

export default UserMessage;
