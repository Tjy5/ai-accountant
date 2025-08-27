import React, { useEffect, useMemo } from 'react';
import { Alert, Typography, Space, Progress, Row, Col, Card, Statistic, Badge } from 'antd';
import { WarningOutlined, ExclamationCircleOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { BudgetStatus } from './types/budget';
import { 
  ALERT_LEVELS,
  ALERT_COLORS,
  DEFAULT_ALERT_THRESHOLDS
} from './constants/budget';
import { formatCurrency, formatPercentage } from './utils/budgetUtils';
import { useBudget } from './hooks/useBudget';

const { Text } = Typography;

interface BudgetAlertsProps {
  refreshKey?: number;
  showHealthScore?: boolean;
  showSummary?: boolean;
  compact?: boolean;
}

interface AlertConfig {
  type: 'error' | 'warning' | 'info' | 'success';
  icon: React.ReactNode;
  title: string;
  description: string;
}

const BudgetAlerts: React.FC<BudgetAlertsProps> = ({ 
  refreshKey, 
  showHealthScore = true,
  showSummary = true,
  compact = false 
}) => {
  const {
    budgetStatus,
    budgetOverview,
    healthScore,
    loading,
    refresh
  } = useBudget({ enableMockData: true, autoRefresh: false });

  useEffect(() => {
    if (refreshKey) {
      refresh();
    }
  }, [refreshKey, refresh]);

  // 分类提醒项
  const alertCategories = useMemo(() => {
    if (!budgetStatus || budgetStatus.length === 0) {
      return {
        overBudget: [],
        danger: [],
        warning: [],
        info: []
      };
    }

    return {
      overBudget: budgetStatus.filter(item => item.alertLevel === ALERT_LEVELS.OVER),
      danger: budgetStatus.filter(item => item.alertLevel === ALERT_LEVELS.DANGER),
      warning: budgetStatus.filter(item => item.alertLevel === ALERT_LEVELS.WARNING),
      info: budgetStatus.filter(item => 
        item.alertLevel === ALERT_LEVELS.SAFE && item.percentage >= 50
      )
    };
  }, [budgetStatus]);

  // 预警配置
  const alertConfigs: AlertConfig[] = useMemo(() => [
    {
      type: 'error',
      icon: <ExclamationCircleOutlined />,
      title: '预算超支提醒',
      description: '以下分类本月支出已超出预算，建议控制开支：'
    },
    {
      type: 'warning',
      icon: <WarningOutlined />,
      title: '预算告急提醒',
      description: `以下分类预算使用率已超过${DEFAULT_ALERT_THRESHOLDS.DANGER}%，请注意控制支出：`
    },
    {
      type: 'warning',
      icon: <WarningOutlined />,
      title: '预算提醒',
      description: `以下分类预算使用率已超过${DEFAULT_ALERT_THRESHOLDS.WARNING}%，建议关注支出情况：`
    },
    {
      type: 'info',
      icon: <InfoCircleOutlined />,
      title: '预算情况提醒',
      description: '以下分类预算使用达到一定比例，建议注意支出管理：'
    }
  ], []);

  // 渲染单个预算项
  const renderBudgetItem = (item: BudgetStatus, showProgress = true) => (
    <div key={item.categoryId} style={{ marginBottom: compact ? 4 : 8 }}>
      <div style={{ marginBottom: 4 }}>
        <Space>
          <Text strong style={{ color: item.categoryColor }}>
            {item.category}
          </Text>
          {item.isOverBudget ? (
            <Text type="danger">
              超支 {formatCurrency(item.spent - item.limit)}
            </Text>
          ) : (
            <Text>
              剩余 {formatCurrency(item.remaining)}
            </Text>
          )}
          {!compact && (
            <Text type="secondary">
              (预算: {formatCurrency(item.limit)}, 已用: {formatCurrency(item.spent)})
            </Text>
          )}
        </Space>
      </div>
      {showProgress && (
        <Progress
          percent={Math.min(item.percentage, 100)}
          status={item.isOverBudget ? 'exception' : 'normal'}
          strokeColor={ALERT_COLORS[item.alertLevel] || '#1890ff'}
          format={(_percent) => `${item.percentage.toFixed(1)}%`}
          size={compact ? 'small' : 'default'}
        />
      )}
      {!compact && item.daysRemaining > 0 && (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          剩余时间: {item.daysRemaining}天
        </Text>
      )}
    </div>
  );

  if (loading || !budgetStatus) {
    return null;
  }

  const hasAlerts = [
    alertCategories.overBudget,
    alertCategories.danger, 
    alertCategories.warning,
    alertCategories.info
  ].some(category => category.length > 0);

  if (!hasAlerts && budgetStatus.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* 健康度分数显示 */}
      {showHealthScore && budgetStatus.length > 0 && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Statistic
                title="预算健康度"
                value={healthScore}
                suffix="分"
                valueStyle={{ 
                  color: healthScore >= 80 ? '#52c41a' : 
                         healthScore >= 60 ? '#faad14' : '#f5222d',
                  fontSize: '20px'
                }}
              />
            </Col>
            <Col span={16}>
              <div>
                <Badge 
                  status={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'error'}
                  text={healthScore >= 80 ? '预算管理状态良好' : 
                        healthScore >= 60 ? '预算管理需要注意' : '预算管理需要紧急关注'}
                />
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    总预算: {formatCurrency(budgetOverview.totalBudget)} | 
                    已使用: {formatCurrency(budgetOverview.totalSpent)} | 
                    使用率: {formatPercentage(budgetOverview.overallPercentage)}
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 超支警告 */}
      {alertCategories.overBudget.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={alertConfigs[0].icon}
          message={alertConfigs[0].title}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {alertConfigs[0].description}
              </div>
              {alertCategories.overBudget.map(item => renderBudgetItem(item, !compact))}
            </div>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 危险警告 */}
      {alertCategories.danger.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={alertConfigs[1].icon}
          message={alertConfigs[1].title}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {alertConfigs[1].description}
              </div>
              {alertCategories.danger.map(item => renderBudgetItem(item, !compact))}
            </div>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 警告提醒 */}
      {alertCategories.warning.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={alertConfigs[2].icon}
          message={alertConfigs[2].title}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {alertConfigs[2].description}
              </div>
              {alertCategories.warning.map(item => renderBudgetItem(item, !compact))}
            </div>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 信息提醒 */}
      {alertCategories.info.length > 0 && !compact && (
        <Alert
          type="info"
          showIcon
          icon={alertConfigs[3].icon}
          message={alertConfigs[3].title}
          description={
            <div>
              <div style={{ marginBottom: 8 }}>
                {alertConfigs[3].description}
              </div>
              {alertCategories.info.map(item => renderBudgetItem(item, false))}
            </div>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 全部正常的情况 */}
      {!hasAlerts && budgetStatus.length > 0 && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="预算状况良好"
          description="所有分类支出均在预算范围内，继续保持理性消费！"
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 预算总览 */}
      {showSummary && budgetStatus.length > 0 && !compact && (
        <Card size="small" title="预算概览">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="安全预算"
                value={budgetStatus.filter(b => b.alertLevel === ALERT_LEVELS.SAFE).length}
                suffix={`/ ${budgetStatus.length}`}
                valueStyle={{ color: '#52c41a', fontSize: '16px' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="需要注意"
                value={budgetStatus.filter(b => b.alertLevel === ALERT_LEVELS.WARNING).length}
                suffix={`/ ${budgetStatus.length}`}
                valueStyle={{ color: '#faad14', fontSize: '16px' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="需要警惕"
                value={budgetStatus.filter(b => b.alertLevel === ALERT_LEVELS.DANGER).length}
                suffix={`/ ${budgetStatus.length}`}
                valueStyle={{ color: '#fa541c', fontSize: '16px' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已经超支"
                value={budgetStatus.filter(b => b.alertLevel === ALERT_LEVELS.OVER).length}
                suffix={`/ ${budgetStatus.length}`}
                valueStyle={{ color: '#f5222d', fontSize: '16px' }}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default BudgetAlerts;