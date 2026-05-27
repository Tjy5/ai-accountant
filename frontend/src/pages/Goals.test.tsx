import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { Goals } from './Goals';

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

const goalsResponse = {
  data: {
    goals: [
      {
        id: 1,
        title: 'Japan Trip',
        target_amount: 2400,
        saved_amount: 900,
        remaining: 1500,
        progress: 38,
        target_date: '2026-08-15T00:00:00',
        status: 'active',
        icon: 'plane',
        color: '#64B5F6',
        notes: 'Flights and hotels',
        daysLeft: 80,
        pace: 'steady',
      },
      {
        id: 2,
        title: 'Emergency Fund',
        target_amount: 1000,
        saved_amount: 1000,
        remaining: 0,
        progress: 100,
        status: 'completed',
        icon: 'piggy-bank',
        color: '#7ACB9C',
        notes: 'Three months of basics',
        daysLeft: null,
        pace: 'complete',
      },
    ],
    summary: {
      totalTarget: 3400,
      totalSaved: 1900,
      remaining: 1500,
      progress: 56,
      count: 2,
      active: 1,
      completed: 1,
      dueSoon: 0,
    },
  },
};

describe('Goals', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.delete.mockReset();

    mockedApi.get.mockResolvedValue(goalsResponse);
    mockedApi.post.mockResolvedValue({
      data: {
        goal: {
          id: 3,
          title: 'Laptop Fund',
          target_amount: 1800,
          saved_amount: 300,
          remaining: 1500,
          progress: 17,
          status: 'active',
          icon: 'target',
          color: '#FF8C94',
        },
      },
    });
    mockedApi.patch.mockResolvedValue({ data: { goal: goalsResponse.data.goals[0] } });
    mockedApi.delete.mockResolvedValue({ data: { deleted: true, id: 1 } });
  });

  it('renders backend goals with summary and progress', async () => {
    render(<Goals />);

    expect((await screen.findAllByText('Japan Trip')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Emergency Fund').length).toBeGreaterThan(0);
    expect(screen.getByText('$3,400.00')).toBeInTheDocument();
    expect(screen.getByText('$1,900.00')).toBeInTheDocument();
    expect(screen.getAllByText('$1,500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('56%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('80 days left').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/goals', { params: {} });
    });
  });

  it('filters goals by status and search query', async () => {
    const user = userEvent.setup();
    render(<Goals />);

    await screen.findAllByText('Japan Trip');
    await user.selectOptions(screen.getByLabelText(/goal status/i), 'completed');
    await user.type(screen.getByLabelText(/search goals/i), 'Emergency');

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenLastCalledWith('/goals', {
        params: {
          status: 'completed',
          search: 'Emergency',
        },
      });
    });
  });

  it('opens the goal drawer and posts a new goal', async () => {
    const user = userEvent.setup();
    render(<Goals />);

    await screen.findAllByText('Japan Trip');
    await user.click(screen.getByRole('button', { name: /new goal/i }));
    const dialog = screen.getByRole('dialog', { name: /new goal/i });

    await user.type(within(dialog).getByLabelText(/title/i), 'Laptop Fund');
    await user.type(within(dialog).getByLabelText(/target amount/i), '1800');
    await user.clear(within(dialog).getByLabelText(/saved amount/i));
    await user.type(within(dialog).getByLabelText(/saved amount/i), '300');
    await user.type(within(dialog).getByLabelText(/target date/i), '2026-10-01');
    await user.type(within(dialog).getByLabelText(/notes/i), 'Portable workstation');
    await user.click(within(dialog).getByRole('button', { name: /save goal/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/goals', {
        title: 'Laptop Fund',
        targetAmount: 1800,
        savedAmount: 300,
        targetDate: '2026-10-01',
        status: 'active',
        icon: 'piggy-bank',
        color: '#7ACB9C',
        notes: 'Portable workstation',
      });
    });
  });

  it('falls back to a local preview when the backend is unavailable', async () => {
    mockedApi.get.mockRejectedValue(new Error('offline'));

    render(<Goals />);

    expect(await screen.findByText('Local Preview')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Goal Buddy')).toBeInTheDocument();
    expect(screen.getAllByText('Japan Trip').length).toBeGreaterThan(0);
  });
});
