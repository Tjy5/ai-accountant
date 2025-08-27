import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Input, 
  Select, 
  DatePicker, 
  Row, 
  Col, 
  Button, 
  Space, 
  Tag, 
  Typography, 
  Divider,
  Slider,
  message,
  Badge,
  Drawer,
  List,
  InputNumber,
  Tabs
} from 'antd';
import { 
  SearchOutlined, 
  SaveOutlined, 
  HistoryOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  ClearOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;

export interface EnhancedFilterParams {
  keyword?: string;
  type?: 'income' | 'expense' | 'all';
  category?: string[];
  startDate?: string;
  endDate?: string;
  amountRange?: [number, number];
  description?: string;
  tags?: string[];
  isAdvanced?: boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: EnhancedFilterParams;
  isDefault?: boolean;
  isFavorite?: boolean;
  createdAt: string;
  usageCount: number;
}

interface EnhancedSearchProps {
  onFilterChange: (filters: EnhancedFilterParams) => void;
  categories?: string[];
}

const EnhancedSearch: React.FC<EnhancedSearchProps> = ({
  onFilterChange,
  categories = []
}) => {
  const [filters, setFilters] = useState<EnhancedFilterParams>({
    keyword: '',
    type: 'all',
    category: [],
    startDate: undefined,
    endDate: undefined,
    amountRange: [0, 10000],
    description: '',
    tags: [],
    isAdvanced: false
  });

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saveFilterModal, setSaveFilterModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 获取保存的筛选条件
  useEffect(() => {
    const saved = localStorage.getItem('savedFilters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (error) {
        console.error('解析保存的筛选条件失败:', error);
      }
    }

    const history = localStorage.getItem('searchHistory');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (error) {
        console.error('解析搜索历史失败:', error);
      }
    }
  }, []);

  // 保存筛选条件到本地存储
  const saveToLocalStorage = useCallback((filters: SavedFilter[]) => {
    localStorage.setItem('savedFilters', JSON.stringify(filters));
  }, []);

  // 保存搜索历史到本地存储
  const saveHistoryToLocalStorage = useCallback((history: string[]) => {
    localStorage.setItem('searchHistory', JSON.stringify(history));
  }, []);

  // 处理筛选条件变化
  const handleFilterChange = useCallback((key: keyof EnhancedFilterParams, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // 清理空值
    const cleanFilters: EnhancedFilterParams = {};
    if (newFilters.keyword && newFilters.keyword.trim()) {
      cleanFilters.keyword = newFilters.keyword.trim();
    }
    if (newFilters.type && newFilters.type !== 'all') {
      cleanFilters.type = newFilters.type;
    }
    if (newFilters.category && newFilters.category.length > 0) {
      cleanFilters.category = newFilters.category;
    }
    if (newFilters.startDate) {
      cleanFilters.startDate = newFilters.startDate;
    }
    if (newFilters.endDate) {
      cleanFilters.endDate = newFilters.endDate;
    }
    if (newFilters.amountRange && (newFilters.amountRange[0] > 0 || newFilters.amountRange[1] < 10000)) {
      cleanFilters.amountRange = newFilters.amountRange;
    }
    if (newFilters.description && newFilters.description.trim()) {
      cleanFilters.description = newFilters.description.trim();
    }
    if (newFilters.tags && newFilters.tags.length > 0) {
      cleanFilters.tags = newFilters.tags;
    }
    
    onFilterChange(cleanFilters);
  }, [filters, onFilterChange]);

  // 关键词搜索
  const handleKeywordSearch = useCallback((value: string) => {
    handleFilterChange('keyword', value);
    
    // 保存到搜索历史
    if (value.trim()) {
      const newHistory = [value.trim(), ...searchHistory.filter(h => h !== value.trim())].slice(0, 10);
      setSearchHistory(newHistory);
      saveHistoryToLocalStorage(newHistory);
    }
  }, [handleFilterChange, searchHistory, saveHistoryToLocalStorage]);

  // 清空所有筛选条件
  const clearAllFilters = useCallback(() => {
    const clearedFilters: EnhancedFilterParams = {
      keyword: '',
      type: 'all',
      category: [],
      startDate: undefined,
      endDate: undefined,
      amountRange: [0, 10000],
      description: '',
      tags: [],
      isAdvanced: false
    };
    setFilters(clearedFilters);
    onFilterChange({});
  }, [onFilterChange]);

  // 保存筛选条件
  const handleSaveFilter = useCallback(() => {
    if (!filterName.trim()) {
      message.warning('请输入筛选条件名称');
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filters: { ...filters },
      isDefault: false,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      usageCount: 0
    };

    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    saveToLocalStorage(updatedFilters);
    setSaveFilterModal(false);
    setFilterName('');
    message.success('筛选条件保存成功');
  }, [filterName, filters, savedFilters, saveToLocalStorage]);

  // 应用保存的筛选条件
  const applySavedFilter = useCallback((savedFilter: SavedFilter) => {
    setFilters(savedFilter.filters);
    onFilterChange(savedFilter.filters);
    
    // 增加使用次数
    const updatedFilters = savedFilters.map(f => 
      f.id === savedFilter.id 
        ? { ...f, usageCount: f.usageCount + 1 }
        : f
    );
    setSavedFilters(updatedFilters);
    saveToLocalStorage(updatedFilters);
    
    message.success(`已应用筛选条件: ${savedFilter.name}`);
  }, [savedFilters, onFilterChange, saveToLocalStorage]);

  // 删除保存的筛选条件
  const deleteSavedFilter = useCallback((id: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updatedFilters);
    saveToLocalStorage(updatedFilters);
    message.success('筛选条件删除成功');
  }, [savedFilters, saveToLocalStorage]);

  // 切换收藏状态
  const toggleFavorite = useCallback((id: string) => {
    const updatedFilters = savedFilters.map(f => 
      f.id === id ? { ...f, isFavorite: !f.isFavorite } : f
    );
    setSavedFilters(updatedFilters);
    saveToLocalStorage(updatedFilters);
  }, [savedFilters, saveToLocalStorage]);

  // 从搜索历史中选择
  const selectFromHistory = useCallback((keyword: string) => {
    handleFilterChange('keyword', keyword);
  }, [handleFilterChange]);

  // 渲染高级筛选选项
  const renderAdvancedFilters = () => (
    <div style={{ marginTop: 16 }}>
      <Divider orientation="left">高级筛选</Divider>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Text strong>分类筛选</Text>
          <Select
            mode="multiple"
            placeholder="选择分类"
            value={filters.category}
            onChange={(value) => handleFilterChange('category', value)}
            style={{ width: '100%', marginTop: 8 }}
            options={categories.map(cat => ({ label: cat, value: cat }))}
            maxTagCount="responsive"
          />
        </Col>
        <Col xs={24} sm={12}>
          <Text strong>金额范围</Text>
          <div style={{ marginTop: 8 }}>
            <Slider
              range
              min={0}
              max={10000}
              step={100}
              value={filters.amountRange}
              onChange={(value) => handleFilterChange('amountRange', value)}
              tipFormatter={(value) => `¥${value}`}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <InputNumber
                placeholder="最小金额"
                value={filters.amountRange?.[0]}
                onChange={(value) => handleFilterChange('amountRange', [value || 0, filters.amountRange?.[1] || 10000])}
                style={{ width: '50%' }}
                min={0}
                max={filters.amountRange?.[1] || 10000}
              />
              <InputNumber
                placeholder="最大金额"
                value={filters.amountRange?.[1]}
                onChange={(value) => handleFilterChange('amountRange', [filters.amountRange?.[0] || 0, value || 10000])}
                style={{ width: '50%' }}
                min={filters.amountRange?.[0] || 0}
                max={10000}
              />
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <Text strong>备注搜索</Text>
          <Input
            placeholder="搜索备注内容"
            value={filters.description}
            onChange={(e) => handleFilterChange('description', e.target.value)}
            style={{ width: '100%', marginTop: 8 }}
            allowClear
          />
        </Col>
        <Col xs={24} sm={12}>
          <Text strong>标签筛选</Text>
          <Select
            mode="tags"
            placeholder="输入或选择标签"
            value={filters.tags}
            onChange={(value) => handleFilterChange('tags', value)}
            style={{ width: '100%', marginTop: 8 }}
            maxTagCount="responsive"
            tokenSeparators={[',', '，', ';', '；', ' ']}
            open={false}
          />
        </Col>
      </Row>
    </div>
  );

  // 渲染保存的筛选条件列表
  const renderSavedFilters = () => (
    <List
      size="small"
      dataSource={savedFilters}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button
              key="apply"
              type="link"
              size="small"
              onClick={() => applySavedFilter(item)}
            >
              应用
            </Button>,
            <Button
              key="favorite"
              type="text"
              size="small"
              icon={item.isFavorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => toggleFavorite(item.id)}
            />,
            <Button
              key="delete"
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => deleteSavedFilter(item.id)}
            />
          ]}
        >
          <List.Item.Meta
            title={
              <Space>
                <Text strong>{item.name}</Text>
                {item.isFavorite && <Tag color="gold">收藏</Tag>}
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  使用 {item.usageCount} 次
                </Text>
              </Space>
            }
            description={
              <div>
                <div style={{ marginBottom: 4 }}>
                  {item.filters.keyword && <Tag color="blue">关键词: {item.filters.keyword}</Tag>}
                  {item.filters.type && item.filters.type !== 'all' && (
                    <Tag color="green">{item.filters.type === 'income' ? '收入' : '支出'}</Tag>
                  )}
                  {item.filters.category && item.filters.category.length > 0 && (
                    <Tag color="purple">分类: {item.filters.category.join(', ')}</Tag>
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );

  // 渲染搜索历史
  const renderSearchHistory = () => (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Text strong>搜索历史</Text>
        <Button
          type="text"
          size="small"
          onClick={() => {
            setSearchHistory([]);
            saveHistoryToLocalStorage([]);
          }}
          style={{ marginLeft: 8 }}
        >
          清空
        </Button>
      </div>
      <Space wrap size="small">
        {searchHistory.map((keyword, index) => (
          <Tag
            key={index}
            style={{ cursor: 'pointer' }}
            onClick={() => selectFromHistory(keyword)}
          >
            {keyword}
          </Tag>
        ))}
      </Space>
    </div>
  );

  return (
    <div>
      <Card 
        title={
          <Space>
            <SearchOutlined />
            <span>智能搜索</span>
            <Badge count={Object.keys(filters).filter(k => filters[k as keyof EnhancedFilterParams]).length} />
          </Space>
        }
        size="small" 
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button
              type="text"
              icon={showAdvanced ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '隐藏' : '显示'}高级
            </Button>
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => setDrawerVisible(true)}
            >
              历史
            </Button>
            <Button
              type="text"
              icon={<SaveOutlined />}
              onClick={() => setSaveFilterModal(true)}
            >
              保存
            </Button>
            <Button
              type="text"
              icon={<ClearOutlined />}
              onClick={clearAllFilters}
            >
              清空
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Input.Search
              placeholder="搜索关键词（分类、备注、金额等）"
              allowClear
              value={filters.keyword}
              onSearch={handleKeywordSearch}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
              style={{ width: '100%' }}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select
              placeholder="选择交易类型"
              value={filters.type}
              onChange={(value) => handleFilterChange('type', value)}
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
              value={filters.startDate && filters.endDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : undefined}
              onChange={(dates) => {
                if (dates && dates.length === 2) {
                  handleFilterChange('startDate', dates[0]?.format('YYYY-MM-DD'));
                  handleFilterChange('endDate', dates[1]?.format('YYYY-MM-DD'));
                } else {
                  handleFilterChange('startDate', undefined);
                  handleFilterChange('endDate', undefined);
                }
              }}
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Col>
        </Row>

        {showAdvanced && renderAdvancedFilters()}
      </Card>

      {/* 保存筛选条件模态框 */}
      <Drawer
        title="保存筛选条件"
        open={saveFilterModal}
        onClose={() => setSaveFilterModal(false)}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>筛选条件名称</Text>
          <Input
            placeholder="请输入筛选条件名称"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>当前筛选条件</Text>
          <div style={{ marginTop: 8 }}>
            {filters.keyword && <Tag color="blue">关键词: {filters.keyword}</Tag>}
            {filters.type && filters.type !== 'all' && (
              <Tag color="green">{filters.type === 'income' ? '收入' : '支出'}</Tag>
            )}
            {filters.category && filters.category.length > 0 && (
              <Tag color="purple">分类: {filters.category.join(', ')}</Tag>
            )}
            {filters.startDate && <Tag color="orange">开始: {filters.startDate}</Tag>}
            {filters.endDate && <Tag color="orange">结束: {filters.endDate}</Tag>}
            {filters.amountRange && (filters.amountRange[0] > 0 || filters.amountRange[1] < 10000) && (
              <Tag color="red">金额: ¥{filters.amountRange[0]}-¥{filters.amountRange[1]}</Tag>
            )}
          </div>
        </div>
        <Button type="primary" block onClick={handleSaveFilter}>
          保存筛选条件
        </Button>
      </Drawer>

      {/* 搜索历史和保存的筛选条件抽屉 */}
      <Drawer
        title="搜索历史和保存的筛选条件"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        <Tabs
          items={[
            {
              key: 'history',
              label: '搜索历史',
              children: renderSearchHistory()
            },
            {
              key: 'saved',
              label: (
                <span>
                  保存的筛选条件
                  <Badge count={savedFilters.length} style={{ marginLeft: 8 }} />
                </span>
              ),
              children: renderSavedFilters()
            }
          ]}
        />
      </Drawer>
    </div>
  );
};

export default EnhancedSearch;
