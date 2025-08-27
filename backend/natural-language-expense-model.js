'use strict';

const { extractAmounts } = require('./extractors/amountExtractor');
const { extractProducts, categoryKeywordMap } = require('./extractors/productExtractor');

function normalizeString(input) {
  return String(input || '').trim().toLowerCase();
}

function getCategoryForProduct(productName) {
  const name = normalizeString(productName);
  let bestMatch = null;
  let bestCategory = '其他';

  for (const [category, keywords] of Object.entries(categoryKeywordMap)) {
    for (const keyword of keywords) {
      const k = normalizeString(keyword);
      if (k && name.includes(k)) {
        if (!bestMatch || k.length > bestMatch.length) {
          bestMatch = k;
          bestCategory = category;
        }
      }
    }
  }

  return bestCategory;
}

class NaturalLanguageExpenseModel {
  async understand(text) {
    const input = String(text || '');

    // Extract products and amounts from text
    const products = extractProducts(input) || [];
    const amounts = extractAmounts(input) || [];

    // Pick primary amount if available
    const primaryAmount = amounts.length > 0 ? Number(amounts[0].value) : undefined;

    const items = [];
    if (products.length > 0) {
      for (const p of products) {
        items.push({
          name: p.name,
          price: primaryAmount ?? 0,
          category: getCategoryForProduct(p.name)
        });
      }
    } else if (primaryAmount !== undefined) {
      // If no product found, fallback to a generic item
      items.push({
        name: '消费',
        price: primaryAmount,
        category: '其他'
      });
    }

    const totalAmount = items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

    return {
      items,
      totalAmount,
      confidence: items.length > 0 ? 0.9 : 0.5
    };
  }
}

module.exports = {
  NaturalLanguageExpenseModel,
  getCategoryForProduct
};


