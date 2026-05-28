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

const aiSettingsResponse = {
  data: {
    aiAssistEnabled: true,
    apiKeyConfigured: false,
    apiKeyPreview: null,
    usesUserApiKey: false,
    usesSystemFallback: false,
    baseUrl: null,
    model: null,
    effectiveBaseUrl: 'https://api.openai.com/v1',
    effectiveModel: 'gpt-4o-mini',
    encryptionConfigured: false,
    timestamp: 0,
  },
};

const resolveGetByUrl = (url: string) => {
  if (url === '/settings/ai') return Promise.resolve(aiSettingsResponse);
  return Promise.resolve(settingsResponse);
};

describe('Settings', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.get.mockImplementation(resolveGetByUrl);
    mockedApi.patch.mockImplementation((url: string) => {
      if (url === '/settings/ai') return Promise.resolve(aiSettingsResponse);
      return Promise.resolve({
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
    });
    useAuthStore.setState({
      user: { id: '1', email: 'mimi@example.com', name: 'Mimi' },
      token: 'token-1',
      isAuthenticated: true,
    });
  });

  it('renders backend settings with profile and settings cards', async () => {
    render(<Settings />);

    expect(await screen.findByText('Mimi')).toBeInTheDocument();
    expect(screen.getByText('mimi@example.com')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Account & Security')).toBeInTheDocument();
    expect(screen.getByText('Need Help?')).toBeInTheDocument();
  });

  it('patches edited profile settings when editing is completed', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    // Click Edit Profile button
    const editBtn = await screen.findByRole('button', { name: /edit profile/i });
    await user.click(editBtn);

    // Modify Display Name
    const displayName = screen.getByLabelText(/display name/i);
    await user.clear(displayName);
    await user.type(displayName, 'Mimi Ledger');

    // Change Currency select
    const currencySelect = screen.getByLabelText(/default currency/i);
    await user.selectOptions(currencySelect, 'CNY');

    // Click Save Profile button
    const saveBtn = screen.getByRole('button', { name: /save profile/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith('/settings', {
        displayName: 'Mimi Ledger',
        defaultCurrency: 'CNY',
        monthStartDay: 1,
        receiptReminders: true,
        budgetAlerts: true,
        weeklyReport: false,
      });
    });

    expect(screen.queryByText('Settings saved.')).not.toBeInTheDocument();
    expect(useAuthStore.getState().user?.name).toBe('Mimi Ledger');
  });

  it('auto-saves toggled notification settings', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    // Toggle Transaction Alerts (mapped to receiptReminders)
    const transactionToggle = await screen.findByRole('button', { name: /transaction alerts/i });
    await user.click(transactionToggle);

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith('/settings', {
        displayName: 'Mimi',
        defaultCurrency: 'USD',
        monthStartDay: 1,
        receiptReminders: false,
        budgetAlerts: true,
        weeklyReport: false,
      });
    });
  });

  it('falls back to a local preview if settings cannot be loaded', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/settings/ai') return Promise.resolve(aiSettingsResponse);
      return Promise.reject(new Error('backend down'));
    });
    render(<Settings />);

    expect(await screen.findByText('Local Preview')).toBeInTheDocument();
    expect(screen.getByText('mimi@example.com')).toBeInTheDocument();
    expect(screen.getByText('Need Help?')).toBeInTheDocument();
  });
});
