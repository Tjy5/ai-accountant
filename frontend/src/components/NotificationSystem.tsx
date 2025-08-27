import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Alert, 
  Typography, 
  Space, 
  Progress, 
  Button, 
  Switch, 
  Select, 
  List, 
  Badge, 
  Tabs, 
  Tag, 
  Modal,
  Form,
  TimePicker,
  message,
  Empty
} from 'antd';
import { 
  BellOutlined, 
  WarningOutlined, 
  ExclamationCircleOutlined, 
  SettingOutlined,
  FileTextOutlined,
  DollarOutlined,
  CalendarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface BudgetStatus {
  category: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

interface NotificationSettings {
  budgetAlerts: boolean;
  weeklyReport: boolean;
  monthlyReport: boolean;
  overBudgetThreshold: number;
  nearBudgetThreshold: number;
  reportTime: string;
  reportDay: string;
}

interface NotificationItem {
  id: string;
  type: 'budget' | 'report' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  amount?: number;
}

interface NotificationSystemProps {
  refreshKey?: number;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ refreshKey }) => {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    budgetAlerts: true,
    weeklyReport: true,
    monthlyReport: true,
    overBudgetThreshold: 100,
    nearBudgetThreshold: 80,
    reportTime: '09:00',
    reportDay: 'monday'
  });

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 获取预算状态
  const fetchBudgetStatus = useCallback(async () => {
    try {
      const data = await api.get<any>(`/api/budget-status`);
      const rawList = Array.isArray(data?.categoryBudgets)
        ? data.categoryBudgets
        : (Array.isArray(data?.budgets) ? data.budgets : []);

      const mapped: BudgetStatus[] = rawList.map((item: any) => {
        const monthlyLimit = Number(item?.monthly_limit ?? item?.monthlyLimit ?? item?.limit ?? 0) || 0;
        const spent = Number(item?.spent ?? 0) || 0;
        const remaining = Number(item?.remaining ?? (monthlyLimit - spent)) || 0;
        const percentage = monthlyLimit > 0 ? Math.round((spent / monthlyLimit) * 100) : 0;
        const isOverBudget = spent > monthlyLimit;
        const category = String(item?.category ?? '未分类');
        return { category, monthlyLimit, spent, remaining, percentage, isOverBudget };
      });

      setBudgetStatus(mapped);
    } catch (error) {
      console.error('获取预算状态失败:', error);
      setBudgetStatus([]);
    }
  }, []);

  // 生成通知
  const generateNotifications = useCallback(() => {
    const newNotifications: NotificationItem[] = [];
    const now = new Date();

    // 预算超支通知
    if (settings.budgetAlerts) {
      budgetStatus.forEach(budget => {
        if (budget.isOverBudget) {
          newNotifications.push({
            id: `budget-${budget.category}-${Date.now()}`,
            type: 'budget',
            title: '预算超支提醒',
            message: `${budget.category} 分类本月支出已超出预算 ¥${(budget.spent - budget.monthlyLimit).toFixed(2)}`,
            timestamp: now.toISOString(),
            read: false,
            priority: 'high',
            category: budget.category,
            amount: budget.spent - budget.monthlyLimit
          });
        } else if (budget.percentage >= settings.nearBudgetThreshold) {
          newNotifications.push({
            id: `budget-${budget.category}-${Date.now()}`,
            type: 'budget',
            title: '预算告急提醒',
            message: `${budget.category} 分类预算使用率已达 ${budget.percentage}%`,
            timestamp: now.toISOString(),
            read: false,
            priority: 'medium',
            category: budget.category,
            amount: budget.remaining
          });
        }
      });
    }

    // 定期报告通知
    if (settings.weeklyReport && now.getDay() === 1) { // 周一
      newNotifications.push({
        id: `weekly-report-${Date.now()}`,
        type: 'report',
        title: '周度财务报告',
        message: '本周财务报告已生成，点击查看详细分析',
        timestamp: now.toISOString(),
        read: false,
        priority: 'low'
      });
    }

    if (settings.monthlyReport && now.getDate() === 1) { // 每月1号
      newNotifications.push({
        id: `monthly-report-${Date.now()}`,
        type: 'report',
        title: '月度财务报告',
        message: '月度财务报告已生成，包含详细收支分析和预算执行情况',
        timestamp: now.toISOString(),
        read: false,
        priority: 'low'
      });
    }

    setNotifications(prev => [...newNotifications, ...prev]);
  }, [budgetStatus, settings]);

  // 标记通知为已读
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  // 标记所有通知为已读
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // 删除通知
  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // 保存通知设置
  const saveSettings = async (values: NotificationSettings) => {
    try {
      // 这里可以调用API保存设置
      setSettings(values);
      setSettingsModalVisible(false);
      message.success('通知设置已保存');
    } catch (error) {
      message.error('保存设置失败');
    }
  };

  // 获取通知图标
  const getNotificationIcon = (type: string, priority: string) => {
    if (type === 'budget') {
      return priority === 'high' ? <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> : <WarningOutlined style={{ color: '#faad14' }} />;
    }
    if (type === 'report') {
      return <FileTextOutlined style={{ color: '#1890ff' }} />;
    }
    return <BellOutlined style={{ color: '#52c41a' }} />;
  };

  // 获取优先级标签颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'blue';
      default: return 'default';
    }
  };

  useEffect(() => {
    fetchBudgetStatus();
  }, [fetchBudgetStatus, refreshKey]);

  useEffect(() => {
    generateNotifications();
  }, [generateNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const tabItems = [
    {
      key: 'alerts',
      label: (
        <Badge count={unreadCount} size="small">
          <span>预算提醒</span>
        </Badge>
      ),
      children: (
        <div>
          {/* 预算超支警告 */}
          {budgetStatus.filter(item => item.isOverBudget).length > 0 && (
            <Alert
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="预算超支提醒"
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>
                    以下分类本月支出已超出预算，建议控制开支：
                  </div>
                  {budgetStatus.filter(item => item.isOverBudget).map(item => (
                    <div key={item.category} style={{ marginBottom: 4 }}>
                      <Space>
                        <Text strong>{item.category}</Text>
                        <Text type="danger">
                          超支 ¥{(item.spent - item.monthlyLimit).toFixed(2)}
                        </Text>
                        <Text type="secondary">
                          (预算: ¥{item.monthlyLimit.toFixed(2)}, 已用: ¥{item.spent.toFixed(2)})
                        </Text>
                      </Space>
                    </div>
                  ))}
                </div>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 接近预算警告 */}
          {budgetStatus.filter(item => !item.isOverBudget && item.percentage >= settings.nearBudgetThreshold).length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message="预算告急提醒"
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>
                    以下分类预算使用率已超过{settings.nearBudgetThreshold}%，请注意控制支出：
                  </div>
                  {budgetStatus.filter(item => !item.isOverBudget && item.percentage >= settings.nearBudgetThreshold).map(item => (
                    <div key={item.category} style={{ marginBottom: 8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Space>
                          <Text strong>{item.category}</Text>
                          <Text>
                            剩余 ¥{item.remaining.toFixed(2)}
                          </Text>
                        </Space>
                      </div>
                      <Progress
                        percent={item.percentage}
                        status="active"
                        strokeColor="#faad14"
                        format={(percent) => `${percent}%`}
                        size="small"
                      />
                    </div>
                  ))}
                </div>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 全部正常的情况 */}
          {budgetStatus.filter(item => item.isOverBudget || item.percentage >= settings.nearBudgetThreshold).length === 0 && (
            <Alert
              type="success"
              showIcon
              message="预算状况良好"
              description="所有分类支出均在预算范围内，继续保持理性消费！"
              style={{ marginBottom: 12 }}
            />
          )}
        </div>
      )
    },
    {
      key: 'notifications',
      label: '通知中心',
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5} style={{ margin: 0 }}>通知列表</Title>
            <Space>
              <Button size="small" onClick={markAllAsRead}>全部标记为已读</Button>
              <Button size="small" danger onClick={() => setNotifications([])}>清空通知</Button>
            </Space>
          </div>
          
          {notifications.length === 0 ? (
            <Empty description="暂无通知" />
          ) : (
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button 
                      key="read" 
                      size="small" 
                      type="link"
                      onClick={() => markAsRead(item.id)}
                      disabled={item.read}
                    >
                      {item.read ? '已读' : '标记已读'}
                    </Button>,
                    <Button 
                      key="delete" 
                      size="small" 
                      type="link" 
                      danger
                      onClick={() => deleteNotification(item.id)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={getNotificationIcon(item.type, item.priority)}
                    title={
                      <Space>
                        <Text strong={!item.read}>{item.title}</Text>
                        <Tag color={getPriorityColor(item.priority)}>
                          {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                        </Tag>
                        {!item.read && <Badge status="processing" />}
                      </Space>
                    }
                    description={
                      <div>
                        <div>{item.message}</div>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            <ClockCircleOutlined /> {dayjs(item.timestamp).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          {item.category && (
                            <Tag style={{ marginLeft: 8 }}>
                              <CalendarOutlined /> {item.category}
                            </Tag>
                          )}
                          {item.amount && (
                            <Tag color="red" style={{ marginLeft: 8 }}>
                              <DollarOutlined /> ¥{item.amount.toFixed(2)}
                            </Tag>
                          )}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )
    },
    {
      key: 'settings',
      label: '通知设置',
      children: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>通知偏好设置</Title>
            <Text type="secondary">自定义您的通知接收方式和频率</Text>
          </div>
          
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text strong>预算提醒</Text>
                <Switch 
                  checked={settings.budgetAlerts} 
                  onChange={(checked) => setSettings(prev => ({ ...prev, budgetAlerts: checked }))}
                  style={{ marginLeft: 16 }}
                />
              </div>
              
              <div>
                <Text strong>周度报告</Text>
                <Switch 
                  checked={settings.weeklyReport} 
                  onChange={(checked) => setSettings(prev => ({ ...prev, weeklyReport: checked }))}
                  style={{ marginLeft: 16 }}
                />
              </div>
              
              <div>
                <Text strong>月度报告</Text>
                <Switch 
                  checked={settings.monthlyReport} 
                  onChange={(checked) => setSettings(prev => ({ ...prev, monthlyReport: checked }))}
                  style={{ marginLeft: 16 }}
                />
              </div>
            </Space>
          </Card>

          <Card size="small" style={{ marginBottom: 16 }}>
            <Title level={5}>阈值设置</Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text>预算告急阈值：</Text>
                <Select
                  value={settings.nearBudgetThreshold}
                  onChange={(value) => setSettings(prev => ({ ...prev, nearBudgetThreshold: value }))}
                  style={{ width: 100, marginLeft: 8 }}
                >
                  <Option value={70}>70%</Option>
                  <Option value={80}>80%</Option>
                  <Option value={90}>90%</Option>
                </Select>
              </div>
              
              <div>
                <Text>报告时间：</Text>
                <TimePicker
                  value={dayjs(settings.reportTime, 'HH:mm')}
                  onChange={(time) => setSettings(prev => ({ 
                    ...prev, 
                    reportTime: time ? time.format('HH:mm') : '09:00' 
                  }))}
                  format="HH:mm"
                  style={{ marginLeft: 8 }}
                />
              </div>
            </Space>
          </Card>

          <Button type="primary" onClick={() => setSettingsModalVisible(true)}>
            <SettingOutlined /> 高级设置
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <Card 
        title={
          <Space>
            <BellOutlined />
            <span>通知系统</span>
            {unreadCount > 0 && (
              <Badge count={unreadCount} size="small" />
            )}
          </Space>
        }
        extra={
          <Button 
            type="text" 
            icon={<SettingOutlined />}
            onClick={() => setSettingsModalVisible(true)}
          >
            设置
          </Button>
        }
      >
        <Tabs items={tabItems} defaultActiveKey="alerts" />
      </Card>

      {/* 高级设置模态框 */}
      <Modal
        title="高级通知设置"
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={settings}
          onFinish={saveSettings}
        >
          <Form.Item label="预算告急阈值" name="nearBudgetThreshold">
            <Select>
              <Option value={70}>70%</Option>
              <Option value={80}>80%</Option>
              <Option value={90}>90%</Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="报告生成时间" name="reportTime">
            <TimePicker format="HH:mm" />
          </Form.Item>
          
          <Form.Item label="周报生成日期" name="reportDay">
            <Select>
              <Option value="monday">周一</Option>
              <Option value="sunday">周日</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationSystem;
