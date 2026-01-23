import React, { memo } from 'react';
import { Tag, Tooltip } from 'antd';

export interface TagListProps {
  value?: string[] | string | null;
  max?: number; // 最多展示的数量，超出显示 +N
  color?: string;
  style?: React.CSSProperties;
}

const splitToArray = (input?: string[] | string | null): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
  const raw = String(input).trim();
  if (!raw) return [];
  return raw.split(/[，,;；\s]+/).map(s => s.trim()).filter(Boolean);
};

const TagListComponent: React.FC<TagListProps> = ({ value, max = 4, color = '#1890ff', style }) => {
  const list = splitToArray(value);
  if (list.length === 0) return null;

  const visible = list.slice(0, max);
  const rest = list.length - visible.length;

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {visible.map((t, idx) => (
        <Tag key={`${t}-${idx}`} color={color} style={{ margin: 0 }}>{t}</Tag>
      ))}
      {rest > 0 && (
        <Tooltip title={list.slice(max).join(', ')}>
          <span style={{ color: '#999', fontSize: 12 }}>+{rest}</span>
        </Tooltip>
      )}
    </div>
  );
};

const TagList = memo(TagListComponent);
export default TagList;


