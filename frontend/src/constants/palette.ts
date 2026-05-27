export const COLORS = [
  '#FF8C94',
  '#64B5F6',
  '#FFD54F',
  '#BA68C8',
  '#7ACB9C',
  '#FFB87A',
  '#A1887F',
  '#4DB6AC',
  '#F27C8B',
  '#8C9EFF',
] as const;

export type ColorName = (typeof COLORS)[number];

export const fallbackColor = (value: unknown): ColorName =>
  COLORS.includes(value as ColorName) ? (value as ColorName) : '#FF8C94';
