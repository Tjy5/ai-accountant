import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Login } from './Login';

vi.mock('../api/axiosInstance', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedApi = api as unknown as { post: Mock };

const renderLogin = () => render(
  <MemoryRouter initialEntries={['/login']}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<div>Dashboard Route</div>} />
    </Routes>
  </MemoryRouter>
);

describe('Login', () => {
  beforeEach(() => {
    mockedApi.post.mockReset();
  });

  it('stores the token and redirects after a successful login', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValueOnce({
      data: {
        token: 'token-1',
        user: { id: '1', email: '1', name: 'Mimi' },
      },
    });

    const { container } = renderLogin();

    await user.type(screen.getByPlaceholderText('Enter your email'), '1');
    await user.type(container.querySelector('input[type="password"]')!, '1');
    await user.click(screen.getByRole('button', { name: /let's go/i }));

    expect(await screen.findByText('Dashboard Route')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('token-1');
  });

  it('shows the backend error message after a failed login', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: '账号或密码错误' } },
    });

    const { container } = renderLogin();

    await user.type(screen.getByPlaceholderText('Enter your email'), '1');
    await user.type(container.querySelector('input[type="password"]')!, 'wrong-password');
    await user.click(screen.getByRole('button', { name: /let's go/i }));

    expect(await screen.findByText('账号或密码错误')).toBeInTheDocument();
  });
});
