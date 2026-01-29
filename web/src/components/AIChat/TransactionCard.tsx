import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, DatePicker, InputNumber, Tag, Space, Radio, Tooltip, Row, Col, Typography, message } from 'antd';
import { SaveOutlined, EditOutlined, CloseOutlined, CheckOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Category, ChatTransactionDraft } from '../../../../shared/types';

const { Option } = Select;
const { Text } = Typography;

interface TransactionCardProps {
  draft: ChatTransactionDraft;
  categories: Category[];
  onSave: (savedDraft: ChatTransactionDraft) => Promise<void> | void;
  onDiscard: (draftId: string) => void;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  draft,
  categories,
  onSave,
  onDiscard,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ChatTransactionDraft>({ ...draft });

  // Update local state when prop changes (e.g. from parent update)
  useEffect(() => {
    setFormData({ ...draft });
  }, [draft]);

  const getConfidenceColor = (confidence: number = 0) => {
    if (confidence >= 0.8) return '#52c41a'; // Green
    if (confidence >= 0.5) return '#faad14'; // Yellow
    return '#ff4d4f'; // Red
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate
      if (!formData.amount || formData.amount <= 0) {
        message.error('请输入有效金额');
        return;
      }
      if (!formData.category) {
        message.error('请选择分类');
        return;
      }

      const updatedDraft: ChatTransactionDraft = {
        ...draft,
        ...formData,
        _draftId: draft._draftId,
      };

      await onSave(updatedDraft);
      setIsEditing(false);
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({ ...draft }); // Revert changes
    setIsEditing(false);
  };

  const handleDiscard = () => onDiscard(draft._draftId);

  const handleFormChange = (updates: Partial<ChatTransactionDraft>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // View Mode
  const renderView = () => (
    <div style={{ position: 'relative' }}>
       {/* Confidence Indicator */}
       <div style={{ position: 'absolute', top: -12, right: -12 }}>
        <Tooltip title={`置信度: ${(draft.confidence || 0) * 100}%`}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: getConfidenceColor(draft.confidence)
          }} />
        </Tooltip>
      </div>

      <Row gutter={[16, 8]} align="middle">
        <Col span={24}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
               <Tag color={draft.type === 'income' ? 'red' : 'green'}>
                 {draft.type === 'income' ? '收入' : '支出'}
               </Tag>
               <Text strong style={{ fontSize: 18 }}>
                 ¥{Number(draft.amount).toFixed(2)}
               </Text>
            </Space>
            <Tag color="blue">{draft.category}</Tag>
          </Space>
        </Col>
        <Col span={24}>
           <Space direction="vertical" size={0} style={{ width: '100%' }}>
             <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(draft.date).format('YYYY-MM-DD')}</Text>
             <Text>{draft.description || '无备注'}</Text>
           </Space>
        </Col>
      </Row>
      
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button 
          type="primary" 
          icon={<CheckOutlined />} 
          onClick={handleSave} 
          loading={saving}
          size="small"
        >
          保存
        </Button>
        <Button 
          icon={<EditOutlined />} 
          onClick={handleEdit}
          size="small"
        >
          编辑
        </Button>
        <Button 
          danger 
          icon={<CloseOutlined />} 
          onClick={handleDiscard}
          size="small"
        >
          放弃
        </Button>
      </div>
    </div>
  );

  // Edit Mode
  const renderEdit = () => (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Radio.Group 
          value={formData.type} 
          onChange={e => handleFormChange({ type: e.target.value })}
          buttonStyle="solid"
          size="small"
          style={{ width: '100%', textAlign: 'center' }}
        >
          <Radio.Button value="expense" style={{ width: '50%' }}>支出</Radio.Button>
          <Radio.Button value="income" style={{ width: '50%' }}>收入</Radio.Button>
        </Radio.Group>

        <InputNumber
          style={{ width: '100%' }}
          prefix="¥"
          value={formData.amount}
          onChange={val => handleFormChange({ amount: val || 0 })}
          precision={2}
          min={0}
        />

        <Select
          style={{ width: '100%' }}
          value={formData.category}
          onChange={val => handleFormChange({ category: val })}
          placeholder="选择分类"
        >
          {categories
            .filter(c => c.type === formData.type || c.type === 'both')
            .map(c => (
            <Option key={c.id} value={c.name}>{c.name}</Option>
          ))}
          {/* Fallback if category not in list */}
          {!categories.some(c => c.name === formData.category) && formData.category && (
             <Option key="current" value={formData.category}>{formData.category}</Option>
          )}
        </Select>

        <DatePicker 
          style={{ width: '100%' }}
          value={dayjs(formData.date)}
          onChange={(date) => handleFormChange({ date: date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD') })}
          allowClear={false}
        />

        <Input 
          value={formData.description}
          onChange={e => handleFormChange({ description: e.target.value })}
          placeholder="备注"
          prefix={<EditOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
           <Button 
            size="small" 
            icon={<UndoOutlined />} 
            onClick={handleCancelEdit}
          >
            取消
          </Button>
          <Button 
            type="primary" 
            size="small" 
            icon={<SaveOutlined />} 
            loading={saving}
            onClick={handleSave}
          >
            保存
          </Button>
        </div>
      </Space>
    </div>
  );

  return (
    <Card 
      size="small" 
      style={{ 
        width: 280, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderRadius: 8,
        border: `1px solid ${isEditing ? '#1890ff' : '#f0f0f0'}`
      }}
      bodyStyle={{ padding: 12 }}
    >
      {isEditing ? renderEdit() : renderView()}
    </Card>
  );
};

export default TransactionCard;
