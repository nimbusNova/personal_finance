import React from 'react';
import { render, screen } from '@testing-library/react';
import AllocationChart from '@components/AllocationChart';

// Mock Recharts to avoid SVG rendering issues in tests
jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

describe('AllocationChart', () => {
  it('renders "No allocation data available" when data is empty', () => {
    render(<AllocationChart data={[]} />);
    
    expect(screen.getByText('No allocation data available')).toBeInTheDocument();
  });

  it('renders chart when data is provided', () => {
    const data = [
      { name: 'equity', value: 60 },
      { name: 'bond', value: 30 },
      { name: 'cash', value: 10 },
    ];

    render(<AllocationChart data={data} />);
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('renders cells with correct colors for known asset classes', () => {
    const data = [
      { name: 'equity', value: 60 },
      { name: 'bond', value: 30 },
      { name: 'cash', value: 10 },
    ];

    render(<AllocationChart data={data} />);
    
    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(3);
    
    // Check that colors are applied (blue for equity, emerald for bond, yellow for cash)
    expect(cells[0]).toHaveAttribute('data-fill', '#3b82f6');
    expect(cells[1]).toHaveAttribute('data-fill', '#10b981');
    expect(cells[2]).toHaveAttribute('data-fill', '#eab308');
  });

  it('uses fallback colors for unknown asset classes', () => {
    const data = [
      { name: 'crypto', value: 50 },
      { name: 'real_estate', value: 50 },
    ];

    render(<AllocationChart data={data} />);
    
    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(2);
    
    // First fallback color should be used for unknown classes
    expect(cells[0]).toHaveAttribute('data-fill', '#3b82f6');
    expect(cells[1]).toHaveAttribute('data-fill', '#10b981');
  });

  it('handles case-insensitive asset class names', () => {
    const data = [
      { name: 'EQUITY', value: 60 },
      { name: 'Bond', value: 40 },
    ];

    render(<AllocationChart data={data} />);
    
    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(2);
    
    // Should match lowercase versions
    expect(cells[0]).toHaveAttribute('data-fill', '#3b82f6');
    expect(cells[1]).toHaveAttribute('data-fill', '#10b981');
  });
});
