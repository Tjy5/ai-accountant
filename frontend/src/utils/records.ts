export type RawRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asRecord = (value: unknown): RawRecord => (isRecord(value) ? value : {});

export const asRecordArray = (value: unknown): RawRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

export const toNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};
