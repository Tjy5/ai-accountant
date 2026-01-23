import React, { useState } from 'react';
import { Card, Tag, Button, Space, Modal, Typography, Drawer } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  AudioOutlined, 
  CalendarOutlined,
  FileTextOutlined,
  MoreOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSwipeGesture } from '../hooks/useResponsive';
import TagList from './TagList';

const { Text, Paragraph } = Typography;

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  is_voice_input?: boolean;
  voice_input_text?: string;
  tags?: string[] | string;
}

interface MobileTransactionCardProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
  showVoiceInput?: boolean;
}

const MobileTransactionCard: React.FC<MobileTransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
  showVoiceInput = false
}) => {
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 滑动手势支持
  const { handleTouchStart, handleTouchEnd } = useSwipeGesture(
    () => {
      // 左滑显示删除
      handleDelete();
    },
    () => {
      // 右滑显示编辑
      onEdit(transaction);
    }
  );

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条交易记录吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => onDelete(transaction.id)
    });
  };

  const amountColor = transaction.type === 'income' ? '#52c41a' : '#ff4d4f';
  const amountPrefix = transaction.type === 'income' ? '+' : '-';

  return (
    <>
      <Card
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: `2px solid ${transaction.type === 'income' ? '#f6ffed' : '#fff2f0'}`,
          backgroundColor: transaction.type === 'income' ? '#f6ffed' : '#fff2f0'
        }}
        styles={{ body: { padding: '12px 16px' } }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* 左侧内容 */}
          <div style={{ flex: 1, marginRight: 12 }}>
            {/* 第一行：分类和金额 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag 
                  color={transaction.type === 'income' ? 'green' : 'red'}
                  style={{ margin: 0, fontSize: '12px', padding: '2px 8px' }}
                >
                  {transaction.type === 'income' ? '收入' : '支出'}
                </Tag>
                <Text strong style={{ fontSize: '16px' }}>
                  {transaction.category}
                </Text>
              </div>
              
              <Text 
                style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold', 
                  color: amountColor 
                }}
              >
                {amountPrefix}{transaction.amount.toFixed(2)}
              </Text>
            </div>

            {/* 第二行：日期 */}
            <div style={{ marginBottom: 8 }}>
              <Space size={16}>
                <Space size={4}>
                  <CalendarOutlined style={{ color: '#666', fontSize: '12px' }} />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {dayjs(transaction.date).format('MM-DD')}
                  </Text>
                </Space>
                {transaction.is_voice_input && (
                  <Space size={4}>
                    <AudioOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
                    <Text type="secondary" style={{ fontSize: '12px', color: '#1890ff' }}>
                      语音录入
                    </Text>
                  </Space>
                )}
              </Space>
            </div>

            {/* 第三行：备注 */}
            {transaction.description && (
              <div style={{ marginBottom: 8 }}>
                <Paragraph 
                  style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    color: '#666',
                    lineHeight: '1.4'
                  }}
                  ellipsis={{ rows: 2, expandable: false }}
                >
                  <FileTextOutlined style={{ marginRight: 4, fontSize: '12px' }} />
                  {transaction.description}
                </Paragraph>
              </div>
            )}

            {/* 标签 */}
            <TagList value={transaction.tags as any} max={4} />
          </div>

          {/* 右侧操作按钮 */}
          <Button 
            type="text" 
            icon={<MoreOutlined />}
            onClick={() => setDrawerVisible(true)}
            style={{ 
              padding: '4px',
              height: 'auto',
              width: '32px',
              flexShrink: 0
            }}
          />
        </div>

        {/* 滑动提示 */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: 8, 
          fontSize: '10px', 
          color: '#ccc',
          borderTop: '1px solid #f0f0f0',
          paddingTop: 4
        }}>
          ← 左滑删除 | 右滑编辑 →
        </div>
      </Card>

      {/* 操作抽屉 */}
      <Drawer
        title="操作选项"
        placement="bottom"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        height="auto"
        styles={{ body: { padding: '16px' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              onEdit(transaction);
              setDrawerVisible(false);
            }}
            size="large"
            block
          >
            编辑记录
          </Button>
          
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              setDrawerVisible(false);
              handleDelete();
            }}
            size="large"
            block
          >
            删除记录
          </Button>

          {showVoiceInput && transaction.voice_input_text && (
            <Card 
              title={
                <Space>
                  <AudioOutlined style={{ color: '#1890ff' }} />
                  <span>语音转文字内容</span>
                </Space>
              }
              size="small"
            >
              <Text style={{ fontSize: '14px', lineHeight: '1.6' }}>
                {transaction.voice_input_text}
              </Text>
            </Card>
          )}

          <Button 
            onClick={() => setDrawerVisible(false)}
            size="large"
            block
          >
            取消
          </Button>
        </Space>
      </Drawer>
    </>
  );
};

export default MobileTransactionCard;
