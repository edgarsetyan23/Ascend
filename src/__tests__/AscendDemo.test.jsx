import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AscendDemo } from '../components/portfolio/AscendDemo.jsx';

describe('AscendDemo', () => {
  // RecruiterView.jsx's "Try the sample workflow" shortcut finds this
  // element with document.getElementById('ascend-demo-heading') and
  // calls .focus() on it once the case study mounts — a MutationObserver
  // fallback covers the mount timing itself (untestable here: the full
  // RecruiterView tree pulls in pdfjs-dist, which needs DOMMatrix and
  // isn't available in jsdom), but this contract — the id existing and
  // being focusable — is exactly what that shortcut depends on, and is
  // real to break if AscendDemo's markup changes later.
  test('exposes a focusable heading at the id the "Try the sample workflow" shortcut targets', () => {
    render(<AscendDemo />);
    const heading = document.getElementById('ascend-demo-heading');
    expect(heading).not.toBeNull();
    expect(heading.tagName).toBe('H3');
    expect(heading).toHaveAttribute('tabindex', '-1');
    heading.focus();
    expect(heading).toHaveFocus();
  });

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
