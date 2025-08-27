/**
 * 产品提取器
 * 负责从文本中提取产品名称和相关信息
 */

// 从分类映射中生成扁平的产品关键词列表，用于实体识别
const categoryKeywordMap = {
  '餐饮': [
    '早餐', '午餐', '晚餐', '夜宵', '外卖', '食堂', '餐厅', '饭店', '小吃', '快餐',
    '米饭', '面条', '盖浇饭', '炒饭', '炒面', '饺子', '包子', '馄饨', '馒头', '油条',
    '粥', '粉', '汉堡', '披萨', '三明治', '寿司', '沙拉', '烧烤', '火锅', '麻辣烫',
    '炸鸡', '烤肉', '牛排', '海鲜', '家常菜', '工作餐', '聚餐', '请客', '饭', '菜',
    // 品牌/连锁（常见口语触发词）
    '肯德基', 'KFC', 'kfc', '麦当劳', '必胜客', '汉堡王', '德克士', '华莱士', '赛百味'
  ],
  '零食': [
    '零食', '薯片', '饼干', '蛋糕', '甜点', '冰淇淋', '巧克力', '糖果', '坚果', '辣条',
    '鸭脖', '鸡爪', '牛肉干', '豆腐干', '果冻', '布丁', '点心'
  ],
  '烟酒饮料': [
    '奶茶', '咖啡', '饮料', '果汁', '可乐', '雪碧', '矿泉水', '苏打水', '茶', '酸奶',
    '豆浆', '酒', '啤酒', '白酒', '红酒', '洋酒', '鸡尾酒', '香烟', '电子烟'
  ],
  '水果': [
    '水果', '苹果', '香蕉', '西瓜', '火龙果', '橙子', '橘子', '葡萄', '草莓', '桃子',
    '梨', '芒果', '荔枝', '龙眼', '樱桃', '蓝莓', '牛油果', '菠萝', '榴莲'
  ],
  '购物': [
    '衣服', '裤子', '鞋子', '帽子', '外套', '内衣', '袜子', '包包', '饰品', 'T恤',
    '手机', '电脑', '耳机', '充电器', '数据线', '鼠标', '键盘', 'U盘', '相机',
    '游戏', '会员', '订阅', 'App', '皮肤', '装备', '玩具', '模型', '手办', '盲盒'
  ],
  '交通': [
    '地铁', '公交', '出租车', '网约车', '打车', '共享单车', '火车票', '高铁票', '飞机票',
    '加油', '停车费', '过路费', '高速费', '保养', '维修', '洗车', '车险', '罚款'
  ],
  '居住': [
    '房租', '房贷', '物业费', '中介费', '搬家', '酒店', '住宿', '维修', '装修',
    '家具', '家电', '床上用品', '厨具', '装饰品'
  ],
  '水电煤': [
    '水费', '电费', '燃气费', '煤气费', '暖气费', '网费', '宽带费'
  ],
  '话费网费': [
    '话费', '手机费', '流量', '套餐', '网费', '宽带费'
  ],
  '日用品': [
    '洗发水', '沐浴露', '牙膏', '牙刷', '毛巾', '纸巾', '卫生纸', '湿巾', '洗衣液',
    '消毒液', '清洁剂', '垃圾袋', '电池', '口罩', '雨伞', '钥匙'
  ],
  '教育': [
    '学费', '书本费', '教材', '课程', '培训', '考试费', '报名费', '文具', '学杂费'
  ],
  '医疗': [
    '挂号', '门诊', '住院', '药', '感冒药', '维生素', '保健品', '体检', '疫苗',
    '牙科', '眼科', '手术', '医疗保险'
  ],
  '护肤美妆': [
    '护肤品', '化妆品', '洗面奶', '面膜', '口红', '粉底', '眼影', '香水', '防晒霜'
  ],
  '娱乐': [
    '电影', 'KTV', '演唱会', '音乐会', '话剧', '展览', '门票', '旅游', '景点',
    '游戏币', '按摩', '足疗', '美容', '美发', '美甲', '健身', '游泳', '运动'
  ],
  '人情': [
    '红包', '请客', '送礼', '礼金', '份子钱', '孝敬', '慈善', '捐款'
  ],
  '其他': [
    '快递', '邮费', '保险', '银行手续费', '利息', '宠物', '猫粮', '狗粮', '手续费'
  ]
};

