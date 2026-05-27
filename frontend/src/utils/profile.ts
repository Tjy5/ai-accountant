type UserLabelSource = {
  name?: string | null;
  email?: string | null;
} | null | undefined;

export const userLabel = (user: UserLabelSource, fallback = 'Account') => {
  const value = String(user?.name || user?.email || '').trim();
  return value && !/^\d+$/.test(value) ? value : fallback;
};
