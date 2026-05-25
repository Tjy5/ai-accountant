import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
import { useDraftStore } from '../store/useDraftStore';

afterEach(() => {
  cleanup();
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  useDraftStore.setState({ drafts: [] });
});
