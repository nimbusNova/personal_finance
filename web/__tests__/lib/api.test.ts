import {
  fetchApi,
  getSettings,
  updateSettings,
  testApiKey,
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

// Mock fetch with default implementation
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as Response)
);

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response)
    );
  });

  describe('fetchApi', () => {
    it('makes request without auth headers', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: 'test' }),
        } as Response)
      );

      await fetchApi('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });

    it('throws error with message from response', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ detail: 'Bad request' }),
        } as Response)
      );

      await expect(fetchApi('/test')).rejects.toThrow('Bad request');
    });

    it('handles array of validation errors', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            detail: [{ msg: 'Field required' }, { msg: 'Invalid format' }],
          }),
        } as Response)
      );

      await expect(fetchApi('/test')).rejects.toThrow('Field required; Invalid format');
    });
  });

  describe('getSettings', () => {
    it('fetches settings', async () => {
      const mockData = { user_name: 'Test', kimi_api_key: 'sk-123', has_api_key: true };
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response)
      );

      const result = await getSettings();
      expect(result).toEqual(mockData);
    });
  });

  describe('updateSettings', () => {
    it('posts settings update', async () => {
      const mockData = { user_name: 'Alice', kimi_api_key: 'sk-abc', has_api_key: true };
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response)
      );

      const result = await updateSettings('Alice', 'sk-abc');
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/settings'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user_name: 'Alice', kimi_api_key: 'sk-abc' }),
        })
      );
    });
  });

  describe('testApiKey', () => {
    it('tests API key validity', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ valid: true }),
        } as Response)
      );

      const result = await testApiKey();
      expect(result.valid).toBe(true);
    });
  });

  describe('getPortfolioSummary', () => {
    it('fetches portfolio summary', async () => {
      const mockData = { total_value: 100000, allocation: { equity: 60 } };
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response)
      );

      const result = await getPortfolioSummary();
      expect(result).toEqual(mockData);
    });
  });

  describe('getTransactions', () => {
    it('fetches transactions without filters', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [] }),
        } as Response)
      );

      await getTransactions();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/transactions?'),
        expect.any(Object)
      );
    });

    it('fetches transactions with all filters', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [] }),
        } as Response)
      );

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

  describe('getTransactionSummary', () => {
    it('fetches transaction summary', async () => {
      const mockData = { total_income: 5000, total_expenses: 3000 };
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response)
      );

      const result = await getTransactionSummary();
      expect(result).toEqual(mockData);
    });
  });

  describe('getExpensiveTransactions', () => {
    it('fetches expensive transactions with default params', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [] }),
        } as Response)
      );

      await getExpensiveTransactions();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('threshold=200'),
        expect.any(Object)
      );
    });

    it('fetches expensive transactions with year/month', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ transactions: [] }),
        } as Response)
      );

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
      
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ pdf_id: 1, status: 'pending' }),
        } as Response)
      );

      const result = await uploadPDF(mockFile, 1);

      expect(result.pdf_id).toBe(1);
    });

    it('uploads PDF without account ID', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ pdf_id: 1 }),
        } as Response)
      );

      await uploadPDF(mockFile);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const formData = fetchCall[1].body;
      expect(formData instanceof FormData).toBe(true);
    });
  });

  describe('retryExtraction', () => {
    it('retries extraction for PDF', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ message: 'Retry queued' }),
        } as Response)
      );

      await retryExtraction(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/uploads/1/retry'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('deleteUpload', () => {
    it('deletes upload', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ message: 'Deleted' }),
        } as Response)
      );

      await deleteUpload(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/uploads/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('updateTransactionCategory', () => {
    it('updates transaction category', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ id: 1, category: 'new-category' }),
        } as Response)
      );

      const result = await updateTransactionCategory(1, 'new-category');

      expect(result).toEqual({ id: 1, category: 'new-category' });
    });
  });

  describe('getSuggestions', () => {
    it('fetches suggestions', async () => {
      const mockData = { suggestions: [{ id: 1, text: 'Test' }] };
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response)
      );

      const result = await getSuggestions();

      expect(result).toEqual(mockData);
    });

    it('submits feedback', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
      );

      await updateSuggestionFeedback(1, 'accepted', 'Good suggestion');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/suggestions/1/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ feedback: 'accepted', note: 'Good suggestion' }),
        })
      );
    });

    it('submits feedback without note', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
      );

      await updateSuggestionFeedback(1, 'rejected');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/suggestions/1/feedback'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ feedback: 'rejected', note: undefined }),
        })
      );
    });
  });

  describe('listKimiFiles', () => {
    it('fetches Kimi files', async () => {
      const mockData = { files: [{ id: 1, name: 'test.pdf' }] };
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData,
        } as Response)
      );

      const result = await listKimiFiles();

      expect(result).toEqual(mockData);
    });
  });

  describe('deleteKimiFile', () => {
    it('deletes Kimi file', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
      );

      await deleteKimiFile('1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kimi-files/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
