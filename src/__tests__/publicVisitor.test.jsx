import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DropZone } from '../components/ResumeReview.jsx'
import { LeetCodeProfile } from '../components/LeetCodeProfile.jsx'

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test.each(['Enter', ' '])('PDF upload opens from the keyboard with %s', key => {
  const { container } = render(<DropZone onFile={vi.fn()} isExtracting={false} />)
  const input = container.querySelector('input[type="file"]')
  const click = vi.spyOn(input, 'click')
  const upload = screen.getByRole('button', { name: 'Choose a resume PDF' })
  expect(upload).toHaveAttribute('tabindex', '0')
  fireEvent.keyDown(upload, { key })
  expect(click).toHaveBeenCalledOnce()
})

test('upload cannot reopen while the PDF is being extracted', () => {
  const { container } = render(<DropZone onFile={vi.fn()} isExtracting />)
  const click = vi.spyOn(container.querySelector('input'), 'click')
  fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
  expect(click).not.toHaveBeenCalled()
})

test('a failed public LeetCode fetch shows a source link rather than a false zero count', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
  render(<LeetCodeProfile fixedUsername="example" />)
  expect(await screen.findByText(/stats are temporarily unavailable/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /View the profile/ })).toHaveAttribute('href', 'https://leetcode.com/u/example/')
  expect(screen.queryByText('solved')).not.toBeInTheDocument()
})
