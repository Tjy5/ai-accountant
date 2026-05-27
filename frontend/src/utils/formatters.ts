export const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const compactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const normalizeDateInput = (date?: string) => {
  const raw = date || todayInput();
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : todayInput();
};

export const readableInputDate = (date?: string) => {
  const value = normalizeDateInput(date);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const currentMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const readableMonth = (month: string) => {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

export const shortMonth = (month: string) => {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
  });
};

export const readableDate = (value: string) => {
  if (!value) return 'No date';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const shortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
