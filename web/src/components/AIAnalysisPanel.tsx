import React, { useState } from 'react';
import { Button, Card, Input, List, message, Segmented, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../utils/api';
import type { AIAnalysisResult, AITransactionDraft } from '../../../shared/types';
import AISettingsModal from './AISettingsModal';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface AIAnalysisPanelProps {
  onSuccess?: () => void;
}

const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({ onSuccess }) => {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [drafts, setDrafts] = useState<AITransactionDraft[]>([]);

  const onAnalyze = async () => {
    if (!text.trim()) {
      message.warning('请输入要分析的文本');
      return;
    }
    setLoading(true);
    try {
      const res = await api.analyzeText(text.trim());
      setResult(res);
      setDrafts(res.transactions || []);
      if (!res.transactions || res.transactions.length === 0) {
        message.warning('未识别到有效交易');
      } else {
        message.success(`识别到 ${res.transactions.length} 条交易`);
      }
    } catch (err: any) {
      message.error(err?.message || '分析失败');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (index: number, field: keyof AITransactionDraft, value: any) => {
    setDrafts(prev => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const removeDraft = (index: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== index));
  };

  const onSaveAll = async () => {
    if (drafts.length === 0) {
      message.warning('没有可保存的交易');
      return;
    }
    const invalid = drafts.find(d => !d.category || !Number.isFinite(d.amount) || d.amount <= 0);
    if (invalid) {
      message.error('请检查分类与金额（金额必须为正数）');
      return;
    }
    setSaving(true);
    try {
      await api.bulkCreateTransactions(drafts);
      message.success(`成功保存 ${drafts.length} 条交易`);
      setText('');
      setResult(null);
      setDrafts([]);
      onSuccess?.();
    } catch (err: any) {
      message.error(err?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = drafts.reduce((sum, d) => sum + (Number.isFinite(d.amount) ? d.amount : 0), 0);

  return (
    <div>
      <Title level={5}>AI 智能分析</Title>
      <TextArea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="例如：今天买了咖啡30块，打车花了50，还有午饭80块"
        rows={4}
        disabled={loading || saving}
      />
      <div style={{ marginTop: 12 }}>
        <Space>
          <Button onClick={() => setSettingsVisible(true)} disabled={loading || saving}>
            AI 设置
          </Button>
          <Button type="primary" onClick={onAnalyze} loading={loading} icon={<PlusOutlined />}>
            AI 智能分析
          </Button>
        </Space>
      </div>
      <AISettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      {result?.warnings && result.warnings.length > 0 && (
        <Card size="small" style={{ marginTop: 12, backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
          <Text strong>AI 提示</Text>
          {result.warnings.map((w, i) => (
            <div key={i} style={{ color: '#333' }}>{w}</div>
          ))}
        </Card>
      )}

      {result?.ignored && result.ignored.length > 0 && (
        <Card size="small" style={{ marginTop: 12, backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}>
          <Text strong>已忽略内容</Text>
          {result.ignored.map((s, i) => (
            <div key={i} style={{ color: '#333' }}>{s}</div>
          ))}
        </Card>
      )}

      {drafts.length > 0 && (
        <Card size="small" style={{ marginTop: 12 }} title={`识别结果 (${drafts.length} 条，合计 ¥${totalAmount.toFixed(2)})`}>
          <List
            dataSource={drafts}
            renderItem={(draft, idx) => (
              <List.Item
                key={idx}
                actions={[
                  <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeDraft(idx)}>
                    删除
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Segmented
                        value={draft.type}
                        options={[
                          { label: '支出', value: 'expense' },
                          { label: '收入', value: 'income' },
                        ]}
                        onChange={val => updateDraft(idx, 'type', val)}
                      />
                      {draft.confidence && (
                        <Tag color={draft.confidence > 0.8 ? 'green' : draft.confidence > 0.5 ? 'orange' : 'red'}>
                          置信度 {(draft.confidence * 100).toFixed(0)}%
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input
                        placeholder="分类"
                        value={draft.category}
                        onChange={e => updateDraft(idx, 'category', e.target.value)}
                        style={{ width: 200 }}
                      />
                      <Input
                        type="number"
                        placeholder="金额"
                        value={draft.amount}
                        onChange={e => updateDraft(idx, 'amount', Number(e.target.value))}
                        style={{ width: 150 }}
                      />
                      <Input
                        placeholder="日期 (YYYY-MM-DD)"
                        value={draft.date}
                        onChange={e => updateDraft(idx, 'date', e.target.value)}
                        style={{ width: 180 }}
                      />
                      <Input
                        placeholder="备注"
                        value={draft.description}
                        onChange={e => updateDraft(idx, 'description', e.target.value)}
                      />
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
          <Button type="primary" onClick={onSaveAll} loading={saving} block style={{ marginTop: 12 }}>
            全部保存 ({drafts.length} 条)
          </Button>
        </Card>
      )}
    </div>
  );
};

export default AIAnalysisPanel;
