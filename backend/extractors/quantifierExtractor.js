/**
 * 数量词提取器
 * 负责从文本中提取数量词和单位信息
 */

/**
 * 从文本中提取数量词实体
 * @param {string} text - 输入文本
 * @returns {Array} 数量词实体数组
 */
function extractQuantifiers(text) {
  const quantifiers = [];
  
  // 识别数量词 - 更全面的识别
  const quantifierWords = [
    // 基础数量
    '一个', '两个', '三个', '四个', '五个', '六个', '七个', '八个', '九个', '十个',
    // 重量单位
    '一斤', '半斤', '二斤', '三斤', '四斤', '五斤', '六斤', '七斤', '八斤', '九斤', '十斤',
    '一公斤', '半公斤', '二公斤', '三公斤',
    // 特殊单位
    '一打', '半打', '二打', '三打',
    '一双', '一对', '二双', '三双',
    '一套', '二套', '三套',
    '一包', '二包', '三包',
    '一盒', '二盒', '三盒',
    '一瓶', '二瓶', '三瓶',
    '一罐', '二罐', '三罐',
    // 模糊数量
    '一些', '很多', '几件', '几双', '几斤', '几包', '几盒', '几瓶', '几罐',
    '不少', '大量', '少量', '若干'
  ];
  
  for (const quantifier of quantifierWords) {
    if (text.includes(quantifier)) {
      quantifiers.push({
        text: quantifier,
        value: parseQuantifierValue(quantifier),
        confidence: 0.9,
        position: text.indexOf(quantifier)
      });
    }
  }
  
  return quantifiers;
}

/**
 * 解析数量词值 - 增强版
 * @param {string} quantifier - 数量词
 * @returns {number} 解析后的数值
 */
function parseQuantifierValue(quantifier) {
  const numberMap = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '半': 0.5, '零': 0
  };
  
  const specialMap = {
    // 打
    '一打': 12, '半打': 6, '二打': 24, '三打': 36,
    // 双/对
    '一双': 2, '一对': 2, '二双': 4, '三双': 6, '二对': 4, '三对': 6,
    // 套
    '一套': 1, '二套': 2, '三套': 3,
    // 包
    '一包': 1, '二包': 2, '三包': 3,
    // 盒
    '一盒': 1, '二盒': 2, '三盒': 3,
    // 瓶
    '一瓶': 1, '二瓶': 2, '三瓶': 3,
    // 罐
    '一罐': 1, '二罐': 2, '三罐': 3,
    // 斤
    '一斤': 1, '半斤': 0.5, '二斤': 2, '三斤': 3, '四斤': 4, '五斤': 5,
    '六斤': 6, '七斤': 7, '八斤': 8, '九斤': 9, '十斤': 10,
    // 公斤
    '一公斤': 1, '半公斤': 0.5, '二公斤': 2, '三公斤': 3
  };
  
  // 先检查特殊映射
  if (specialMap[quantifier]) return specialMap[quantifier];
  
  // 检查单个数字
  if (numberMap[quantifier]) return numberMap[quantifier];
  
  // 检查阿拉伯数字
  const arabicMatch = quantifier.match(/(\d+(?:\.\d+)?)/);
  if (arabicMatch) return parseFloat(arabicMatch[1]);
  
  // 模糊数量词
  const fuzzyMap = {
    '一些': 3, '很多': 10, '几件': 3, '几双': 3, '几斤': 3, '几包': 3, '几盒': 3, '几瓶': 3, '几罐': 3,
    '不少': 5, '大量': 15, '少量': 2, '若干': 4
  };
  
  if (fuzzyMap[quantifier]) return fuzzyMap[quantifier];
  
  // 默认返回1
  return 1;
}

module.exports = {
  extractQuantifiers,
  parseQuantifierValue
};
