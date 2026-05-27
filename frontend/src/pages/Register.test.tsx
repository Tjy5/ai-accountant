import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Register } from './Register';

vi.mock('../api/axiosInstance', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedApi = api as unknown as { post: Mock };

const renderRegister = () => render(
  <MemoryRouter initialEntries={['/register']}>
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<div>Dashboard Route</div>} />
    </Routes>
  </MemoryRouter>
);

describe('Register', () => {
  beforeEach(() => {
    mockedApi.post.mockReset();
  });

  it('stores the token and redirects after successful registration', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValueOnce({
      data: {
        token: 'new-token-1',
        user: { id: '2', email: 'mimi@example.com', name: 'Mimi' },
      },
    });

    const { container } = renderRegister();

    await user.type(screen.getByPlaceholderText('Enter your email'), 'mimi@example.com');
    await user.type(screen.getByPlaceholderText('Pick a cute name'), 'Mimi');
    await user.type(container.querySelector('input[type="password"]')!, 'cute-password');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('Dashboard Route')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('new-token-1');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', {
      email: 'mimi@example.com',
      name: 'Mimi',
      password: 'cute-password',
    });
  });

  it('shows the backend error message after failed registration', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: '该账号已被注册' } },
    });

    const { container } = renderRegister();

    await user.type(screen.getByPlaceholderText('Enter your email'), 'mimi@example.com');
    await user.type(container.querySelector('input[type="password"]')!, 'cute-password');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('该账号已被注册')).toBeInTheDocument();
  });
});
