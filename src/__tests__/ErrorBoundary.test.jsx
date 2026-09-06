import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import { reloadPage } from '../utils/moduleLoadError.js'

vi.mock('../utils/moduleLoadError.js', async importOriginal => ({
  ...await importOriginal(), reloadPage: vi.fn(),
}))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })
function Broken({ message }) { throw new Error(message) }

it.each([
  'Failed to fetch dynamically imported module: https://example.com/assets/Guide.js',
  'Importing a module script failed.',
  'error loading dynamically imported module',
])('reloads after a cached module rejection: %s', message => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<div><p>Portfolio content</p><ErrorBoundary compact><Broken message={message} /></ErrorBoundary></div>)
  expect(screen.getByText('Portfolio content')).toBeInTheDocument()
  expect(screen.getByText('Mini Edgar is unavailable')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reload page' }))
  expect(reloadPage).toHaveBeenCalledOnce()
})

it('still retries an ordinary rendering error without reloading the page', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  function Recoverable() { if (broken) throw new Error('Temporary render failure'); return <p>Recovered</p> }
  render(<ErrorBoundary><Recoverable /></ErrorBoundary>)
  broken = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByText('Recovered')).toBeInTheDocument()
  expect(reloadPage).not.toHaveBeenCalled()
})
