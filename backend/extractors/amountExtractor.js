/**
 * 金额提取器
 * 负责从文本中提取各种格式的金额信息
 */

/**
 * 从文本中提取金额实体
 * @param {string} text - 输入文本
 * @returns {Array} 金额实体数组
 */
function extractAmounts(text) {
  const amounts = [];
  
  // 精确匹配：数字+元
  const exactAmountMatches = text.match(/(\d+(?:\.\d+)?)元/g);
  if (exactAmountMatches) {
    exactAmountMatches.forEach(match => {
      const value = parseFloat(match.replace('元', ''));
      amounts.push({
        text: match,
        value: value,
        confidence: 0.95,
        position: text.indexOf(match)
      });
    });
  }
  
  // 识别"块"、"块钱"等表达
  const blockAmountMatches = text.match(/(\d+(?:\.\d+)?)块(?:钱)?/g);
  if (blockAmountMatches) {
    blockAmountMatches.forEach(match => {
      const value = parseFloat(match.replace(/块(?:钱)?/, ''));
      amounts.push({
        text: match,
        value: value,
        confidence: 0.95,
        position: text.indexOf(match)
      });
    });
  }
  
  // 中文数字+块/元
  const chineseNumberMap = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
    '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25, '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30,
    '三十一': 31, '三十二': 32, '三十三': 33, '三十四': 34, '三十五': 35, '三十六': 36, '三十七': 37, '三十八': 38, '三十九': 39, '四十': 40,
    '四十一': 41, '四十二': 42, '四十三': 43, '四十四': 44, '四十五': 45, '四十六': 46, '四十七': 47, '四十八': 48, '四十九': 49, '五十': 50,
    '五十一': 51, '五十二': 52, '五十三': 53, '五十四': 54, '五十五': 55, '五十六': 56, '五十七': 57, '五十八': 58, '五十九': 59, '六十': 60,
    '六十一': 61, '六十二': 62, '六十三': 63, '六十四': 64, '六十五': 65, '六十六': 66, '六十七': 67, '六十八': 68, '六十九': 69, '七十': 70,
    '七十一': 71, '七十二': 72, '七十三': 73, '七十四': 74, '七十五': 75, '七十六': 76, '七十七': 77, '七十八': 78, '七十九': 79, '八十': 80,
    '八十一': 81, '八十二': 82, '八十三': 83, '八十四': 84, '八十五': 85, '八十六': 86, '八十七': 87, '八十八': 88, '八十九': 89, '九十': 90,
    '九十一': 91, '九十二': 92, '九十三': 93, '九十四': 94, '九十五': 95, '九十六': 96, '九十七': 97, '九十八': 98, '九十九': 99, '一百': 100
  };
  
  const chineseAmountPatterns = [
    /([一二三四五六七八九十]+)块(?:钱)?/g,
    /([一二三四五六七八九十]+)元/g
  ];
  
  chineseAmountPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const chineseNumber = match[1];
      const value = chineseNumberMap[chineseNumber];
      if (value) {
        amounts.push({
          text: match[0],
          value: value,
          confidence: 0.9,
          position: text.indexOf(match[0]),
          type: 'chinese-number'
        });
      }
    }
  });
  
  // 模糊匹配：大概、差不多、左右等
  const fuzzyAmountPatterns = [
    /大概(\d+(?:\.\d+)?)元/,
    /差不多(\d+(?:\.\d+)?)元/,
    /估计(\d+(?:\.\d+)?)元/,
    /(\d+(?:\.\d+)?)元左右/,
    /(\d+(?:\.\d+)?)多元/,
    /(\d+(?:\.\d+)?)少元/
  ];
  
  fuzzyAmountPatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      amounts.push({
        text: match[0],
        value: value,
        confidence: 0.85,
        position: text.indexOf(match[0]),
        type: 'fuzzy'
      });
    }
  });
  
  // 范围匹配：100-200元
  const rangeAmountMatches = text.match(/(\d+)-(\d+)元/g);
  if (rangeAmountMatches) {
    rangeAmountMatches.forEach(match => {
      const [min, max] = match.replace('元', '').split('-').map(Number);
      const avgValue = (min + max) / 2;
      amounts.push({
        text: match,
        value: avgValue,
        confidence: 0.8,
        position: text.indexOf(match),
        type: 'range',
        range: { min, max }
      });
    });
  }
  
  return amounts;
}

module.exports = {
  extractAmounts
};
