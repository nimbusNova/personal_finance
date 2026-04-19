import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProtectedRoute from '../../app/components/ProtectedRoute';
import { useAuth } from '../../app/context/AuthContext';
import { useRouter } from 'next/navigation';

// Mock the hooks
jest.mock('../../app/context/AuthContext');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('ProtectedRoute', () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it('shows loading state when isLoading is true', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: true,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders children when user is authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 1, email: 'test@example.com' },
      isLoading: false,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Secret Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });

  it('returns null when user is null and not loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
    });

    const { container } = render(
      <ProtectedRoute>
        <div>Content</div>
      </ProtectedRoute>
    );

    // Container should be empty (null returned)
    expect(container.firstChild).toBeNull();
  });
});
