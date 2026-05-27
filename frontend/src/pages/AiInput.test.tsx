import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../api/axiosInstance';
import { AiInput } from './AiInput';

vi.mock('../api/axiosInstance', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedApi = api as unknown as { post: Mock };

describe('AiInput', () => {
  beforeEach(() => {
    mockedApi.post.mockReset();
  });

  it('turns parsed text into a sticky note and confirms it with the backend', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/ai/analyze') {
        return Promise.resolve({
          data: {
            drafts: [
              {
                _draftId: 'server-draft-1',
                confirmed: false,
                type: 'expense',
                category: 'Food',
                amount: 45,
                description: 'Sushi lunch',
                date: '2026-01-10',
              },
            ],
          },
        });
      }

      return Promise.resolve({ data: { count: 1 } });
    });

    render(<AiInput />);

    await user.type(screen.getByPlaceholderText(/spent today/i), 'Sushi lunch 45');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('Sushi lunch')).toBeInTheDocument();

    await user.click(screen.getByTitle('Confirm Draft'));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/ai/transactions/commit', {
        drafts: [
          expect.objectContaining({
            id: 'server-draft-1',
            _draftId: 'server-draft-1',
            confirmed: true,
          }),
        ],
      });
    });
    await waitFor(() => expect(screen.queryByText('Sushi lunch')).not.toBeInTheDocument());
  });
});
