export const parseTags = (input?: string[] | string | null): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
  const raw = String(input).trim();
  if (!raw) return [];
  // 支持中英文逗号、分号、空格
  return raw.split(/[，,;；\s]+/).map(s => s.trim()).filter(Boolean);
};

export const normalizeTags = (values: string[]): string[] => {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));
};


