import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Categories } from './Categories';

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

const categoriesResponse = {
  data: {
    categories: [
      {
        id: 1,
        name: 'Food & Dining',
        type: 'expense',
        icon: 'utensils',
        color: '#FF8C94',
        description: 'Meals and coffee',
        is_default: true,
        usage_count: 2,
        transaction_count: 2,
        income_total: 0,
        expense_total: 18.75,
        total_amount: 18.75,
      },
      {
        id: 2,
        name: 'Salary',
        type: 'income',
        icon: 'briefcase',
        color: '#7ACB9C',
        description: 'Payroll',
        is_default: true,
        usage_count: 1,
        transaction_count: 1,
        income_total: 5200,
        expense_total: 0,
        total_amount: 5200,
      },
    ],
    stats: {
      total: 2,
      expense: 1,
      income: 1,
      both: 0,
      custom: 0,
      default: 2,
    },
  },
};

describe('Categories', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.delete.mockReset();
    mockedApi.get.mockResolvedValue(categoriesResponse);
    mockedApi.post.mockResolvedValue({
      data: {
        category: {
          id: 3,
          name: 'Subscriptions',
          type: 'expense',
          icon: 'receipt',
          color: '#BA68C8',
          description: 'Apps and streaming',
          is_default: false,
          usage_count: 0,
        },
      },
    });
  });

  it('renders backend categories with summary stats', async () => {
    render(<Categories />);

    expect((await screen.findAllByText('Food & Dining')).length).toBeGreaterThan(0);
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('$18.75')).toBeInTheDocument();
    expect(screen.getByText('$5,200.00')).toBeInTheDocument();
    expect(screen.getByText(/custom categories/i)).toHaveTextContent('0 custom categories');
  });

  it('opens the category drawer and posts a new category', async () => {
    const user = userEvent.setup();
    render(<Categories />);

    await screen.findAllByText('Food & Dining');
    await user.click(screen.getByRole('button', { name: /add category/i }));
    const dialog = screen.getByRole('dialog', { name: /new category/i });
    await user.type(within(dialog).getByPlaceholderText(/subscriptions/i), 'Subscriptions');
    await user.type(within(dialog).getByPlaceholderText(/what belongs/i), 'Apps and streaming');
    await user.click(within(dialog).getByRole('button', { name: /save category/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/categories', {
        name: 'Subscriptions',
        type: 'expense',
        icon: 'tag',
        color: '#FF8C94',
        description: 'Apps and streaming',
      });
    });
  });
});
