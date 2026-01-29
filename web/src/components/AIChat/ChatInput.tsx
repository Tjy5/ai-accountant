import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, message, Upload } from 'antd';
import { SendOutlined, AudioOutlined, PictureOutlined, LoadingOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface ChatInputProps {
  onSend: (content: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  loading = false,
  disabled = false,
  placeholder = '输入消息...'
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<any>(null);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceClick = () => {
    message.info('语音功能暂未实现，敬请期待');
  };

  const handleImageUpload = (info: any) => {
    if (info.file.status === 'done') {
      message.info('图片功能暂未实现，敬请期待');
    }
  };

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
      padding: 12,
      backgroundColor: 'var(--color-bg-tertiary)',
      borderRadius: 8
    }}>
      <Upload
        accept="image/*"
        showUploadList={false}
        customRequest={({ onSuccess }) => onSuccess?.('ok')}
        onChange={handleImageUpload}
        disabled={disabled || loading}
      >
        <Button
          icon={<PictureOutlined />}
          disabled={disabled || loading}
          type="text"
          title="上传图片"
        />
      </Upload>

      <Button
        icon={<AudioOutlined />}
        onClick={handleVoiceClick}
        disabled={disabled || loading}
        type="text"
        title="语音输入"
      />

      <TextArea
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPressEnter={handleSend}
        placeholder={placeholder}
        disabled={disabled || loading}
        autoSize={{ minRows: 1, maxRows: 4 }}
        style={{
          flex: 1,
          resize: 'none'
        }}
      />

      <Button
        type="primary"
        icon={loading ? <LoadingOutlined /> : <SendOutlined />}
        onClick={handleSend}
        disabled={disabled || loading || !inputValue.trim()}
        loading={loading}
      />
    </div>
  );
};

export default ChatInput;
