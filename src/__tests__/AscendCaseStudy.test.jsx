import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AscendCaseStudy } from '../components/portfolio/AscendCaseStudy.jsx';

// Rendered in isolation, not through RecruiterView — the full page
// pulls in pdfjs-dist (ResumeReview.jsx), which needs DOMMatrix and
// isn't available in this jsdom test environment. AscendCaseStudy has
// no such dependency, so it's tested directly instead.
describe('AscendCaseStudy', () => {
  test('renders every required case-study section', () => {
    render(<AscendCaseStudy />);
    ['The problem', 'System overview', 'Engineering decisions', 'Limitations and next steps', 'Explore']
      .forEach((heading) => expect(screen.getByText(heading)).toBeInTheDocument());
    expect(screen.getByText(/One workflow in detail/)).toBeInTheDocument();
  });

  test('lists all three engineering decisions', () => {
    render(<AscendCaseStudy />);
    expect(screen.getByText(/One DynamoDB table, one partition per user/)).toBeInTheDocument();
    expect(screen.getByText(/A separate Lambda for the page you.re reading right now/)).toBeInTheDocument();
    expect(screen.getByText(/Gmail → metadata → Claude → a review modal/)).toBeInTheDocument();
  });

  test('the architecture diagram has an accessible title and a text equivalent', () => {
    render(<AscendCaseStudy />);
    expect(screen.getByRole('img', { name: /Ascend request flow/i })).toBeInTheDocument();
    expect(screen.getByText('The flow, in words:')).toBeInTheDocument();
  });

  test('includes the sample-data demo and a link to the real source', () => {
    render(<AscendCaseStudy />);
    expect(screen.getByText('Interactive demo · Sample data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View the full source on GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/edgarsetyan23/Ascend'
    );
  });
});
