import type React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Reports } from './Reports';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    BarChart: Passthrough,
    Bar: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    PieChart: Passthrough,
    Pie: Passthrough,
    Cell: () => null,
  };
});

const mockedApi = api as unknown as { get: Mock };

const reportResponse = {
  data: {
    range: {
      startDate: '2026-06-01',
      endDate: '2026-07-31',
      budgetMonth: '2026-07',
    },
    summary: {
      income: 6200,
      expense: 400,
      net: 5800,
      transactionCount: 6,
      expenseCount: 4,
      averageExpense: 100,
      largestExpense: 150,
      savingsRate: 94,
    },
    monthlyTrend: [
      { month: '2026-06', income: 3000, expense: 200, net: 2800, count: 3 },
      { month: '2026-07', income: 3200, expense: 200, net: 3000, count: 3 },
    ],
    categoryBreakdown: [
      { category: 'Food & Dining', total: 270, percentage: 68, transactionCount: 2, averageAmount: 135 },
      { category: 'Shopping', total: 50, percentage: 13, transactionCount: 1, averageAmount: 50 },
    ],
    budgetHealth: {
      month: '2026-07',
      totalBudget: 160,
      totalSpent: 200,
      remaining: -40,
      progress: 125,
      count: 2,
      overBudget: 1,
      watch: 1,
      onTrack: 0,
      categories: [
        {
          id: 1,
          category: 'Food & Dining',
          amount: 100,
          spent: 150,
          remaining: -50,
          progress: 150,
          status: 'over',
          color: '#FF8C94',
          icon: 'utensils',
        },
        {
          id: 2,
          category: 'Shopping',
          amount: 60,
          spent: 50,
          remaining: 10,
          progress: 83,
          status: 'watch',
          color: '#FFD54F',
          icon: 'shopping-bag',
        },
      ],
    },
    largeExpenses: [
      {
        id: 7,
        category: 'Food & Dining',
        amount: 150,
        description: 'July dinner party',
        date: '2026-07-10T00:00:00',
      },
    ],
    insights: [
      {
        title: 'Top spending lane',
        body: 'Food & Dining leads this report at 68% of expenses.',
        tone: 'focus',
      },
      {
        title: 'Budget attention',
        body: '1 budget line needs attention for 2026-07.',
        tone: 'warning',
      },
    ],
  },
};

describe('Reports', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
  });

  it('renders report overview data from the backend', async () => {
    mockedApi.get.mockResolvedValue(reportResponse);

    render(<Reports />);

    expect(await screen.findByText('$6,200.00')).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
    expect(screen.getByText('$5,800.00')).toBeInTheDocument();
    expect(screen.getByText('Financial Snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Food & Dining is the largest expense lane at 68%/)).toBeInTheDocument();
    expect(screen.getByText('July dinner party')).toBeInTheDocument();
    expect(screen.getByText('-$150.00')).toBeInTheDocument();
    expect(screen.getByText('Budget attention')).toBeInTheDocument();
    expect(screen.getAllByText('Food & Dining').length).toBeGreaterThan(0);
    expect(screen.getByText('150%')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/reports', {
        params: {
          startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          month: expect.stringMatching(/^\d{4}-\d{2}$/),
        },
      });
    });
  });

  it('falls back to a local preview report when the backend is unavailable', async () => {
    mockedApi.get.mockRejectedValue(new Error('offline'));

    render(<Reports />);

    expect(await screen.findByText('Local Preview')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Financial Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Category Share')).toBeInTheDocument();
  });
});
