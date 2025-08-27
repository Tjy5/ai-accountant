import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { EXPORT_FIELD_LABELS } from '../constants/exports';

export interface ExportTransaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  is_voice_input?: boolean;
  voice_input_text?: string;
  tags?: string[] | string;
}

export interface ExportOptions {
  format: 'csv' | 'excel';
  fields: string[];
  filename?: string;
}

// 字段映射（中文列名）
const FIELD_LABELS: Record<string, string> = EXPORT_FIELD_LABELS;

// 数据格式化
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  switch (key) {
    case 'type':
      return value === 'income' ? '收入' : '支出';
    case 'amount':
      return typeof value === 'number' ? value.toFixed(2) : value;
    case 'date':
    case 'created_at':
      return new Date(value).toLocaleString('zh-CN');
    case 'is_voice_input':
      return value ? '是' : '否';
    case 'tags': {
      if (Array.isArray(value)) return value.join(',');
      if (typeof value === 'string') return value;
      return '';
    }
    default:
      return String(value);
  }
};

// 生成文件名
const generateFilename = (format: string, dateRange?: { start?: string; end?: string }): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  let filename = `交易记录_${dateStr}`;
  
  if (dateRange?.start && dateRange?.end) {
    filename = `交易记录_${dateRange.start}_至_${dateRange.end}`;
  } else if (dateRange?.start) {
    filename = `交易记录_${dateRange.start}_起`;
  } else if (dateRange?.end) {
    filename = `交易记录_至_${dateRange.end}`;
  }
  
  return `${filename}.${format}`;
};

// 导出为CSV
export const exportToCSV = (
  transactions: ExportTransaction[], 
  options: Partial<ExportOptions> = {}
): void => {
  const { fields = Object.keys(FIELD_LABELS), filename } = options;
  
  // 构建CSV头部
  const headers = fields.map(field => FIELD_LABELS[field] || field);
  
  // 构建CSV数据
  const csvData = transactions.map(transaction => 
    fields.map(field => {
      const value = transaction[field as keyof ExportTransaction];
      return formatValue(field, value);
    })
  );
  
  // 组合所有数据
  const allData = [headers, ...csvData];
  
  // 转换为CSV字符串
  const csvString = allData
    .map(row => 
      row.map(cell => {
        // 处理包含逗号、引号、换行符的字段
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
    .join('\n');
  
  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  
  const finalFilename = filename || generateFilename('csv');
  saveAs(blob, finalFilename);
};

// 导出为Excel
export const exportToExcel = (
  transactions: ExportTransaction[], 
  options: Partial<ExportOptions> = {}
): void => {
  const { fields = Object.keys(FIELD_LABELS), filename } = options;
  
  // 准备数据
  const data = transactions.map(transaction => {
    const row: Record<string, any> = {};
    fields.forEach(field => {
      const label = FIELD_LABELS[field] || field;
      const value = transaction[field as keyof ExportTransaction];
      row[label] = formatValue(field, value);
    });
    return row;
  });
  
  // 创建工作簿和工作表
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  
  // 设置列宽
  const colWidths = fields.map(field => {
    switch (field) {
      case 'description':
      case 'voice_input_text':
        return { wch: 30 };
      case 'date':
      case 'created_at':
        return { wch: 20 };
      case 'amount':
        return { wch: 12 };
      default:
        return { wch: 15 };
    }
  });
  
  ws['!cols'] = colWidths;
  
  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, '交易记录');
  
  // 生成文件并下载
  const finalFilename = filename || generateFilename('xlsx');
  XLSX.writeFile(wb, finalFilename);
};

// 统一导出函数
export const exportTransactions = (
  transactions: ExportTransaction[],
  options: ExportOptions
): void => {
  console.log('开始导出数据:', { 
    count: transactions.length, 
    format: options.format,
    fields: options.fields 
  });
  
  if (transactions.length === 0) {
    alert('没有数据可以导出');
    return;
  }
  
  try {
    if (options.format === 'csv') {
      exportToCSV(transactions, options);
    } else if (options.format === 'excel') {
      exportToExcel(transactions, options);
    } else {
      throw new Error('不支持的导出格式');
    }
    
    console.log('导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
};
