import React, { useState, useEffect, useMemo } from 'react';
import { Pagination, Select, Space, Typography, Card, Row, Col, Statistic } from 'antd';
import { TABLE } from '../constants/ui';
import { ClockCircleOutlined, BarChartOutlined } from '@ant-design/icons';

interface SmartPaginationProps {
  total: number;
  current: number;
  pageSize: number;
  onChange: (page: number, size: number) => void;
  showQuickJumper?: boolean;
  showSizeChanger?: boolean;
  showStatistics?: boolean;
  loading?: boolean;
}

const SmartPagination: React.FC<SmartPaginationProps> = ({
  total,
  current,
  pageSize,
  onChange,
  showQuickJumper = true,
  showSizeChanger = true,
  showStatistics = true,
  loading = false
}) => {
  const [renderTime, setRenderTime] = useState<number>(0);

  // 计算统计信息
  const statistics = useMemo(() => {
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (current - 1) * pageSize + 1;
    const endIndex = Math.min(current * pageSize, total);
    
    return {
      totalPages,
      startIndex,
      endIndex,
      currentPageItems: endIndex - startIndex + 1
    };
  }, [total, current, pageSize]);

  // 性能监控
  useEffect(() => {
    const start = performance.now();
    
    const timer = setTimeout(() => {
      const end = performance.now();
      setRenderTime(end - start);
    }, 0);

    return () => clearTimeout(timer);
  }, [current, pageSize]);

  // 推荐的页面大小
  const recommendedPageSizes = useMemo(() => {
    const sizes = [...TABLE.pageSizeOptions];
    
    // 根据总数据量智能推荐
    if (total > 1000) {
      sizes.push('200');
    }
    if (total > 5000) {
      sizes.push('500');
    }
    
    return sizes;
  }, [total]);

  // 自定义分页文本
  const showTotal = (total: number, range: [number, number]) => {
    return (
      <Space>
        <span style={{ color: '#666' }}>
          显示 <strong style={{ color: '#1890ff' }}>{range[0]}-{range[1]}</strong> 条
        </span>
        <span style={{ color: '#666' }}>
          共 <strong style={{ color: '#52c41a' }}>{total}</strong> 条记录
        </span>
        {renderTime > 0 && (
          <span style={{ color: '#999', fontSize: '12px' }}>
            <ClockCircleOutlined /> {renderTime.toFixed(1)}ms
          </span>
        )}
      </Space>
    );
  };

  return (
    <div className="smart-pagination-container">
      {showStatistics && (
        <Card 
          size="small" 
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="当前页"
                value={current}
                suffix={`/ ${statistics.totalPages}`}
                prefix={<BarChartOutlined />}
                valueStyle={{ fontSize: '16px' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="本页记录"
                value={statistics.currentPageItems}
                suffix="条"
                valueStyle={{ fontSize: '16px', color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="总记录数"
                value={total}
                suffix="条"
                valueStyle={{ fontSize: '16px', color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="总页数"
                value={statistics.totalPages}
                suffix="页"
                valueStyle={{ fontSize: '16px', color: '#722ed1' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          {showSizeChanger && (
            <Space>
              <Typography.Text style={{ color: '#666' }}>每页显示:</Typography.Text>
              <Select
                value={pageSize.toString()}
                onChange={(value) => onChange(1, parseInt(value))}
                style={{ width: 80 }}
                options={recommendedPageSizes.map(size => ({
                  label: size,
                  value: size
                }))}
                loading={loading}
              />
              <Typography.Text style={{ color: '#666' }}>条</Typography.Text>
            </Space>
          )}
        </div>

        <Pagination
          current={current}
          total={total}
          pageSize={pageSize}
          onChange={onChange}
          showQuickJumper={showQuickJumper}
          showSizeChanger={false} // 我们用自定义的 size changer
          showTotal={showTotal}
          disabled={loading}
          responsive={true}
          hideOnSinglePage={false}
          showLessItems={window.innerWidth < 768} // 移动端显示更少的页码
        />
      </div>

      {/* 快捷跳转提示 */}
      {showQuickJumper && statistics.totalPages > 10 && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px 12px', 
          backgroundColor: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#52c41a'
        }}>
          💡 提示: 数据较多时，可以使用快速跳转功能直接跳转到指定页面
        </div>
      )}
    </div>
  );
};

export default SmartPagination;
