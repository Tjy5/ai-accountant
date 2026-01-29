import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  List,
  Modal,
  Space,
  Typography,
  Progress,
  Tag,
  Select,
  Row,
  Col,
  Statistic,
  Tabs,
  Switch,
  Empty,
  Spin,
  DatePicker,
  App as AntdApp,
  message,
  Radio
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined, 
  SettingOutlined,
  BarChartOutlined
} from '@ant-design/icons';

import { useBudget } from './hooks/useBudget';
import { useBudgetForm } from './hooks/useBudgetForm';
import { 
  PERIOD_LABELS
} from './constants/budget';
import api from './utils/api';
import { formatCurrency } from './utils/budgetUtils';

/**
 * 预算管理器组件
 * 
 * 表单简化说明：
 * - 移除了冗余的月/季/年预算字段，用户只需填写一个预算金额
 * - 移除了复杂的时间范围选择，系统根据预算周期自动计算
 * - 保留了核心功能：分类选择、预算金额、周期、预警阈值
 * - 提升了用户体验，降低了使用门槛
 */

const { Text } = Typography;
const { Option } = Select;

interface Category {
  id: number | string;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  description?: string;
}

interface BudgetManagerProps {
  onBudgetUpdate?: () => void;
  onCategoryChange?: () => void;
  refreshKey?: number; // 外部触发刷新
}

