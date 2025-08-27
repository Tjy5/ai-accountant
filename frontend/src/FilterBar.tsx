import React from 'react';
import { Input, Select, DatePicker, Row, Col, Card } from 'antd';

const { RangePicker } = DatePicker;

export interface FilterParams {
  keyword?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

interface FilterBarProps {
  onFilterChange: (filters: FilterParams) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ onFilterChange }) => {
  const [filters, setFilters] = React.useState<FilterParams>({
    keyword: '',
    type: 'all',
    startDate: undefined,
    endDate: undefined
  });

  const handleFilterChange = (key: keyof FilterParams, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // 清理空值
    const cleanFilters: FilterParams = {};
    if (newFilters.keyword && newFilters.keyword.trim()) {
      cleanFilters.keyword = newFilters.keyword.trim();
    }
    if (newFilters.type && newFilters.type !== 'all') {
      cleanFilters.type = newFilters.type;
    }
    if (newFilters.startDate) {
      cleanFilters.startDate = newFilters.startDate;
    }
    if (newFilters.endDate) {
      cleanFilters.endDate = newFilters.endDate;
    }
    
    onFilterChange(cleanFilters);
  };

  const handleKeywordSearch = (value: string) => {
    handleFilterChange('keyword', value);
  };

  const handleTypeChange = (value: string) => {
    handleFilterChange('type', value);
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      const newFilters = { 
        ...filters, 
        startDate, 
        endDate 
      };
      setFilters(newFilters);
      
      // 清理空值并传递
      const cleanFilters: FilterParams = {};
      if (newFilters.keyword && newFilters.keyword.trim()) {
        cleanFilters.keyword = newFilters.keyword.trim();
      }
      if (newFilters.type && newFilters.type !== 'all') {
        cleanFilters.type = newFilters.type;
      }
      if (startDate) {
        cleanFilters.startDate = startDate;
      }
      if (endDate) {
        cleanFilters.endDate = endDate;
      }
      
      onFilterChange(cleanFilters);
    } else {
      // 清空日期筛选
      const newFilters = { 
        ...filters, 
        startDate: undefined, 
        endDate: undefined 
      };
      setFilters(newFilters);
      
      const cleanFilters: FilterParams = {};
      if (newFilters.keyword && newFilters.keyword.trim()) {
        cleanFilters.keyword = newFilters.keyword.trim();
      }
      if (newFilters.type && newFilters.type !== 'all') {
        cleanFilters.type = newFilters.type;
      }
      
      onFilterChange(cleanFilters);
    }
  };

  return (
    <Card title="筛选条件" size="small" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Input.Search
            placeholder="搜索关键词（分类或备注）"
            allowClear
            onSearch={handleKeywordSearch}
            onChange={(e) => {
              if (!e.target.value) {
                handleKeywordSearch('');
              }
            }}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Select
            placeholder="选择交易类型"
            value={filters.type}
            onChange={handleTypeChange}
            style={{ width: '100%' }}
            options={[
              { label: '全部', value: 'all' },
              { label: '收入', value: 'income' },
              { label: '支出', value: 'expense' }
            ]}
          />
        </Col>
        <Col xs={24} sm={8}>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={handleDateRangeChange}
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
          />
        </Col>
      </Row>
    </Card>
  );
};

export default FilterBar;