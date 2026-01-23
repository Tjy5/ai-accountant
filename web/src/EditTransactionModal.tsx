import React from 'react';
import { Modal, Form, Select, Input, InputNumber, DatePicker, Tag } from 'antd';
import type { TransactionFormData } from './TransactionForm';
import CategorySelector from './components/CategorySelector';
import dayjs from 'dayjs';

interface EditTransactionModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (data: TransactionFormData) => void;
  onCategoryChange?: () => void;
  onNavigateToCategoryManager?: () => void;
  initialData: TransactionFormData;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  visible,
  onCancel,
  onOk,
  onCategoryChange,
  onNavigateToCategoryManager,
  initialData
}) => {
  const [form] = Form.useForm<TransactionFormData>();
  const transactionType = Form.useWatch('type', form);

  React.useEffect(() => {
    if (visible && initialData) {
      form.setFieldsValue({
        ...initialData,
        date: initialData.date ? dayjs(initialData.date) : undefined
      });
    }
  }, [visible, initialData]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
    } catch (error) {
      // 表单验证失败，不关闭模态框
      console.error('表单验证失败:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="编辑交易记录"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="保存"
      cancelText="取消"
      width={600}
      forceRender // 添加 forceRender 属性
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="类型"
          name="type"
          rules={[{ required: true, message: '请选择类型' }]}
        >
          <Select
            options={[
              { label: '支出', value: 'expense' },
              { label: '收入', value: 'income' }
            ]}
          />
        </Form.Item>
        
        <Form.Item
          label="分类"
          name="category"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          {(transactionType !== undefined) ? (
            <CategorySelector 
              placeholder="请选择分类"
              showSearch={true}
              allowClear={true}
              type={transactionType || 'expense'}
              onCategoryChange={onCategoryChange}
              onNavigateToCategoryManager={onNavigateToCategoryManager}
            />
          ) : (
            <CategorySelector 
              placeholder="请选择分类"
              showSearch={true}
              allowClear={true}
              type="expense"
              onCategoryChange={onCategoryChange}
              onNavigateToCategoryManager={onNavigateToCategoryManager}
            />
          )}
        </Form.Item>
        
        <Form.Item
          label="日期"
          name="date"
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        
        <Form.Item
          label="金额"
          name="amount"
          rules={[
            { required: true, message: '请输入金额' },
            { type: 'number', min: 0, message: '金额不能为负数' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={0.01}
            precision={2}
            placeholder="请输入金额"
          />
        </Form.Item>
        
        <Form.Item
          label="备注"
          name="description"
        >
          <Input.TextArea placeholder="可选" rows={2} />
        </Form.Item>

        <Form.Item
          label="标签"
          name="tags"
        >
          <Select
            mode="tags"
            placeholder="输入并回车添加标签，可多选"
            style={{ width: '100%' }}
            tokenSeparators={[',', '，', ';', '；', ' ']}
            open={false}
            tagRender={(props) => {
              const { label, closable, onClose } = props as any;
              return (
                <Tag closable={closable} onClose={onClose} color="#1890ff" style={{ marginRight: 4 }}>
                  {label}
                </Tag>
              );
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditTransactionModal;
