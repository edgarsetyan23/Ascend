import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ResumeReview } from '../components/ResumeReview.jsx'
import { analyzeResume } from '../utils/resumeAnalyzer.js'

vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }))
vi.mock('../utils/resumeAnalyzer.js', () => ({ analyzeResume: vi.fn() }))

const resume = 'Built reliable services with AWS and improved response times. '.repeat(8)
const result = { overall: 80, categories: [], recommendations: [], highlights: { awsServices: [], techStack: [] }, wordCount: 80 }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => result }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks() })

function mount(save) {
  function Harness() {
    const [entries, setEntries] = useState([])
    return <ResumeReview entries={entries} loading={false} addEntry={async value => {
      await save(value)
      setEntries([{ ...value, id: 'scan-1', createdAt: Date.now() }])
    }} />
  }
  return render(<Harness />)
}

test.each(['paste', 'pdf'])('rejected save preserves %s input and allows a successful retry', async mode => {
  const save = vi.fn().mockRejectedValueOnce(new Error('Save unavailable')).mockResolvedValueOnce(undefined)
  const { container } = mount(save)
  if (mode === 'paste') {
    fireEvent.click(screen.getByRole('button', { name: 'Paste Text' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: resume } })
    fireEvent.click(screen.getByRole('button', { name: /Analyze Resume/ }))
  } else {
    const { getDocument } = await import('pdfjs-dist')
    getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({
      getTextContent: async () => ({ items: [{ str: resume, transform: [1, 0, 0, 1, 0, 0] }] }),
    }) }) })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [{ arrayBuffer: async () => new ArrayBuffer(0) }] } })
  }
  expect(await screen.findByRole('alert')).toHaveTextContent(/save.*try again/i)
  expect(screen.queryByText(/Analyzing with Claude/)).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue(resume)
  fireEvent.click(screen.getByRole('button', { name: /Analyze Resume/ }))
  expect(await screen.findByText('Past Scans')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(save).toHaveBeenCalledTimes(2)
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0])
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ text: resume })
})

test('scoring failure clears loading, preserves text, and permits retry', async () => {
  fetch.mockRejectedValueOnce(new Error('Offline'))
  analyzeResume.mockImplementationOnce(() => { throw new Error('Scoring failed') })
  const save = vi.fn().mockResolvedValue(undefined)
  mount(save)
  fireEvent.click(screen.getByRole('button', { name: 'Paste Text' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: resume } })
  fireEvent.click(screen.getByRole('button', { name: /Analyze Resume/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/score.*try again/i)
  expect(screen.queryByText(/Analyzing with Claude/)).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue(resume)
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Analyze Resume/ }))
  await waitFor(() => expect(screen.getByText('Past Scans')).toBeInTheDocument())
  expect(save).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
