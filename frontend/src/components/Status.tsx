import React from 'react';
import { Empty, Spin, Button } from 'antd';

export const LoadingSpinner: React.FC<{ tip?: string; style?: React.CSSProperties } > = ({ tip = '加载中...', style }) => {
  return (
    <div style={{ textAlign: 'center', padding: 50, ...style }}>
      <Spin size="large" />
      <div style={{ marginTop: 12, color: '#999' }}>{tip}</div>
    </div>
  );
};

export const EmptyState: React.FC<{ description?: React.ReactNode; style?: React.CSSProperties }> = ({ description = '暂无数据', style }) => {
  return (
    <div style={{ padding: '40px 0', ...style }}>
      <Empty description={description} />
    </div>
  );
};

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void; style?: React.CSSProperties }> = ({ message = '出错了，请重试', onRetry, style }) => {
  return (
    <div style={{ textAlign: 'center', padding: 32, color: '#ff4d4f', ...style }}>
      <div style={{ marginBottom: 12 }}>{message}</div>
      {onRetry && <Button onClick={onRetry}>重试</Button>}
    </div>
  );
};


