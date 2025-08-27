import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Modal, 
  Form, 
  Select, 
  ColorPicker, 
  Space, 
  List, 
  Tag, 
  Typography, 
  Popconfirm, 
  message, 
  Row, 
  Col,
  Empty,
  Badge,
  Radio
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SettingOutlined,
  HomeOutlined,
  CarOutlined,
  ShoppingOutlined,
  MedicineBoxOutlined,
  GiftOutlined,
  BankOutlined,
  CreditCardOutlined,
  WalletOutlined,
  DollarOutlined,
  TrophyOutlined,
  BookOutlined,
  HeartOutlined,
  StarOutlined,
  FireOutlined,
  ThunderboltOutlined,
  CoffeeOutlined,
  ShoppingCartOutlined,
  AppleOutlined,
  SmileOutlined,
  RocketOutlined,
  BulbOutlined,
  CameraOutlined,
  VideoCameraOutlined,
  PhoneOutlined,
  LaptopOutlined,
  TabletOutlined,
  MobileOutlined,
  WifiOutlined,
  CloudOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Text } = Typography;
const { Option } = Select;

interface Category {
  id: number | string;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  description?: string;
  isDefault: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFormData {
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  description: string;
}

interface CategoryManagerProps {
  onCategoryChange?: () => void;
  showCreateModal?: boolean; // 新增：外部控制显示新建分类弹窗
  onModalClose?: () => void; // 新增：弹窗关闭回调
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ onCategoryChange, showCreateModal, onModalClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm<CategoryFormData>();

  // 预定义图标列表 - 网格布局，只显示图标
  const iconOptions = [
    { value: 'HomeOutlined', icon: <HomeOutlined /> },
    { value: 'CarOutlined', icon: <CarOutlined /> },
    { value: 'ShoppingOutlined', icon: <ShoppingOutlined /> },
    { value: 'CoffeeOutlined', icon: <CoffeeOutlined /> },
    { value: 'ShoppingCartOutlined', icon: <ShoppingCartOutlined /> },
    { value: 'AppleOutlined', icon: <AppleOutlined /> },
    { value: 'MedicineBoxOutlined', icon: <MedicineBoxOutlined /> },
    { value: 'GiftOutlined', icon: <GiftOutlined /> },
    { value: 'BankOutlined', icon: <BankOutlined /> },
    { value: 'CreditCardOutlined', icon: <CreditCardOutlined /> },
    { value: 'WalletOutlined', icon: <WalletOutlined /> },
    { value: 'DollarOutlined', icon: <DollarOutlined /> },
    { value: 'TrophyOutlined', icon: <TrophyOutlined /> },
    { value: 'BookOutlined', icon: <BookOutlined /> },
    { value: 'HeartOutlined', icon: <HeartOutlined /> },
    { value: 'StarOutlined', icon: <StarOutlined /> },
    { value: 'FireOutlined', icon: <FireOutlined /> },
    { value: 'ThunderboltOutlined', icon: <ThunderboltOutlined /> },
    { value: 'SmileOutlined', icon: <SmileOutlined /> },
    { value: 'RocketOutlined', icon: <RocketOutlined /> },
    { value: 'BulbOutlined', icon: <BulbOutlined /> },
    { value: 'CameraOutlined', icon: <CameraOutlined /> },
    { value: 'VideoCameraOutlined', icon: <VideoCameraOutlined /> },
    { value: 'PhoneOutlined', icon: <PhoneOutlined /> },
    { value: 'LaptopOutlined', icon: <LaptopOutlined /> },
    { value: 'TabletOutlined', icon: <TabletOutlined /> },
    { value: 'MobileOutlined', icon: <MobileOutlined /> },
    { value: 'WifiOutlined', icon: <WifiOutlined /> },
    { value: 'CloudOutlined', icon: <CloudOutlined /> }
  ];

  // 获取图标组件
  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(option => option.value === iconName);
    return iconOption ? iconOption.icon : <StarOutlined />;
  };

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const data = await api.get<{ categories: Category[] }>(`/api/categories`);
      const backendCategories = (data as any)?.categories || [];
      
