import {
  fetchApi,
  login,
  register,
  getMe,
  getPortfolioSummary,
  getHoldings,
  getTransactions,
  getTransactionSummary,
  getExpensiveTransactions,
  getAccounts,
  getRecentTransactions,
  getSuggestions,
  updateSuggestionFeedback,
  uploadPDF,
  getUploads,
  getUploadById,
  retryExtraction,
  deleteUpload,
  listKimiFiles,
  deleteKimiFile,
  updateTransactionCategory,
} from '../../lib/api';

// Mock the logger to avoid console output during tests
jest.mock('../../lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-token');
  });

  describe('fetchApi', () => {
    it('makes authenticated request with token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      });

      await fetchApi('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('redirects to login on 401', async () => {
      delete window.location;
      window.location = { href: '' } as any;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(fetchApi('/test')).rejects.toThrow('Unauthorized');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(window.location.href).toBe('/login');
    });

    it('throws error with message from response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Bad request' }),
      });

      await expect(fetchApi('/test')).rejects.toThrow('Bad request');
    });

    it('handles array of validation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          detail: [{ msg: 'Field required' }, { msg: 'Invalid format' }],
        }),
      });

      await expect(fetchApi('/test')).rejects.toThrow('Field required; Invalid format');
    });
  });

  describe('login', () => {
    it('stores token on successful login', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token', user: { id: 1 } }),
      });

      await login('test@example.com', 'password');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-token');
    });

    it('throws error on failed login', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' }),
      });

      await expect(login('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('registers new user', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, email: 'new@example.com' }),
      });

      const result = await register('new@example.com', 'password');

      expect(result).toEqual({ id: 1, email: 'new@example.com' });
    });
  });

  describe('getPortfolioSummary', () => {
    it('fetches portfolio summary', async () => {
      const mockData = { total_value: 100000, allocation: { equity: 60 } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await getPortfolioSummary();

      expect(result).toEqual(mockData);
    });
  });

  describe('getTransactions', () => {
    it('fetches transactions without filters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: [] }),
      });

      await getTransactions();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/transactions?'),
        expect.any(Object)
      );
    });

    it('fetches transactions with all filters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: [] }),
      });

      await getTransactions(1, '2024-01-01', '2024-12-31', 'food');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('account_id=1'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2024-01-01'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=food'),
        expect.any(Object)
      );
    });
  });

  describe('getExpensiveTransactions', () => {
    it('fetches expensive transactions with default params', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: [] }),
      });

      await getExpensiveTransactions();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('threshold=200'),
        expect.any(Object)
      );
    });

    it('fetches expensive transactions with year/month', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactions: [] }),
      });

      await getExpensiveTransactions(100, 30, 2024, 3);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('year=2024'),
        expect.any(Object)
      );
    });
  });

  describe('uploadPDF', () => {
    it('uploads PDF file', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ pdf_id: 1, status: 'pending' }),
      });

      const result = await uploadPDF(mockFile, 1);

      expect(result.pdf_id).toBe(1);
    });

    it('uploads PDF without account ID', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ pdf_id: 1 }),
      });

      await uploadPDF(mockFile);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const formData = fetchCall[1].body;
      expect(formData instanceof FormData).toBe(true);
    });
  });

  describe('retryExtraction', () => {
    it('retries extraction for PDF', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Retry queued' }),
      });

      await retryExtraction(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/uploads/1/retry'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('deleteUpload', () => {
    it('deletes upload', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Deleted' }),
      });

      await deleteUpload(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/uploads/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('updateTransactionCategory', () => {
    it('updates transaction category', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, category: 'new-category' }),
      });

      await updateTransactionCategory(1, 'new-category');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/transactions/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ category: 'new-category' }),
        })
      );
    });
  });

  describe('updateSuggestionFeedback', () => {
    it('updates suggestion feedback', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, user_feedback: 'accept' }),
      });

      await updateSuggestionFeedback(1, 'accept', 'Good idea');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/suggestions/1/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ feedback: 'accept', note: 'Good idea' }),
        })
      );
    });
  });

  describe('listKimiFiles', () => {
    it('lists Kimi files', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      await listKimiFiles();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kimi-files'),
        expect.any(Object)
      );
    });
  });

  describe('deleteKimiFile', () => {
    it('deletes Kimi file', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Deleted' }),
      });

      await deleteKimiFile('file_123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kimi-files/file_123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