const productKeywords = Object.values(categoryKeywordMap).flat();

/**
 * 从文本中提取产品实体
 * @param {string} text - 输入文本
 * @returns {Array} 产品实体数组
 */
function extractProducts(text) {
  const products = [];
  
  // 产品识别 - 增强版, 优先匹配长关键词
  const sortedKeywords = [...productKeywords].sort((a, b) => b.length - a.length);
  const matchedRanges = []; // 用于存储已匹配关键词的范围 [start, end]

  for (const keyword of sortedKeywords) {
    // 使用 indexOf 查找所有出现的关键词
    let lastIndex = -1;
    while ((lastIndex = text.indexOf(keyword, lastIndex + 1)) !== -1) {
      const startIndex = lastIndex;
      const endIndex = startIndex + keyword.length;

      // 检查当前找到的关键词范围是否与已匹配的范围重叠
      const isOverlapping = matchedRanges.some(
        range => startIndex < range[1] && endIndex > range[0]
      );

      // 如果不重叠，则认为是一个有效的、新的产品实体
      if (!isOverlapping) {
        products.push({
          name: keyword,
          confidence: 0.9,
          position: startIndex
        });
        // 记录这个范围，防止其子字符串被再次匹配
        matchedRanges.push([startIndex, endIndex]);
      }
    }
  }
  
  // 特殊处理：识别"吃的"、"买的"等动作后的产品
  const actionProductPatterns = [
    /(?:吃的|买的|要的|点的)(\w+)/g,
    /(\w+)(?:花了|用了|消费了)/g
  ];
  
  actionProductPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const productName = match[1];
      // 检查是否是有效的产品名称
      if (productName.length > 1 && !products.some(p => p.name === productName)) {
        products.push({
          name: productName,
          confidence: 0.85,
          position: text.indexOf(match[0]),
          type: 'action-based'
        });
      }
    }
  });
  
  // 特殊产品识别：票、费等（排除单位词）
  const specialProducts = [
    '票', '费', '东西', '物品', '商品', '产品'
  ];
  
  // 金额单位词，不应该被识别为产品
  const amountUnits = ['钱', '块', '元', '角', '分', '毛'];
  
  specialProducts.forEach(product => {
    if (text.includes(product) && !products.some(p => p.name === product)) {
      // 检查是否在金额单位词附近，避免误识别
      const productIndex = text.indexOf(product);
      const nearbyText = text.substring(Math.max(0, productIndex - 5), productIndex + 6);
      
      // 如果附近有数字或金额模式，则跳过
      if (/\d+/.test(nearbyText) || /[块元角分毛]/.test(nearbyText)) {
        return;
      }
      
      products.push({
        name: product,
        confidence: 0.7,
        position: productIndex,
        type: 'generic'
      });
    }
  });
  
  // 复合产品识别：红烧肉、清炒青菜等
  const compoundProductPatterns = [
    /红烧(\w+)/g,
    /清炒(\w+)/g,
    /糖醋(\w+)/g,
    /麻辣(\w+)/g,
    /(\w+)汤/g,
    /(\w+)面/g,
    /(\w+)饭/g
  ];
  
  compoundProductPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const fullName = match[0];
      const baseName = match[1];
      
      // 检查基础名称是否在产品列表中
      if (productKeywords.includes(baseName) && !products.some(p => p.name === fullName)) {
        products.push({
          name: fullName,
          confidence: 0.85,
          position: text.indexOf(fullName),
          baseProduct: baseName
        });
      }
    }
  });
  
  return products;
}

module.exports = {
  extractProducts,
  categoryKeywordMap,
  productKeywords
};
