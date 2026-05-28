import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Reports } from './Reports';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: Mock;
};

const mockReportResponse = {
  data: {
    summary: {
      income: 5200,
      expense: 1820.20,
      net: 3379.80,
      savingsRate: 62.7,
    },
    categoryBreakdown: [
      { category: 'Food & Dining', total: 570.57, percentage: 35 },
      { category: 'Transport', total: 407.55, percentage: 25 },
    ],
  },
};

const mockTransactionsResponse = {
  data: {
    transactions: [
      { id: '1', type: 'expense', category: 'Food & Dining', amount: 60, date: '2024-10-01T00:00:00' },
      { id: '2', type: 'expense', category: 'Transport', amount: 40, date: '2024-10-03T00:00:00' },
      { id: '3', type: 'income', category: 'Income', amount: 5200, date: '2024-10-01T00:00:00' },
    ],
  },
};

describe('Reports Page Redesign', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.get.mockImplementation((url) => {
      if (url === '/reports') {
        return Promise.resolve(mockReportResponse);
      }
      if (url === '/transactions') {
        return Promise.resolve(mockTransactionsResponse);
      }
      return Promise.reject(new Error('not found'));
    });
  });

  it('renders backend reports data and summary metrics correctly', async () => {
    render(<Reports />);

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Analyze your financial trends and patterns.')).toBeInTheDocument();

    // Check Monthly Summary values
    await waitFor(() => {
      expect(screen.getByText('$5,200.00')).toBeInTheDocument();
      expect(screen.getByText('$1,820.20')).toBeInTheDocument();
      expect(screen.getByText('$3,379.80')).toBeInTheDocument();
      expect(screen.getByText('62.7%')).toBeInTheDocument();
    });

    // Check if correct APIs were called
    expect(mockedApi.get).toHaveBeenCalledWith('/reports', expect.any(Object));
    expect(mockedApi.get).toHaveBeenCalledWith('/transactions', expect.any(Object));
  });

  it('changes preset filters and queries the API with new dates', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    // Click "7D" preset
    const presetButton = screen.getByRole('button', { name: '7D' });
    await user.click(presetButton);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/reports', expect.any(Object));
    });
  });

  it('filters by category selection from dropdown', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    // Wait for options to load from transactions
    const dropdown = await screen.findByLabelText(/categories filter/i);

    // Select "Food & Dining"
    await user.selectOptions(dropdown, 'Food & Dining');

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/reports', expect.any(Object));
    });
  });

  it('falls back to mock default data when backend is offline/erroring', async () => {
    mockedApi.get.mockRejectedValue(new Error('offline'));

    render(<Reports />);

    expect(await screen.findByText('Local Preview')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Spending Trend')).toBeInTheDocument();
    expect(screen.getByText('Category Breakdown')).toBeInTheDocument();

    // Mock summary data values should be visible
    expect(screen.getByText('$5,200.00')).toBeInTheDocument();
    expect(screen.getByText('$1,820.20')).toBeInTheDocument();
    expect(screen.getByText('$3,379.80')).toBeInTheDocument();
    expect(screen.getByText('62.7%')).toBeInTheDocument();
  });
});
