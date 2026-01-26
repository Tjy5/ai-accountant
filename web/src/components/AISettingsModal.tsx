import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, message, Modal, Switch } from 'antd';
import api from '../utils/api';
import type { AISettings } from '../../../shared/types';

interface AISettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSavedKey, setHasSavedKey] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getAISettings();
      const s = res.settings;
      form.setFieldsValue({
        apiBaseUrl: s.apiBaseUrl || 'https://api.openai.com/v1',
        apiKey: '',
        model: s.model || 'gpt-3.5-turbo',
        temperature: s.temperature ?? 0.7,
        maxTokens: s.maxTokens ?? 1000,
        enabled: s.enabled ?? false,
      });
      setHasSavedKey(s.apiKey === '********');
    } catch (err: any) {
      message.error(err?.message || '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) loadSettings();
  }, [visible]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Partial<AISettings> = {
        apiBaseUrl: values.apiBaseUrl?.trim(),
        model: values.model?.trim(),
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        enabled: values.enabled,
      };
      if (values.apiKey?.trim()) {
        payload.apiKey = values.apiKey.trim();
      }
      await api.updateAISettings(payload);
      message.success('AI 设置已保存');
      onClose();
    } catch (err: any) {
      if (err.errorFields) {
        message.warning('请检查表单填写');
      } else {
        message.error(err?.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await api.deleteAISettings();
      message.success('已清除 AI 配置');
      onClose();
    } catch (err: any) {
      message.error(err?.message || '清除失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="AI 设置"
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      width={500}
      footer={[
        <Button key="clear" danger onClick={handleClear} loading={saving}>
          清除配置并禁用
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="ok" type="primary" onClick={handleOk} loading={saving}>
          保存
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" disabled={loading}>
        <Form.Item label="启用 AI" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          label="API Base URL"
          name="apiBaseUrl"
          rules={[{ required: true, message: '请输入 API Base URL' }]}
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>

        <Form.Item
          label="API Key"
          name="apiKey"
        >
          <Input.Password
            placeholder={hasSavedKey ? '已配置（********），如需修改请重新输入' : '请输入 API Key'}
          />
        </Form.Item>

        <Form.Item
          label="模型"
          name="model"
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input placeholder="gpt-3.5-turbo" />
        </Form.Item>

        <Form.Item
          label="Temperature"
          name="temperature"
          rules={[{ required: true, message: '请输入 Temperature' }]}
        >
          <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Max Tokens"
          name="maxTokens"
          rules={[{ required: true, message: '请输入 Max Tokens' }]}
        >
          <InputNumber min={1} max={20000} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AISettingsModal;
