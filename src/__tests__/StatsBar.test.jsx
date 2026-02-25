import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBar } from '../components/StatsBar';

const SAMPLE_STATS = [
  { label: 'Total', value: 42, color: '#6c63ff' },
  { label: 'This Week', value: 7, color: '#d4a843' },
  { label: 'Streak', value: 3, color: '#22c55e' },
];

describe('StatsBar', () => {
  test('renders a chip for each stat', () => {
    render(<StatsBar stats={SAMPLE_STATS} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('Streak')).toBeInTheDocument();
  });

  test('displays the correct numeric values', () => {
    render(<StatsBar stats={SAMPLE_STATS} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('renders nothing when stats is empty', () => {
    const { container } = render(<StatsBar stats={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when stats is undefined', () => {
    const { container } = render(<StatsBar stats={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test('applies the stat color via inline style', () => {
    render(<StatsBar stats={[{ label: 'Score', value: 99, color: '#ff0000' }]} />);
    const value = screen.getByText('99');
    expect(value).toHaveStyle({ color: '#ff0000' });
  });
});
