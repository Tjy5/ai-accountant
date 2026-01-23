import React, { useState } from 'react';
import { Modal, Form, Select, Checkbox, Button, Row, Col, Divider } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { exportTransactions, type ExportTransaction } from './utils/exportUtils';
import { DEFAULT_EXPORT_FIELDS, EXPORT_FIELD_LABELS } from './constants/exports';

interface ExportModalProps {
  visible: boolean;
  onCancel: () => void;
  transactions: ExportTransaction[];
  title?: string;
}

const ExportModal: React.FC<ExportModalProps> = ({ 
  visible, 
  onCancel, 
  transactions,
  title = '导出数据'
}) => {
  const [form] = Form.useForm();
  const [selectedFields, setSelectedFields] = useState<string[]>([...DEFAULT_EXPORT_FIELDS]);

  // 可选择的字段
  const availableFields = Object.entries(EXPORT_FIELD_LABELS).map(([value, label]) => ({ value, label }));

  const handleExport = () => {
    form.validateFields().then(values => {
      const { format } = values;
      
      if (selectedFields.length === 0) {
        Modal.warning({
          title: '提示',
          content: '请至少选择一个字段'
        });
        return;
      }

      exportTransactions(transactions, {
        format,
        fields: selectedFields
      });

      // 导出成功后关闭弹窗
      onCancel();
      
      // 重置表单
      form.resetFields();
      setSelectedFields([...DEFAULT_EXPORT_FIELDS]);
    });
  };

  const handleFieldChange = (checkedValues: string[]) => {
    setSelectedFields(checkedValues);
  };

  const selectAllFields = () => {
    setSelectedFields(availableFields.map(field => field.value));
  };

  const clearAllFields = () => {
    setSelectedFields([]);
  };

  const selectCommonFields = () => {
    setSelectedFields([...DEFAULT_EXPORT_FIELDS]);
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DownloadOutlined />
          {title}
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="export" type="primary" onClick={handleExport}>
          开始导出
        </Button>
      ]}
      width={600}
    >
      <div style={{ marginBottom: 16 }}>
        <span style={{ color: '#666' }}>
          将要导出 <strong style={{ color: '#1890ff' }}>{transactions.length}</strong> 条记录
        </span>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          format: 'excel'
        }}
      >
        <Form.Item
          name="format"
          label="导出格式"
          rules={[{ required: true, message: '请选择导出格式' }]}
        >
          <Select>
            <Select.Option value="excel">Excel (.xlsx)</Select.Option>
            <Select.Option value="csv">CSV (.csv)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="导出字段">
          <div style={{ marginBottom: 12 }}>
            <Button size="small" onClick={selectAllFields} style={{ marginRight: 8 }}>
              全选
            </Button>
            <Button size="small" onClick={clearAllFields} style={{ marginRight: 8 }}>
              清空
            </Button>
            <Button size="small" onClick={selectCommonFields}>
              常用字段
            </Button>
          </div>
          
          <Checkbox.Group
            value={selectedFields}
            onChange={handleFieldChange}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 8]}>
              {availableFields.map(field => (
                <Col span={8} key={field.value}>
                  <Checkbox value={field.value}>
                    {field.label}
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>

        <Divider />

        <div style={{ fontSize: '12px', color: '#999', lineHeight: '18px' }}>
          <div>• Excel格式支持更丰富的格式和样式</div>
          <div>• CSV格式兼容性更好，可在各种软件中打开</div>
          <div>• 文件名将自动包含导出日期</div>
        </div>
      </Form>
    </Modal>
  );
};

export default ExportModal;
