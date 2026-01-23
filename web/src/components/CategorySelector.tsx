import React, { useState, useEffect, useMemo } from 'react';
import { Select, Space, Tag } from 'antd';
import { 
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
  ThunderboltOutlined
} from '@ant-design/icons';
import api from '../utils/api';

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
}

interface CategorySelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  type?: 'income' | 'expense';
  placeholder?: string;
  allowClear?: boolean;
  showSearch?: boolean;
  style?: React.CSSProperties;
  disabled?: boolean;
  onCategoryChange?: () => void; // 新增：分类变化回调
  onNavigateToCategoryManager?: () => void; // 新增：跳转到分类管理页面的回调
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  type = 'expense',
  placeholder = '请选择分类',
  allowClear = true,
  showSearch = true,
  style,
  disabled = false,
  onCategoryChange,
  onNavigateToCategoryManager
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // 图标映射
  const iconMap = {
    HomeOutlined: <HomeOutlined />,
    CarOutlined: <CarOutlined />,
    ShoppingOutlined: <ShoppingOutlined />,
    MedicineBoxOutlined: <MedicineBoxOutlined />,
    GiftOutlined: <GiftOutlined />,
    BankOutlined: <BankOutlined />,
    CreditCardOutlined: <CreditCardOutlined />,
    WalletOutlined: <WalletOutlined />,
    DollarOutlined: <DollarOutlined />,
    TrophyOutlined: <TrophyOutlined />,
    BookOutlined: <BookOutlined />,
    HeartOutlined: <HeartOutlined />,
    StarOutlined: <StarOutlined />,
    FireOutlined: <FireOutlined />,
    ThunderboltOutlined: <ThunderboltOutlined />
  };

  // 获取分类列表 - 与分类管理器保持一致
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ categories: any[] }>(`/api/categories`);
      const backendCategories = (data as any)?.categories || [];
      
      // 使用与分类管理器相同的默认分类列表
      const defaultCategories = getDefaultCategories();
      const mergedCategories = mergeCategories(backendCategories, defaultCategories);
      
      setCategories(mergedCategories);
    } catch (error) {
      console.error('获取分类失败:', error);
      // 使用默认分类
      setCategories(getDefaultCategories());
    } finally {
      setLoading(false);
    }
  };

  // 合并分类函数：确保所有默认分类都存在
  const mergeCategories = (backendCategories: any[], defaultCategories: Category[]): Category[] => {
    const merged = backendCategories.map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon || 'StarOutlined',
      color: c.color || '#1890ff',
      description: c.description || '',
      isDefault: Boolean(c.is_default),
      usageCount: Number(c.usage_count || 0)
    }));
    
    // 为每个默认分类检查是否已存在
    defaultCategories.forEach(defaultCat => {
      const existingIndex = merged.findIndex(cat => 
        cat.name === defaultCat.name && cat.type === defaultCat.type
      );
      
      if (existingIndex === -1) {
        // 如果默认分类不存在，添加到合并列表中
                 merged.push({
           ...defaultCat,
           description: defaultCat.description || ''
         });
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
      // 收入分类
      {
        id: 1,
        name: '工资',
        type: 'income',
        icon: 'DollarOutlined',
        color: '#52c41a',
        description: '工资收入',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 2,
        name: '奖金',
        type: 'income',
        icon: 'TrophyOutlined',
        color: '#faad14',
        description: '奖金、红包等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 3,
        name: '投资收益',
        type: 'income',
        icon: 'StarOutlined',
        color: '#722ed1',
        description: '股票、基金等投资收益',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 4,
        name: '兼职收入',
        type: 'income',
        icon: 'StarOutlined',
        color: '#eb2f96',
        description: '兼职、副业收入',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 5,
        name: '其他收入',
        type: 'income',
        icon: 'HeartOutlined',
        color: '#13c2c2',
        description: '其他收入来源',
        isDefault: true,
        usageCount: 0
      },
      
      // 支出分类 - 日常生活
      {
        id: 6,
        name: '餐饮',
        type: 'expense',
        icon: 'FireOutlined',
        color: '#f5222d',
        description: '日常餐饮消费',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 7,
        name: '交通',
        type: 'expense',
        icon: 'CarOutlined',
        color: '#1890ff',
        description: '交通出行费用',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 8,
        name: '购物',
        type: 'expense',
        icon: 'ShoppingOutlined',
        color: '#52c41a',
        description: '日常用品购买',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 9,
        name: '住房',
        type: 'expense',
        icon: 'HomeOutlined',
        color: '#fa8c16',
        description: '房租、房贷、物业费等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 10,
        name: '水电费',
        type: 'expense',
        icon: 'ThunderboltOutlined',
        color: '#fadb14',
        description: '水费、电费、燃气费等',
        isDefault: true,
        usageCount: 0
      },
      
      // 支出分类 - 娱乐休闲
      {
        id: 11,
        name: '娱乐',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#eb2f96',
        description: '电影、游戏、KTV等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 12,
        name: '旅游',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#13c2c2',
        description: '旅行、度假费用',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 13,
        name: '运动健身',
        type: 'expense',
        icon: 'FireOutlined',
        color: '#fa541c',
        description: '健身房、运动器材等',
        isDefault: true,
        usageCount: 0
      },
      
      // 支出分类 - 医疗健康
      {
        id: 14,
        name: '医疗',
        type: 'expense',
        icon: 'MedicineBoxOutlined',
        color: '#f5222d',
        description: '看病、买药等医疗费用',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 15,
        name: '美容护理',
        type: 'expense',
        icon: 'HeartOutlined',
        color: '#eb2f96',
        description: '美容、护肤、美发等',
        isDefault: true,
        usageCount: 0
      },
      
      // 支出分类 - 教育学习
      {
        id: 16,
        name: '教育',
        type: 'expense',
        icon: 'BookOutlined',
        color: '#722ed1',
        description: '学费、培训、书籍等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 17,
        name: '数码产品',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#1890ff',
        description: '手机、电脑、平板等',
        isDefault: true,
        usageCount: 0
      },
      
      // 支出分类 - 金融服务
      {
        id: 18,
        name: '银行服务',
        type: 'expense',
        icon: 'BankOutlined',
        color: '#52c41a',
        description: '银行手续费、年费等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 19,
        name: '信用卡',
        type: 'expense',
        icon: 'CreditCardOutlined',
        color: '#faad14',
        description: '信用卡年费、利息等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 20,
        name: '投资理财',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#722ed1',
        description: '基金、股票等投资费用',
        isDefault: true,
        usageCount: 0
      },
      
      // 支出分类 - 其他
      {
        id: 21,
        name: '礼物',
        type: 'expense',
        icon: 'GiftOutlined',
        color: '#eb2f96',
        description: '送礼、人情往来',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 22,
        name: '通讯',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#13c2c2',
        description: '话费、网费、流量费等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 23,
        name: '保险',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#fa8c16',
        description: '各类保险费用',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 24,
        name: '宠物',
        type: 'expense',
        icon: 'HeartOutlined',
        color: '#f5222d',
        description: '宠物食品、医疗等',
        isDefault: true,
        usageCount: 0
      },
      {
        id: 25,
        name: '其他支出',
        type: 'expense',
        icon: 'StarOutlined',
        color: '#8c8c8c',
        description: '其他未分类支出',
        isDefault: true,
        usageCount: 0
      }
    ];
  };

  // 根据类型过滤分类
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => 
      cat.type === type || cat.type === 'both'
    );
  }, [categories, type]);

  // 获取图标组件
  const getIconComponent = (iconName: string) => {
    return iconMap[iconName as keyof typeof iconMap] || <StarOutlined />;
  };

  // 渲染选项标签
  const renderOptionLabel = (category: Category) => (
    <Space>
      <span style={{ color: category.color, fontSize: '16px' }}>
        {getIconComponent(category.icon)}
      </span>
      <span>{category.name}</span>
      {category.description && (
        <Tag color="default">
          {category.description}
        </Tag>
      )}
    </Space>
  );

  // 监听分类变化，自动刷新分类列表
  useEffect(() => {
    if (onCategoryChange) {
      fetchCategories();
    }
  }, [onCategoryChange]);

  // 处理选择变化
  const handleSelectChange = (selectedValue: string) => {
    onChange?.(selectedValue);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <Select
      value={value}
      onChange={handleSelectChange}
      placeholder={placeholder}
      allowClear={allowClear}
      showSearch={showSearch}
      style={style}
      disabled={disabled}
      loading={loading}
      
      filterOption={(input, option) => {
        const category = option?.data as Category;
        if (!category) return false;
        return Boolean(
          category.name.toLowerCase().includes(input.toLowerCase()) ||
          (category.description && category.description.toLowerCase().includes(input.toLowerCase()))
        );
      }}
      optionLabelProp="label"
             popupRender={(menu) => (
         <div>
           {menu}
           <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
             <div style={{ 
               fontSize: '12px', 
               color: '#1890ff',
               textAlign: 'center',
               padding: '8px 12px',
               cursor: 'pointer',
               backgroundColor: '#f0f8ff',
               borderRadius: '4px',
               border: '1px solid #d6e4ff',
               margin: '4px 0',
               transition: 'all 0.3s ease'
             }}
             onClick={onNavigateToCategoryManager}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = '#e6f7ff';
               e.currentTarget.style.borderColor = '#91d5ff';
               e.currentTarget.style.transform = 'translateY(-1px)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = '#f0f8ff';
               e.currentTarget.style.borderColor = '#d6e4ff';
               e.currentTarget.style.transform = 'translateY(0)';
             }}
             >
               🔧 管理分类 → 点击前往分类管理页面
             </div>
           </div>
         </div>
       )}
    >
      {filteredCategories.map(category => (
        <Option
          key={category.id}
          value={category.name}
          label={category.name}
          data={category}
        >
          {renderOptionLabel(category)}
        </Option>
      ))}
    </Select>
  );
};

export default CategorySelector;
