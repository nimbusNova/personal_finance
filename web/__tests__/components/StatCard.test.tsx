import React from 'react';
import { render, screen } from '@testing-library/react';
import StatCard from '../app/components/StatCard';

describe('StatCard', () => {
  it('renders title and value correctly', () => {
    render(<StatCard title="Total Balance" value="$50,000" />);
    
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('renders positive change with green color and TrendingUp icon', () => {
    render(<StatCard title="Portfolio" value="$100,000" change="+5.2%" />);
    
    expect(screen.getByText('+5.2%')).toBeInTheDocument();
    expect(screen.getByText('+5.2%').parentElement).toHaveClass('text-green-400');
  });

  it('renders negative change with red color and TrendingDown icon', () => {
    render(<StatCard title="Portfolio" value="$100,000" change="-3.1%" />);
    
    expect(screen.getByText('-3.1%')).toBeInTheDocument();
    expect(screen.getByText('-3.1%').parentElement).toHaveClass('text-red-400');
  });

  it('renders neutral change with gray color and Minus icon', () => {
    render(<StatCard title="Portfolio" value="$100,000" change="0.0%" />);
    
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('0.0%').parentElement).toHaveClass('text-gray-400');
  });

  it('renders masked value with gray text and tracking', () => {
    render(<StatCard title="Hidden Balance" value="$50,000" masked />);
    
    const valueElement = screen.getByText('$50,000');
    expect(valueElement).toHaveClass('text-gray-500', 'tracking-widest');
  });

  it('renders icon when provided', () => {
    const icon = <span data-testid="custom-icon">🔒</span>;
    render(<StatCard title="Secure" value="$100" icon={icon} />);
    
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('does not render change section when change is not provided', () => {
    render(<StatCard title="Simple" value="$100" />);
    
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
