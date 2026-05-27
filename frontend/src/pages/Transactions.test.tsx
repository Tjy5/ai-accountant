import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Transactions } from './Transactions';

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

const transactionResponse = {
  data: {
    transactions: [
      {
        id: 1,
        type: 'expense',
        category: 'Food & Dining',
        amount: 12.5,
        description: 'Croissant Coffee',
        date: '2026-03-05T00:00:00',
      },
    ],
    pagination: {
      page: 1,
      pageSize: 8,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
    totals: {
      income: 1000,
      expense: 12.5,
      net: 987.5,
      count: 1,
    },
  },
};

describe('Transactions', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.delete.mockReset();
    mockedApi.get.mockResolvedValue(transactionResponse);
    mockedApi.post.mockResolvedValue({
      data: {
        transaction: {
          id: 2,
          type: 'expense',
          category: 'Transport',
          amount: 22,
          description: 'Taxi ride',
          date: '2026-03-06T00:00:00',
        },
      },
    });
  });

  it('renders backend transactions with totals', async () => {
    render(<Transactions />);

    expect(await screen.findByText('Croissant Coffee')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0);
    expect(screen.getByText('+$987.50')).toBeInTheDocument();
  });

  it('opens the entry drawer and posts a new transaction', async () => {
    const user = userEvent.setup();
    render(<Transactions />);

    await screen.findByText('Croissant Coffee');
    await user.click(screen.getByRole('button', { name: /new entry/i }));
    const dialog = screen.getByRole('dialog', { name: /new transaction/i });
    await user.clear(within(dialog).getByPlaceholderText(/coffee shop/i));
    await user.type(within(dialog).getByPlaceholderText(/coffee shop/i), 'Taxi ride');
    await user.clear(within(dialog).getByDisplayValue('Food & Dining'));
    await user.type(within(dialog).getByLabelText(/category/i), 'Transport');
    await user.clear(within(dialog).getByRole('spinbutton'));
    await user.type(within(dialog).getByRole('spinbutton'), '22');
    await user.click(within(dialog).getByRole('button', { name: /save transaction/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/transactions', {
        type: 'expense',
        category: 'Transport',
        amount: 22,
        description: 'Taxi ride',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });
  });
});
