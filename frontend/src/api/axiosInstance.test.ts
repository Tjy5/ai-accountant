import { describe, expect, it } from 'vitest';
import { shouldRedirectToLogin } from './axiosInstance';

describe('shouldRedirectToLogin', () => {
  it('keeps public auth failures on the current page', () => {
    expect(shouldRedirectToLogin(401, '/auth/login')).toBe(false);
    expect(shouldRedirectToLogin(401, '/auth/register')).toBe(false);
  });

  it('redirects protected 401 responses to login', () => {
    expect(shouldRedirectToLogin(401, '/dashboard/summary')).toBe(true);
    expect(shouldRedirectToLogin(400, '/dashboard/summary')).toBe(false);
  });
});
