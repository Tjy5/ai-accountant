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

  it('shows an API failure instead of falling back to local sample budgets', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/categories') return Promise.resolve(categoriesResponse);
      if (url === '/budgets') return Promise.reject(new Error('backend down'));
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    render(<Budgets />);

    expect(await screen.findByText(/could not load budgets/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Local Preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Food & Dining')).not.toBeInTheDocument();
    expect(screen.queryByText('Transport')).not.toBeInTheDocument();
    expect(screen.getByText(/no budgets for/i)).toBeInTheDocument();
  });

  it('filters budget rows from the search menu', async () => {
    const user = userEvent.setup();
    render(<Budgets />);

    await screen.findByText('Transport');
    await user.click(screen.getByRole('button', { name: /search budgets/i }));
    const searchInput = screen.getByPlaceholderText(/search category or notes/i);

    await user.type(searchInput, 'Transport');
    expect(screen.getByText('1 of 2 budgets shown')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.queryByText('Food & Dining')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'missing');
    expect(screen.getByText('0 of 2 budgets shown')).toBeInTheDocument();
    expect(screen.getByText('No matching budgets')).toBeInTheDocument();
  });

  it('opens budget alerts for watched and over-budget rows', async () => {
    const user = userEvent.setup();
    render(<Budgets />);

    await screen.findByText('Transport');
    await user.click(screen.getByRole('button', { name: /budget alerts/i }));

    expect(screen.getByText('Budget Alerts')).toBeInTheDocument();
    expect(screen.getByText('105% used, -$20.00 remaining')).toBeInTheDocument();
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