      // 合并后端分类和默认分类
      const defaultCategories = getDefaultCategories();
      const mergedCategories = mergeCategories(backendCategories, defaultCategories);
      
      setCategories(mergedCategories);
    } catch (error) {
      console.error('获取分类失败:', error);
      // 使用默认分类
      setCategories(getDefaultCategories());
    }
  };

  // 合并分类函数：确保所有默认分类都存在
  const mergeCategories = (backendCategories: Category[], defaultCategories: Category[]): Category[] => {
    const merged = [...backendCategories];
    
    // 为每个默认分类检查是否已存在
    defaultCategories.forEach(defaultCat => {
      const existingIndex = merged.findIndex(cat => 
        cat.name === defaultCat.name && cat.type === defaultCat.type
      );
      
      if (existingIndex === -1) {
        // 如果默认分类不存在，添加到合并列表中
        merged.push(defaultCat);
      } else {
        // 如果默认分类已存在，确保它被标记为默认分类且不可删除
        merged[existingIndex] = {
          ...merged[existingIndex],
          isDefault: true,
          icon: defaultCat.icon, // 使用默认图标
          color: defaultCat.color, // 使用默认颜色
          description: defaultCat.description // 使用默认描述
        };
      }
    });
    
    return merged;
  };

  // 默认分类
  const getDefaultCategories = (): Category[] => {
    const now = new Date().toISOString();
    return [
      // 收入分类
      {
        id: '1',
        name: '工资',
        type: 'income',
        icon: 'DollarOutlined',
        color: '#52c41a',
        description: '工资收入',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '2',
        name: '奖金',
        type: 'income',
        icon: 'TrophyOutlined',
        color: '#faad14',
        description: '奖金、红包等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '3',
        name: '投资收益',
        type: 'income',
        icon: 'RocketOutlined',
        color: '#722ed1',
        description: '股票、基金等投资收益',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '4',
        name: '兼职收入',
        type: 'income',
        icon: 'StarOutlined',
        color: '#eb2f96',
        description: '兼职、副业收入',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '5',
        name: '其他收入',
        type: 'income',
        icon: 'HeartOutlined',
        color: '#13c2c2',
        description: '其他收入来源',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      
      // 支出分类 - 日常生活
      {
        id: '6',
        name: '餐饮',
        type: 'expense',
        icon: 'CoffeeOutlined',
        color: '#f5222d',
        description: '日常餐饮消费',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '7',
        name: '交通',
        type: 'expense',
        icon: 'CarOutlined',
        color: '#1890ff',
        description: '交通出行费用',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '8',
        name: '购物',
        type: 'expense',
        icon: 'ShoppingOutlined',
        color: '#52c41a',
        description: '日常用品购买',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '9',
        name: '住房',
        type: 'expense',
        icon: 'HomeOutlined',
        color: '#fa8c16',
        description: '房租、房贷、物业费等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '10',
        name: '水电费',
        type: 'expense',
        icon: 'ThunderboltOutlined',
        color: '#fadb14',
        description: '水费、电费、燃气费等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      
      // 支出分类 - 娱乐休闲
      {
        id: '11',
        name: '娱乐',
        type: 'expense',
        icon: 'SmileOutlined',
        color: '#eb2f96',
        description: '电影、游戏、KTV等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '12',
        name: '旅游',
        type: 'expense',
        icon: 'RocketOutlined',
        color: '#13c2c2',
        description: '旅行、度假费用',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '13',
        name: '运动健身',
        type: 'expense',
        icon: 'FireOutlined',
        color: '#fa541c',
        description: '健身房、运动器材等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      
      // 支出分类 - 医疗健康
      {
        id: '14',
        name: '医疗',
        type: 'expense',
        icon: 'MedicineBoxOutlined',
        color: '#f5222d',
        description: '看病、买药等医疗费用',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '15',
        name: '美容护理',
        type: 'expense',
        icon: 'HeartOutlined',
        color: '#eb2f96',
        description: '美容、护肤、美发等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      
      // 支出分类 - 教育学习
      {
        id: '16',
        name: '教育',
        type: 'expense',
        icon: 'BookOutlined',
        color: '#722ed1',
        description: '学费、培训、书籍等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '17',
        name: '数码产品',
        type: 'expense',
        icon: 'LaptopOutlined',
        color: '#1890ff',
        description: '手机、电脑、平板等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      
      // 支出分类 - 金融服务
      {
        id: '18',
        name: '银行服务',
        type: 'expense',
        icon: 'BankOutlined',
        color: '#52c41a',
        description: '银行手续费、年费等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '19',
        name: '信用卡',
        type: 'expense',
        icon: 'CreditCardOutlined',
        color: '#faad14',
        description: '信用卡年费、利息等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '20',
        name: '投资理财',
        type: 'expense',
        icon: 'RocketOutlined',
        color: '#722ed1',
        description: '基金、股票等投资费用',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      
      // 支出分类 - 其他
      {
        id: '21',
        name: '礼物',
        type: 'expense',
        icon: 'GiftOutlined',
        color: '#eb2f96',
        description: '送礼、人情往来',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '22',
        name: '通讯',
        type: 'expense',
        icon: 'PhoneOutlined',
        color: '#13c2c2',
        description: '话费、网费、流量费等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '23',
        name: '保险',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#fa8c16',
        description: '各类保险费用',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '24',
        name: '宠物',
        type: 'expense',
        icon: 'HeartOutlined',
        color: '#f5222d',
        description: '宠物食品、医疗等',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '25',
        name: '其他支出',
        type: 'expense',
        icon: 'BulbOutlined',
        color: '#8c8c8c',
        description: '其他未分类支出',
        isDefault: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      }
    ];
  };

  // 保存分类
  const handleSaveCategory = async (values: CategoryFormData) => {
    try {
      if (editingCategory) {
        // 编辑现有分类（持久化到后端）
        await api.put(`/api/categories/${editingCategory.id}`, values);
        message.success('分类更新成功');
      } else {
        // 创建新分类（持久化到后端）
        const payload = { ...values, isDefault: false };
        await api.post(`/api/categories`, payload);
        message.success('分类创建成功');
      }

      // 刷新列表
      await fetchCategories();
      setModalVisible(false);
      setEditingCategory(null);
      form.resetFields();
      onCategoryChange?.();
      onModalClose?.(); // 调用外部传入的关闭回调
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    }
  };

  // 删除分类
  const handleDeleteCategory = async (category: Category) => {
    if (category.isDefault) {
      message.warning('默认分类不能删除');
      return;
    }
    
    try {
      await api.delete(`/api/categories/${category.id}`);
      await fetchCategories();
      message.success('分类删除成功');
      onCategoryChange?.();
    } catch (error: any) {
      message.error(error?.message || '删除失败');
    }
  };

  // 打开编辑模态框
  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    form.setFieldsValue({
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      description: category.description || ''
    });
    setModalVisible(true);
  };

  // 打开创建模态框
  const openCreateModal = () => {
    setEditingCategory(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'expense',
      icon: 'StarOutlined',
      color: '#1890ff'
    });
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
    setEditingCategory(null);
    form.resetFields();
    onModalClose?.(); // 调用外部传入的关闭回调
  };

  // 按类型分组分类
  const groupedCategories = useMemo(() => {
    const groups = {
      expense: categories.filter(cat => cat.type === 'expense' || cat.type === 'both'),
      income: categories.filter(cat => cat.type === 'income' || cat.type === 'both'),
      both: categories.filter(cat => cat.type === 'both')
    };
    return groups;
  }, [categories]);

  useEffect(() => {
    fetchCategories();
  }, []);

  // 监听外部传入的 showCreateModal 属性
  useEffect(() => {
    if (showCreateModal) {
      setModalVisible(true);
      setEditingCategory(null); // 确保是新建模式
      form.resetFields(); // 重置表单
    }
  }, [showCreateModal, form]);

  return (
    <div>
      <Card 
        title={
          <Space>
            <SettingOutlined />
            <span>分类管理</span>
            <Badge count={categories.length} showZero />
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            新建分类
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {/* 支出分类 */}
          <Col xs={24} lg={12}>
            <Card size="small" title="支出分类" style={{ height: '100%' }}>
              {groupedCategories.expense.length === 0 ? (
                <Empty description="暂无支出分类" />
              ) : (
                <List
                  size="small"
                  dataSource={groupedCategories.expense}
                  renderItem={(category) => (
                    <List.Item
                      actions={[
                        <Button
                          key="edit"
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => openEditModal(category)}
                        />,
                        <Popconfirm
                          key="delete"
                          title={category.isDefault ? "默认分类不能删除" : "确定要删除这个分类吗？"}
                          description={category.isDefault ? "系统默认分类，无法删除" : "删除后，使用该分类的交易将变为'未分类'"}
                          onConfirm={() => handleDeleteCategory(category)}
                          okText="确定"
                          cancelText="取消"
                          disabled={category.isDefault}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={category.isDefault}
                          />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{ 
                            color: category.color, 
                            fontSize: '18px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {getIconComponent(category.icon)}
                          </div>
                        }
                        title={
                          <Space>
                            <Text strong>{category.name}</Text>
                            {category.isDefault && <Tag color="blue">默认</Tag>}
                            {category.type === 'both' && <Tag color="purple">通用</Tag>}
                          </Space>
                        }
                        description={
                          <div>
                            <div>{category.description || '暂无描述'}</div>
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                使用次数: {category.usageCount}
                              </Text>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          {/* 收入分类 */}
          <Col xs={24} lg={12}>
            <Card size="small" title="收入分类" style={{ height: '100%' }}>
              {groupedCategories.income.length === 0 ? (
                <Empty description="暂无收入分类" />
              ) : (
                <List
                  size="small"
                  dataSource={groupedCategories.income}
                  renderItem={(category) => (
                    <List.Item
                      actions={[
                        <Button
                          key="edit"
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => openEditModal(category)}
                        />,
                        <Popconfirm
                          key="delete"
                          title={category.isDefault ? "默认分类不能删除" : "确定要删除这个分类吗？"}
                          description={category.isDefault ? "系统默认分类，无法删除" : "删除后，使用该分类的交易将变为'未分类'"}
                          onConfirm={() => handleDeleteCategory(category)}
                          okText="确定"
                          cancelText="取消"
                          disabled={category.isDefault}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={category.isDefault}
                          />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{ 
                            color: category.color, 
                            fontSize: '18px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {getIconComponent(category.icon)}
                          </div>
                        }
                        title={
                          <Space>
                            <Text strong>{category.name}</Text>
                            {category.isDefault && <Tag color="blue">默认</Tag>}
                            {category.type === 'both' && <Tag color="purple">通用</Tag>}
                          </Space>
                        }
                        description={
                          <div>
                            <div>{category.description || '暂无描述'}</div>
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                使用次数: {category.usageCount}
                              </Text>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 分类编辑模态框 */}
      <Modal
        title={editingCategory ? '编辑分类' : '新建分类'}
        open={modalVisible}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveCategory}
        >
          <Form.Item
            label="分类名称"
            name="name"
            rules={[
              { required: true, message: '请输入分类名称' },
              { max: 20, message: '分类名称不能超过20个字符' }
            ]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>

          <Form.Item
            label="分类类型"
            name="type"
            rules={[{ required: true, message: '请选择分类类型' }]}
          >
            <Select placeholder="请选择分类类型">
              <Option value="expense">支出</Option>
              <Option value="income">收入</Option>
              <Option value="both">通用</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="分类图标"
            name="icon"
            rules={[{ required: true, message: '请选择分类图标' }]}
          >
            <Radio.Group>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(8, 1fr)', 
                gap: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '8px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px'
              }}>
                {iconOptions.map(option => (
                  <Radio.Button
                    key={option.value}
                    value={option.value}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '40px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>
                      {option.icon}
                    </span>
                  </Radio.Button>
                ))}
              </div>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="分类颜色"
            name="color"
            rules={[{ required: true, message: '请选择分类颜色' }]}
          >
            <ColorPicker showText />
          </Form.Item>

          <Form.Item
            label="分类描述"
            name="description"
          >
            <Input.TextArea 
              placeholder="可选，描述分类用途" 
              rows={3}
              maxLength={100}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManager;