const BudgetManager: React.FC<BudgetManagerProps> = ({ onBudgetUpdate, onCategoryChange, refreshKey }) => {
  const { modal } = AntdApp.useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // 调用 useBudget 获取新的父子预算数据
  const {
    healthScore,
    loading,
    totalBudget,
    categoryBudgets,
    budgetStatusData,
    createBudget,
    updateBudget,
    deleteBudget,
    refresh: refreshBudgetData
  } = useBudget({ enableMockData: true, autoRefresh: false });

  // 然后再使用 useBudgetForm，正确传入已初始化的 createBudget 和 updateBudget
  const {
    form,
    loading: formLoading,
    modalVisible,
    editingBudget,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSubmit
  } = useBudgetForm(createBudget, updateBudget, {
    onSuccess: () => {
      message.success('预算操作成功，正在刷新数据...');
      // 操作成功后，强制刷新数据
      refreshBudgetData(true);
      onBudgetUpdate?.();
    }
  });
  
  // 在组件顶层使用 useWatch，而不是在条件渲染中
  const budgetType = Form.useWatch('budgetType', form);
  const budgetPeriod = Form.useWatch('period', form);
  const formBudgetMode = Form.useWatch('budgetMode', form);

  // 获取分类列表 - 与分类管理器保持一致
  const fetchCategories = async () => {
    try {
      const data = await api.get<{ categories: Category[] }>(`/api/categories`);
      
      const backendCategories = (data as any)?.categories || [];
      
      // 使用与分类管理器相同的默认分类列表
      const defaultCategories = getDefaultCategories();
      const mergedCategories = mergeCategories(backendCategories, defaultCategories);
      
      // 只显示支出分类
      const expenseCategories = mergedCategories.filter((cat: Category) => 
        cat.type === 'expense' || cat.type === 'both'
      );
      
      setCategories(expenseCategories);
      
    } catch (error) {
      console.error('获取分类失败:', error);
      // 使用默认分类
      const defaultCategories = getDefaultCategories();
      const expenseCategories = defaultCategories.filter((cat: Category) => 
        cat.type === 'expense' || cat.type === 'both'
      );
      setCategories(expenseCategories);
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
        // 如果默认分类已存在，使用数据库中的数据，但保留默认的图标和颜色
        merged[existingIndex] = {
          ...merged[existingIndex],
          icon: defaultCat.icon, // 使用默认图标
          color: defaultCat.color, // 使用默认颜色
          description: defaultCat.description // 使用默认描述
        };
      }
    });
    
    return merged;
  };

  // 默认分类 - 与分类管理器保持一致
  const getDefaultCategories = (): Category[] => {
    return [
      // 支出分类 - 日常生活
      {
        id: 6,
        name: '餐饮',
        type: 'expense',
        icon: 'CoffeeOutlined',
        color: '#f5222d',
        description: '日常餐饮消费'
      },
      {
        id: 7,
        name: '交通',
        type: 'expense',
        icon: 'CarOutlined',
        color: '#1890ff',
        description: '交通出行费用'
      },
      {
        id: 8,
        name: '购物',
        type: 'expense',
        icon: 'ShoppingOutlined',
        color: '#52c41a',
        description: '日常用品购买'
      },
      {
        id: 9,
        name: '住房',
        type: 'expense',
        icon: 'HomeOutlined',
        color: '#fa8c16',
        description: '房租、房贷、物业费等'
      },
      {
        id: 10,
        name: '水电费',
        type: 'expense',
        icon: 'ThunderboltOutlined',
        color: '#fadb14',
        description: '水费、电费、燃气费等'
      },
      
      // 支出分类 - 娱乐休闲
      {
        id: 11,
        name: '娱乐',
        type: 'expense',
        icon: 'SmileOutlined',
        color: '#eb2f96',
        description: '电影、游戏、KTV等'
      },
      {
        id: 12,
        name: '旅游',
        type: 'expense',
        icon: 'RocketOutlined',
        color: '#13c2c2',
        description: '旅行、度假费用'
      },
      {
        id: 13,
        name: '运动健身',
        type: 'expense',
        icon: 'FireOutlined',
        color: '#fa541c',
        description: '健身房、运动器材等'
      },
      
      // 支出分类 - 医疗健康
      {
        id: 14,
        name: '医疗',
        type: 'expense',
        icon: 'MedicineBoxOutlined',
        color: '#f5222d',
        description: '看病、买药等医疗费用'
      },
      {
        id: 15,
        name: '美容护理',
        type: 'expense',
        icon: 'HeartOutlined',
        color: '#eb2f96',
        description: '美容、护肤、美发等'
      },
      
      // 支出分类 - 教育学习
      {
        id: 16,
        name: '教育',
        type: 'expense',
        icon: 'BookOutlined',
        color: '#722ed1',
        description: '学费、培训、书籍等'
      },
      {
        id: 17,
        name: '数码产品',
        type: 'expense',
        icon: 'LaptopOutlined',
        color: '#1890ff',
        description: '手机、电脑、平板等'
      },
      
      // 支出分类 - 金融服务
      {
        id: 18,
        name: '银行服务',
        type: 'expense',
        icon: 'BankOutlined',
        color: '#52c41a',
        description: '银行手续费、年费等'
      },
      {
        id: 19,
        name: '信用卡',
        type: 'expense',
        icon: 'CreditCardOutlined',
        color: '#faad14',
        description: '信用卡年费、利息等'
      },
      {
        id: 20,
        name: '投资理财',
        type: 'expense',
        icon: 'RocketOutlined',
        color: '#722ed1',
        description: '基金、股票等投资费用'
      },
      
      // 支出分类 - 其他
      {
        id: 21,
        name: '礼物',
        type: 'expense',
        icon: 'GiftOutlined',
        color: '#eb2f96',
        description: '送礼、人情往来'
      },
      {
        id: 22,
        name: '通讯',
        type: 'expense',
        icon: 'PhoneOutlined',
        color: '#13c2c2',
        description: '话费、网费、流量费等'
      },
      {
        id: 23,
        name: '保险',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#fa8c16',
        description: '各类保险费用'
      },
      {
        id: 24,
        name: '宠物',
        type: 'expense',
        icon: 'HeartOutlined',
        color: '#f5222d',
        description: '宠物食品、医疗等'
      },
      {
        id: 25,
        name: '其他支出',
        type: 'expense',
        icon: 'BulbOutlined',
        color: '#8c8c8c',
        description: '其他未分类支出'
      }
    ];
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 监听分类变化，自动刷新分类列表
  useEffect(() => {
    if (onCategoryChange) {
      fetchCategories();
    }
  }, [onCategoryChange]);

  // 外部变更（例如新增/编辑交易）触发预算数据刷新
  useEffect(() => {
    if (refreshKey !== undefined) {
      refreshBudgetData(true);
    }
  }, [refreshKey]);

  // 删除预算设置
  const handleDeleteBudget = async (budgetId: number) => {
    try {
      await deleteBudget(budgetId);
      onBudgetUpdate?.();
    } catch (error: any) {
      console.error('删除预算失败:', error);
      // 错误处理已在 useBudget 中完成
    }
  };
  
  const tabs = [
    {
      key: 'overview',
      label: (
        <span>
          <BarChartOutlined />
          预算概览
        </span>
      ),
      children: (
        <div>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="总预算"
                  value={budgetStatusData?.totalBudget?.limit || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="已使用"
                  value={budgetStatusData?.totalBudget?.spent || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="剩余预算"
                  value={budgetStatusData?.totalBudget?.remaining || 0}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: (budgetStatusData?.totalBudget?.remaining || 0) >= 0 ? '#52c41a' : '#f5222d' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="使用率"
                  value={budgetStatusData?.totalBudget ? (budgetStatusData.totalBudget.spent / budgetStatusData.totalBudget.limit) * 100 : 0}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: (budgetStatusData?.totalBudget && (budgetStatusData.totalBudget.spent / budgetStatusData.totalBudget.limit) > 0.8) ? '#f5222d' : '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 预算使用进度 */}
          <Card title="预算使用进度" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">
                支持总预算和分类预算两种模式，总预算适用于整体支出控制，分类预算适用于特定分类的精细化管理
              </Text>
            </div>
            {budgetStatusData?.totalBudget ? (
              <>
                <Progress
                  percent={(budgetStatusData.totalBudget.spent / budgetStatusData.totalBudget.limit) * 100}
                  status={(budgetStatusData.totalBudget.spent / budgetStatusData.totalBudget.limit) > 1 ? 'exception' : 'normal'}
                  strokeColor={(budgetStatusData.totalBudget.spent / budgetStatusData.totalBudget.limit) > 0.8 ? '#f5222d' : '#52c41a'}
                  format={(percent?: number) => `${(percent || 0).toFixed(1)}%`}
                />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">
                    总预算: {formatCurrency(budgetStatusData.totalBudget.limit)} |
                    已使用: {formatCurrency(budgetStatusData.totalBudget.spent)} |
                    剩余: {formatCurrency(budgetStatusData.totalBudget.remaining)}
                  </Text>
                </div>
                
                {/* 预算状态统计 */}
                <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="总预算数"
                        value={totalBudget ? 1 : 0}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="分类预算数"
                        value={categoryBudgets.length}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="已分配比例"
                        value={budgetStatusData?.totalBudget ? ((budgetStatusData.totalBudget.allocated / budgetStatusData.totalBudget.limit) * 100).toFixed(1) : 0}
                        suffix="%"
                        valueStyle={{ color: '#faad14' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title="未分配金额"
                        value={budgetStatusData?.totalBudget?.unallocated || 0}
                        precision={0}
                        prefix="¥"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Empty description="暂无预算数据" />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">点击"预算管理"标签页开始设置您的第一个预算</Text>
                </div>
              </div>
            )}
          </Card>
        </div>
      )
    },
    {
      key: 'budgets',
      label: (
        <span>
          <SettingOutlined />
          预算管理
        </span>
      ),
      children: (
        <div>
          {/* 总预算区 */}
          <Card
            title="总预算设置"
            style={{ marginBottom: 24 }}
            extra={
              totalBudget ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(totalBudget)}
                >
                  编辑总预算
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openCreateModal('total' as any)}
                >
                  设置总预算
                </Button>
              )
            }
          >
            {totalBudget ? (
              <div>
                <Row gutter={[16, 8]} align="middle">
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="总预算"
                      value={totalBudget.monthlyLimit}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#1890ff', fontWeight: 600 }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="已使用"
                      value={budgetStatusData?.totalBudget?.spent || 0}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#fa541c', fontWeight: 600 }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title="剩余"
                      value={(budgetStatusData?.totalBudget?.remaining ?? (totalBudget.monthlyLimit))}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: (budgetStatusData?.totalBudget?.remaining ?? 0) >= 0 ? '#52c41a' : '#cf1322', fontWeight: 600 }}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 8 }}>
                  <Progress
                    percent={(budgetStatusData?.totalBudget ? (budgetStatusData.totalBudget.spent / budgetStatusData.totalBudget.limit) * 100 : 0)}
                    showInfo
                    strokeColor={(budgetStatusData?.totalBudget && budgetStatusData.totalBudget.spent > budgetStatusData.totalBudget.limit * 0.8) ? '#fa541c' : '#52c41a'}
                    style={{ height: 8 }}
                    format={(percent?: number) => `${(percent || 0).toFixed(1)}%`}
                  />
                </div>
              </div>
            ) : (
              <Empty
                description="请先设置总预算"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>

          {/* 分类预算区 */}
          <Card title="分类预算设置">
            {totalBudget ? (
              categoryBudgets.length > 0 ? (
                <List
                  dataSource={categoryBudgets}
                  renderItem={(item) => {
                    const statusData = budgetStatusData?.categoryBudgets.find(cb => cb.id === item.id);
                    return (
                      <List.Item
                        key={item.id}
                        actions={[
                          <Button
                            key="edit"
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(item)}
                          />,
                          <Button
                            key="delete"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              modal.confirm({
                                title: '确认删除',
                                content: `确定要删除"${item.category}"的预算设置吗？此操作不可恢复。`,
                                okText: '确认删除',
                                cancelText: '取消',
                                okButtonProps: { danger: true },
                                onOk: () => {
                                  handleDeleteBudget(item.id);
                                }
                              });
                            }}
                          />
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space>
                              <span>{item.category}</span>
                              <Tag color="geekblue">分类预算</Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <div style={{ marginBottom: 8 }}>
                                <Text>
                                  预算：{formatCurrency(item.monthlyLimit)} |
                                  已用：{formatCurrency(statusData?.spent || 0)} |
                                  剩余：{formatCurrency(statusData?.remaining || item.monthlyLimit)}
                                </Text>
                              </div>
                              <Progress
                                percent={statusData ? (statusData.spent / statusData.limit) * 100 : 0}
                                status={(statusData && statusData.spent > statusData.limit) ? 'exception' : 'normal'}
                                strokeColor={(statusData && statusData.spent > statusData.limit * 0.8) ? '#f5222d' : '#52c41a'}
                                format={(percent?: number) => `${(percent || 0).toFixed(1)}%`}
                              />
                            </div>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty description="暂无分类预算设置" />
              )
            ) : (
              <Empty
                description="请先设置总预算后再添加分类预算"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </div>
      )
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>正在加载预算数据...</div>
      </div>
    );
  }

  return (
    <div>


      <Card title={`预算管理系统 (健康度: ${healthScore}分)`}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabs}
          size="large"
        />
      </Card>

      {/* 预算编辑模态框 */}
      <Modal
        title={editingBudget ? '编辑预算' : '新增预算'}
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={500}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            budgetMode: 'recurring', // 默认模式为重复预算
            budgetType: 'total',
            period: 'monthly',
            alertThreshold: 80,
            isActive: true,
          }}
        >
          {/* 预算模式选择 */}
          <Form.Item
            label="预算模式"
            name="budgetMode"
            rules={[{ required: true, message: '请选择预算模式' }]}
          >
            <Radio.Group>
              <Radio.Button value="recurring">重复预算</Radio.Button>
              <Radio.Button value="one-time">一次性预算</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* 通用：预算类型和分类 */}
          <Form.Item
            label="预算类型"
            name="budgetType"
            rules={[{ required: true, message: '请选择预算类型' }]}
          >
            <Select>
              <Option value="total">总预算</Option>
              <Option value="category">分类预算</Option>
            </Select>
          </Form.Item>

          {budgetType === 'category' && (
            <Form.Item
              label="选择分类"
              name="categoryId"
              rules={[{ required: true, message: '请选择分类' }]}
              extra="💡 提示：如需添加更多分类，请前往分类管理页面"
            >
              <Select
                placeholder="请选择支出分类"
                showSearch
                filterOption={(input, option) => {
                  const category = categories.find(cat => String(cat.id) === String(option?.value));
                  const categoryName = category?.name || '';
                  return categoryName.toLowerCase().includes(input.toLowerCase());
                }}
              >
                {categories.map(category => (
                  <Option key={category.id} value={category.id}>
                    {category.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 模式一：重复预算 */}
          {formBudgetMode === 'recurring' && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="预算周期"
                    name="period"
                    rules={[{ required: true, message: '请选择预算周期' }]}
                  >
                    <Select>
                      {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                        <Option key={value} value={value}>{label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="生效周期"
                    name="effectiveCycle"
                    extra="默认为当前周期"
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      picker={
                        budgetPeriod === 'yearly' ? 'year' :
                        budgetPeriod === 'quarterly' ? 'quarter' : 'month'
                      }
                      placeholder={
                        budgetPeriod === 'yearly' ? '选择年份' :
                        budgetPeriod === 'quarterly' ? '选择季度' : '选择月份'
                      }
                      format={
                        budgetPeriod === 'yearly' ? 'YYYY' :
                        budgetPeriod === 'quarterly' ? 'YYYY-[Q]Q' : 'YYYY-MM'
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
          
          {/* 模式二：一次性预算 */}
          {formBudgetMode === 'one-time' && (
            <>
               <Form.Item
                label="预算名称"
                name="budgetName"
                extra="例如：国庆假期旅游"
              >
                <Input placeholder="为这个一次性预算起个名字" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="开始日期"
                    name="startDate"
                    rules={[{ required: true, message: '请选择开始日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} placeholder="开始日期" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="结束日期"
                    name="endDate"
                    rules={[{ required: true, message: '请选择结束日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} placeholder="结束日期" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* 通用：金额、阈值等 */}
          <Form.Item
            label="预算金额"
            name="budgetAmount"
            rules={[{ required: true, message: '请输入预算金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              step={100}
              precision={2}
              placeholder="预算金额"
              addonAfter="元"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="预警阈值"
                name="alertThreshold"
                rules={[{ required: true, message: '请设置预警阈值' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={50}
                  max={100}
                  step={5}
                  placeholder="预警阈值"
                  addonAfter="%"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="启用状态"
                name="isActive"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            label="预算描述"
            name="description"
          >
            <Input.TextArea
              placeholder="可选，为预算添加备注"
              rows={2}
              maxLength={200}
              showCount
            />
          </Form.Item>

          {/* 按钮 */}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={formLoading}>
                {editingBudget ? '更新预算' : '保存预算'}
              </Button>
              <Button onClick={closeModal}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>


    </div>
  );
};

export default BudgetManager;
