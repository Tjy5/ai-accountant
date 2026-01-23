import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { EXPORT_FIELD_LABELS } from '../constants/exports';
import type { ExportTransaction, ExportOptions } from '../types';

const FIELD_LABELS: Record<string, string> = EXPORT_FIELD_LABELS;

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '';
  switch (key) {
    case 'type': return value === 'income' ? '收入' : '支出';
    case 'amount': return typeof value === 'number' ? value.toFixed(2) : value;
    case 'date':
    case 'created_at': return new Date(value).toLocaleString('zh-CN');
    case 'is_voice_input': return value ? '是' : '否';
    case 'tags': return Array.isArray(value) ? value.join(',') : (typeof value === 'string' ? value : '');
    default: return String(value);
  }
};

const generateFilename = (format: string, dateRange?: { start?: string; end?: string }): string => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  let filename = `交易记录_${dateStr}`;
  if (dateRange?.start && dateRange?.end) filename = `交易记录_${dateRange.start}_至_${dateRange.end}`;
  else if (dateRange?.start) filename = `交易记录_${dateRange.start}_起`;
  else if (dateRange?.end) filename = `交易记录_至_${dateRange.end}`;
  return `${filename}.${format}`;
};

export const exportToCSV = (
  transactions: ExportTransaction[],
  options: Partial<ExportOptions> = {}
): void => {
  const { fields = Object.keys(FIELD_LABELS), filename } = options;
  const headers = fields.map(field => FIELD_LABELS[field] || field);
  const csvData = transactions.map(transaction =>
    fields.map(field => formatValue(field, transaction[field as keyof ExportTransaction]))
  );

  const csvString = [headers, ...csvData]
    .map(row =>
      row.map(cell => {
        const cellStr = String(cell);
        return (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n'))
          ? `"${cellStr.replace(/"/g, '""')}"`
          : cellStr;
      }).join(',')
    ).join('\n');

  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const finalFilename = filename || generateFilename('csv');
  if (typeof saveAs !== 'undefined') saveAs(blob, finalFilename);
};

export const exportToExcel = (
  transactions: ExportTransaction[],
  options: Partial<ExportOptions> = {}
): void => {
  const { fields = Object.keys(FIELD_LABELS), filename } = options;
  const data = transactions.map(transaction => {
    const row: Record<string, any> = {};
    fields.forEach(field => {
      row[FIELD_LABELS[field] || field] = formatValue(field, transaction[field as keyof ExportTransaction]);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  const colWidths = fields.map(field => {
    if (field === 'description' || field === 'voice_input_text') return { wch: 30 };
    if (field === 'date' || field === 'created_at') return { wch: 20 };
    if (field === 'amount') return { wch: 12 };
    return { wch: 15 };
  });
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, '交易记录');
  const finalFilename = filename || generateFilename('xlsx');
  XLSX.writeFile(wb, finalFilename);
};

export const exportTransactions = (
  transactions: ExportTransaction[],
  options: ExportOptions
): void => {
  console.log('开始导出数据:', { count: transactions.length, format: options.format });
  if (transactions.length === 0) {
    alert('没有数据可以导出');
    return;
  }
  try {
    if (options.format === 'csv') exportToCSV(transactions, options);
    else if (options.format === 'excel') exportToExcel(transactions, options);
    else throw new Error('不支持的导出格式');
    console.log('导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    alert('导出失败，请重试');
  }
};
