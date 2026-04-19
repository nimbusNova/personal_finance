import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../app/context/AuthContext';
import { login, register } from '../../lib/api';
import LoginPage from '../../app/login/page';

// Mock the dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../../app/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
  login: jest.fn(),
  register: jest.fn(),
}));

describe('LoginPage', () => {
  const mockPush = jest.fn();
  const mockAuthLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useAuth as jest.Mock).mockReturnValue({ login: mockAuthLogin });
  });

  it('renders login form by default', () => {
    render(<LoginPage />);

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your portfolio dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  it('renders register form when toggled', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });

  it('toggles back to login from register', () => {
    render(<LoginPage />);

    // Toggle to register
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));
    expect(screen.getByText('Create Account')).toBeInTheDocument();

    // Toggle back to login
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    (login as jest.Mock).mockResolvedValueOnce({ access_token: 'test-token' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockAuthLogin).toHaveBeenCalledWith('test-token');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles successful registration', async () => {
    (register as jest.Mock).mockResolvedValueOnce({});
    (login as jest.Mock).mockResolvedValueOnce({ access_token: 'test-token' });

    render(<LoginPage />);

    // Toggle to register
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('new@example.com', 'password123');
      expect(login).toHaveBeenCalledWith('new@example.com', 'password123');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message on failed login', async () => {
    (login as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('clears error when toggling between login and register', async () => {
    (login as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);

    // Trigger an error
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Toggle to register - error should be cleared
    fireEvent.click(screen.getByRole('button', { name: /Register/i }));
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  });

  it('disables submit button while loading', async () => {
    (login as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50');
    });
  });

  it('has required fields', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('required');
    expect(screen.getByLabelText('Password')).toHaveAttribute('required');
  });
});
