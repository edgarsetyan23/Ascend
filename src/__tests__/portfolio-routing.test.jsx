import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../App.jsx'

vi.mock('../components/RecruiterView.jsx', () => ({ RecruiterView: () => <h1>Public portfolio</h1> }))
vi.mock('../TrackerApp.jsx', () => ({ default: () => <h1>Private tracker</h1> }))
afterEach(cleanup)
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search + location.hash}</output> }
const mount = path => render(<MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter>)

test('the personal domain opens the portfolio without tracker authentication', async () => {
  mount('/')
  expect(await screen.findByRole('heading', { name: 'Public portfolio' })).toBeInTheDocument()
  expect(screen.queryByText('Private tracker')).not.toBeInTheDocument()
})
test('old portfolio links preserve query strings and fragments', async () => {
  mount('/portfolio?source=cv#portfolio-content')
  await screen.findByRole('heading', { name: 'Public portfolio' })
  expect(screen.getByTestId('location')).toHaveTextContent('/?source=cv#portfolio-content')
})
test('old tracker bookmarks still open their tracker tab', async () => {
  mount('/#jobs')
  await screen.findByRole('heading', { name: 'Private tracker' })
  expect(screen.getByTestId('location')).toHaveTextContent('/app#jobs')
})
test('the tracker is available at its new address', async () => {
  mount('/app')
  expect(await screen.findByRole('heading', { name: 'Private tracker' })).toBeInTheDocument()
})
