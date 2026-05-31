import type React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { useAuthStore } from '../store/useAuthStore';
import { useDraftStore } from '../store/useDraftStore';
import { useAiChatStore } from '../store/useAiChatStore';
import { Layout } from '../components/Layout';
import { Dashboard } from './Dashboard';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
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

const mockedApi = api as unknown as { get: Mock; post: Mock };
const renderDashboard = () => render(
  <MemoryRouter>
    <Layout>
      <Dashboard />
    </Layout>
  </MemoryRouter>
);

describe('Dashboard', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    useDraftStore.setState({ drafts: [] });
    useAiChatStore.setState({
      isOpen: false,
      isMinimized: false,
      currentSessionId: null,
      sessions: [],
      messages: [],
      pending: false,
      error: '',
    });
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
            totals: { income: 1000, expense: 40, net: 970 },
            recentTransactions: [
              {
                id: 1,
                type: 'expense',
                category: 'Food',
                amount: 40,
                description: 'Sushi lunch',
                date: '2026-01-10T00:00:00',
              },
            ],
          },
        });
      }

      return Promise.resolve({
        data: {
          categoryShare: [{ category: 'Food', total: 40 }],
        },
      });
    });

    renderDashboard();

    expect((await screen.findAllByText('$970.00')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('Sushi lunch')).toBeInTheDocument();
    expect(screen.getByText('-$40.00')).toBeInTheDocument();
  });

  it('opens the chat drawer when the composer is clicked', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: {} });

    renderDashboard();

    expect(screen.queryByLabelText('Cat AI bookkeeping conversation')).not.toBeInTheDocument();

    await user.click(screen.getByPlaceholderText(/Try:/i));

    expect(screen.getByLabelText('Cat AI bookkeeping conversation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show chat history/i })).toBeInTheDocument();
    expect(screen.queryByText('历史会话')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show chat history/i }));

    expect(screen.getByText('历史会话')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide chat history/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close cat AI chat/i }));

    expect(screen.queryByLabelText('Cat AI bookkeeping conversation')).not.toBeInTheDocument();

    await user.click(screen.getByPlaceholderText(/Try:/i));

    expect(screen.queryByText('历史会话')).not.toBeInTheDocument();
  });

  it('keeps dashboard drafts when commit fails', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: {} });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/ai/analyze') {
        return Promise.resolve({
          data: {
            drafts: [
              {
                _draftId: 'dashboard-draft-1',
                type: 'expense',
                category: 'Food',
                amount: 38,
                description: 'Lunch box',
                date: '2026-02-01',
              },
            ],
          },
        });
      }

      return Promise.reject(new Error('commit failed'));
    });

    renderDashboard();

    await user.type(screen.getByPlaceholderText(/Try:/i), 'Lunch box 38');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    expect(await screen.findByText('Lunch box')).toBeInTheDocument();

    await user.click(screen.getByTitle('Confirm Draft'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/保存失败/i);
    expect(screen.getByText('Lunch box')).toBeInTheDocument();
  });

  it('removes a draft after a successful commit', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: {} });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/ai/analyze') {
        return Promise.resolve({
          data: {
            drafts: [
              {
                _draftId: 'server-draft-1',
                type: 'expense',
                category: 'Food',
                amount: 45,
                currency: 'CNY',
                description: 'Sushi lunch',
                merchant: 'Sushi Shop',
                sourceText: 'Sushi Shop CNY 45',
                date: '2026-01-10',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { count: 1 } });
    });

    renderDashboard();

    await user.type(screen.getByPlaceholderText(/Try:/i), 'Sushi lunch 45');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    expect(await screen.findByText('Sushi lunch')).toBeInTheDocument();

    await user.click(screen.getByTitle('Confirm Draft'));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/ai/transactions/commit', {
        drafts: [
          expect.objectContaining({
            id: 'server-draft-1',
            _draftId: 'server-draft-1',
            confirmed: true,
            currency: 'CNY',
            merchant: 'Sushi Shop',
            sourceText: 'Sushi Shop CNY 45',
          }),
        ],
      });
      expect(screen.queryByText('Sushi lunch')).not.toBeInTheDocument();
    });
  });

  it('renders the open chat as a fixed bottom drawer', () => {
    mockedApi.get.mockResolvedValue({ data: {} });
    useAiChatStore.setState({
      isOpen: true,
      isMinimized: false,
      currentSessionId: 'layout-session',
      sessions: [
        {
          id: 'layout-session',
          title: 'Layout check',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [
            {
              id: 'assistant-layout-message',
              role: 'assistant',
              text: 'No complete bookkeeping draft was recognized.',
              createdAt: Date.now(),
              status: 'sent',
            },
          ],
        },
      ],
      pending: false,
      error: '',
      messages: [
        {
          id: 'assistant-layout-message',
          role: 'assistant',
          text: 'No complete bookkeeping draft was recognized.',
          createdAt: Date.now(),
          status: 'sent',
        },
      ],
    });

    renderDashboard();

    const drawer = screen.getByLabelText('Cat AI bookkeeping conversation');

    expect(drawer).toHaveClass('ai-chat-drawer-panel');
    expect(drawer).toHaveClass('animate-ai-drawer-up');
    expect(drawer.parentElement).toHaveClass('fixed');
    expect(drawer.parentElement).toHaveClass('bottom-0');
  });

  it('shows, switches, starts, and deletes chat history conversations', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    mockedApi.get.mockResolvedValue({ data: {} });
    useAiChatStore.setState({
      isOpen: true,
      isMinimized: false,
      currentSessionId: 'coffee-session',
      pending: false,
      error: '',
      messages: [
        {
          id: 'coffee-user-message',
          role: 'user',
          text: 'Coffee 5',
          createdAt: now - 2000,
          status: 'sent',
        },
        {
          id: 'coffee-assistant-message',
          role: 'assistant',
          text: 'Coffee draft ready',
          createdAt: now - 1000,
          status: 'sent',
        },
      ],
      sessions: [
        {
          id: 'coffee-session',
          title: 'Coffee 5',
          createdAt: now - 2000,
          updatedAt: now - 1000,
          messages: [
            {
              id: 'coffee-user-message',
              role: 'user',
              text: 'Coffee 5',
              createdAt: now - 2000,
              status: 'sent',
            },
            {
              id: 'coffee-assistant-message',
              role: 'assistant',
              text: 'Coffee draft ready',
              createdAt: now - 1000,
              status: 'sent',
            },
          ],
        },
        {
          id: 'taxi-session',
          title: 'Taxi 22',
          createdAt: now - 4000,
          updatedAt: now - 3000,
          messages: [
            {
              id: 'taxi-user-message',
              role: 'user',
              text: 'Taxi 22',
              createdAt: now - 4000,
              status: 'sent',
            },
            {
              id: 'taxi-assistant-message',
              role: 'assistant',
              text: 'Taxi draft ready',
              createdAt: now - 3000,
              status: 'sent',
            },
          ],
        },
      ],
    });

    renderDashboard();

    expect(screen.getAllByText('Coffee draft ready').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Taxi 22/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show chat history/i }));

    expect(screen.getByText('历史会话')).toBeInTheDocument();
    const taxiConversationButton = screen.getByRole('button', { name: /^Taxi 22/i });
    expect(taxiConversationButton).toBeInTheDocument();

    await user.click(taxiConversationButton);

    expect(useAiChatStore.getState().currentSessionId).toBe('taxi-session');
    expect(useAiChatStore.getState().messages.map((message) => message.text)).toEqual([
      'Taxi 22',
      'Taxi draft ready',
    ]);
    expect(screen.getAllByText('Taxi draft ready').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: /New chat conversation/i })[0]);

    expect(screen.getByText('主人今天想记哪一笔喵？')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Delete conversation Coffee 5/i }));

    expect(screen.queryByText('Coffee 5')).not.toBeInTheDocument();
    expect(useAiChatStore.getState().sessions.map((session) => session.id)).toEqual(['taxi-session']);
  });

  it('keeps draft cards accessible after chat messages are cleared', async () => {
    const user = userEvent.setup();
    mockedApi.get.mockResolvedValue({ data: {} });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/ai/analyze') {
        return Promise.resolve({
          data: {
            drafts: [
              {
                _draftId: 'clear-visible-draft',
                type: 'expense',
                category: 'Food',
                amount: 38,
                description: 'Lunch box',
                date: '2026-05-31',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { count: 1 } });
    });

    renderDashboard();

    await user.type(screen.getByPlaceholderText(/Try:/i), 'Lunch box 38');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    expect(await screen.findByText('Lunch box')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Clear chat messages/i }));

    expect(screen.queryByText('Lunch box 38')).not.toBeInTheDocument();
    expect(screen.getByText('Lunch box')).toBeInTheDocument();
    expect(screen.getByTitle('Confirm Draft')).toBeInTheDocument();
  });
});
