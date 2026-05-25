import type React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { Dashboard } from './Dashboard';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
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

const mockedApi = api as unknown as { get: Mock };

describe('Dashboard', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
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
            totals: { income: 1000, expense: 30, net: 970 },
            recentTransactions: [
              {
                id: 1,
                type: 'expense',
                category: 'Food',
                amount: 30,
                description: 'Sushi lunch',
                date: '2026-01-10T00:00:00',
              },
            ],
          },
        });
      }

      return Promise.resolve({
        data: {
          categoryShare: [{ category: 'Food', total: 30 }],
        },
      });
    });

    render(<Dashboard />);

    expect(await screen.findByText('$970.00')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('Sushi lunch')).toBeInTheDocument();
    expect(screen.getByText('-$30.00')).toBeInTheDocument();
  });
});
