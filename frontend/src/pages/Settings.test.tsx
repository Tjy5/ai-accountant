import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { Settings } from './Settings';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: Mock;
  patch: Mock;
};

const settingsResponse = {
  data: {
    user: { id: 1, email: 'mimi@example.com', name: 'Mimi' },
    settings: {
      id: 1,
      user_id: 1,
      default_currency: 'USD',
      month_start_day: 1,
      receipt_reminders: true,
      budget_alerts: true,
      weekly_report: false,
      ai_assist_enabled: true,
    },
    options: {
      currencies: ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD'],
    },
  },
};

describe('Settings', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.get.mockResolvedValue(settingsResponse);
    mockedApi.patch.mockResolvedValue({
      data: {
        user: { id: 1, email: 'mimi@example.com', name: 'Mimi Ledger' },
        settings: {
          id: 1,
          user_id: 1,
          default_currency: 'CNY',
          month_start_day: 5,
          receipt_reminders: false,
          budget_alerts: true,
          weekly_report: false,
          ai_assist_enabled: true,
        },
      },
    });
    useAuthStore.setState({
      user: { id: '1', email: 'mimi@example.com', name: 'Mimi' },
      token: 'token-1',
      isAuthenticated: true,
    });
  });

  it('renders backend settings with profile and summary cards', async () => {
    render(<Settings />);

    expect(await screen.findByText('Mimi')).toBeInTheDocument();
    expect(screen.getByText('mimi@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('USD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Day 1').length).toBeGreaterThan(0);
    expect(screen.getByText('3/4')).toBeInTheDocument();
  });

  it('patches edited settings and updates the auth store profile name', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    const displayName = await screen.findByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, 'Mimi Ledger');
    await user.click(screen.getByRole('button', { name: 'CNY Chinese Yuan' }));
    await user.selectOptions(screen.getByLabelText(/month start day/i), '5');
    await user.click(screen.getByRole('button', { name: /receipt reminders/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith('/settings', {
        displayName: 'Mimi Ledger',
        defaultCurrency: 'CNY',
        monthStartDay: 5,
        receiptReminders: false,
        budgetAlerts: true,
        weeklyReport: false,
        aiAssistEnabled: true,
      });
    });

    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(useAuthStore.getState().user?.name).toBe('Mimi Ledger');
  });

  it('falls back to a local preview if settings cannot be loaded', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('backend down'));
    render(<Settings />);

    expect(await screen.findByText('Local Preview')).toBeInTheDocument();
    expect(screen.getByText('mimi@example.com')).toBeInTheDocument();
    expect(screen.getByText('Control Shelf')).toBeInTheDocument();
  });
});
