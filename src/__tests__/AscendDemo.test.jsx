import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AscendDemo } from '../components/portfolio/AscendDemo.jsx';

describe('AscendDemo', () => {
  test('labels itself as sample data, not a live operation', () => {
    render(<AscendDemo />);
    expect(screen.getByText('Interactive demo · Sample data')).toBeInTheDocument();
    expect(screen.getByText(/no Gmail connection, no Claude call, no database write/i)).toBeInTheDocument();
  });

  test('starts with all sample applications selected', () => {
    render(<AscendDemo />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((box) => expect(box).toBeChecked());
    expect(screen.getByText(/Simulate import \(4 selected\)/)).toBeInTheDocument();
  });

  test('excluding a row updates the selected count and the simulated result', () => {
    render(<AscendDemo />);
    fireEvent.click(screen.getByLabelText(/Include Nimbus Cloud Systems/i));
    expect(screen.getByText(/Simulate import \(3 selected\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Simulate import/));
    expect(screen.getByText('3 entries would land in the Jobs tracker:')).toBeInTheDocument();
    expect(screen.queryByText(/Nimbus Cloud Systems/)).not.toBeInTheDocument();
    expect(screen.getByText(/Solstice Analytics/)).toBeInTheDocument();
  });

  test('deselecting everything reports nothing would be imported', () => {
    render(<AscendDemo />);
    fireEvent.click(screen.getByText('None'));
    expect(screen.getByText(/Simulate import \(0 selected\)/)).toBeInTheDocument();
    expect(screen.getByText(/Simulate import/)).toBeDisabled();
  });

  test('reset returns to the review step with everything selected again', () => {
    render(<AscendDemo />);
    fireEvent.click(screen.getByText(/Simulate import/));
    expect(screen.getByText(/would land in the Jobs tracker/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('↺ Reset demo'));
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((box) => expect(box).toBeChecked());
  });
});
