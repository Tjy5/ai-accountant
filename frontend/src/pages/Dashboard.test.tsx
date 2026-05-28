import type React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { useDraftStore } from '../store/useDraftStore';
import { Dashboard } from './Dashboard';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    PieChart: Passthrough,
    Pie: Passthrough,
    Cell: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

const mockedApi = api as unknown as { get: Mock; post: Mock };
const renderDashboard = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Dashboard', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    useDraftStore.setState({ drafts: [] });
    useAuthStore.setState({
      user: { id: '1', email: 'mimi@example.com', name: 'Mimi' },
      token: 'token-1',
      isAuthenticated: true,
    });
  });

  it('renders summary cards and emoji-decorated recent transactions', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/dashboard/summary') {
        return Promise.resolve({
          data: {
            totals: { income: 1000, expense: 40, net: 970 },
            recentTransactions: [
              {
                id: 1,
                type: 'expense',
                category: 'Food',
                amount: 40,
                description: 'Sushi lunch',
                date: '2026-01-10T00:00:00',
              },
            ],
          },
        });
      }

      return Promise.resolve({
        data: {
          categoryShare: [{ category: 'Food', total: 40 }],
        },
      });
    });

    renderDashboard();

    expect((await screen.findAllByText('$970.00')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('Sushi lunch')).toBeInTheDocument();
    expect(screen.getByText('-$40.00')).toBeInTheDocument();
  });

  it('keeps dashboard drafts when commit fails', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: {} });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/ai/analyze') {
        return Promise.resolve({
          data: {
            drafts: [
              {
                _draftId: 'dashboard-draft-1',
                type: 'expense',
                category: 'Food',
                amount: 38,
                description: 'Lunch box',
                date: '2026-02-01',
              },
            ],
          },
        });
      }

      return Promise.reject(new Error('commit failed'));
    });

    renderDashboard();

    await user.type(screen.getByPlaceholderText(/upload a receipt/i), 'Lunch box 38');
    await user.click(screen.getByRole('button', { name: /analyze/i }));
    expect(await screen.findByText('Lunch box')).toBeInTheDocument();

    await user.click(screen.getByTitle('Confirm Draft'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/still here for retry/i);
    expect(screen.getByText('Lunch box')).toBeInTheDocument();
  });

  it('removes a draft after a successful commit', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: {} });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/ai/analyze') {
        return Promise.resolve({
          data: {
            drafts: [
              {
                _draftId: 'server-draft-1',
                type: 'expense',
                category: 'Food',
                amount: 45,
                currency: 'CNY',
                description: 'Sushi lunch',
                merchant: 'Sushi Shop',
                sourceText: 'Sushi Shop CNY 45',
                date: '2026-01-10',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { count: 1 } });
    });

    renderDashboard();

    await user.type(screen.getByPlaceholderText(/upload a receipt/i), 'Sushi lunch 45');
    await user.click(screen.getByRole('button', { name: /analyze/i }));
    expect(await screen.findByText('Sushi lunch')).toBeInTheDocument();

    await user.click(screen.getByTitle('Confirm Draft'));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/ai/transactions/commit', {
        drafts: [
          expect.objectContaining({
            id: 'server-draft-1',
            _draftId: 'server-draft-1',
            confirmed: true,
            currency: 'CNY',
            merchant: 'Sushi Shop',
            sourceText: 'Sushi Shop CNY 45',
          }),
        ],
      });
      expect(screen.queryByText('Sushi lunch')).not.toBeInTheDocument();
    });
  });
});
