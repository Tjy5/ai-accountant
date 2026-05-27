import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Budgets } from './Budgets';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: Mock;
  post: Mock;
  patch: Mock;
  delete: Mock;
};

const budgetsResponse = {
  data: {
    budgets: [
      {
        id: 1,
        category: 'Food & Dining',
        amount: 600,
        spent: 413.2,
        remaining: 186.8,
        progress: 69,
        status: 'on_track',
        period_month: '2026-05',
        icon: 'utensils',
        color: '#FF8C94',
        notes: 'Meals and groceries',
      },
      {
        id: 2,
        category: 'Transport',
        amount: 400,
        spent: 420,
        remaining: -20,
        progress: 105,
        status: 'over',
        period_month: '2026-05',
        icon: 'bus',
        color: '#64B5F6',
        notes: 'Transit and rides',
      },
    ],
    summary: {
      month: '2026-05',
      totalBudget: 1000,
      totalSpent: 833.2,
      remaining: 166.8,
      progress: 83,
      count: 2,
      overBudget: 1,
    },
  },
};

const categoriesResponse = {
  data: {
    categories: [
      { id: 1, name: 'Food & Dining', type: 'expense' },
      { id: 2, name: 'Subscriptions', type: 'expense' },
      { id: 3, name: 'Salary', type: 'income' },
    ],
  },
};

describe('Budgets', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.delete.mockReset();

    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/categories') return Promise.resolve(categoriesResponse);
      if (url === '/budgets') return Promise.resolve(budgetsResponse);
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    mockedApi.post.mockResolvedValue({
      data: {
        budget: {
          id: 3,
          category: 'Subscriptions',
          amount: 120,
          spent: 0,
          remaining: 120,
          progress: 0,
          status: 'on_track',
          period_month: '2026-05',
          icon: 'receipt',
          color: '#BA68C8',
        },
      },
    });
  });

  it('renders backend budgets with monthly summary', async () => {
    render(<Budgets />);

    expect((await screen.findAllByText('Food & Dining')).length).toBeGreaterThan(0);
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('$833.20')).toBeInTheDocument();
    expect(screen.getByText('$166.80')).toBeInTheDocument();
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('-$20.00')).toBeInTheDocument();
  });

  it('opens the budget drawer and posts a new budget', async () => {
    const user = userEvent.setup();
    render(<Budgets />);

    await screen.findAllByText('Food & Dining');
    await user.click(screen.getByRole('button', { name: /new budget/i }));
    const dialog = screen.getByRole('dialog', { name: /new budget/i });

    await user.clear(within(dialog).getByDisplayValue('Food & Dining'));
    await user.type(within(dialog).getByLabelText(/category/i), 'Subscriptions');
    await user.clear(within(dialog).getByRole('spinbutton'));
    await user.type(within(dialog).getByRole('spinbutton'), '120');
    await user.type(within(dialog).getByPlaceholderText(/groceries/i), 'Apps and streaming');
    await user.click(within(dialog).getByRole('button', { name: /save budget/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/budgets', {
        category: 'Subscriptions',
        amount: 120,
        month: expect.stringMatching(/^\d{4}-\d{2}$/),
        icon: 'receipt',
        color: '#BA68C8',
        notes: 'Apps and streaming',
      });
    });
  });
});
