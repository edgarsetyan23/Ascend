import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../App.jsx'
import { ToastProvider } from '../context/ToastContext.jsx'

const auth = vi.hoisted(() => ({ user: { email: 'test@example.com' }, loading: false }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../lib/api.js', () => ({
  listEntries: vi.fn().mockResolvedValue([]),
  createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(),
}))

let notification
beforeEach(() => {
  localStorage.clear()
  auth.user = { email: 'test@example.com' }
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 12, 8, 59, 50))
  notification = vi.fn(function () {})
  notification.permission = 'default'
  notification.requestPermission = vi.fn(async () => {
    notification.permission = 'granted'
    return 'granted'
  })
  vi.stubGlobal('Notification', notification)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const app = () => (
  <StrictMode><MemoryRouter><ToastProvider><App /></ToastProvider></MemoryRouter></StrictMode>
)
const togglePanel = () => fireEvent.click(screen.getByRole('button', { name: 'Notification settings' }))
const advance = (ms) => act(() => vi.advanceTimersByTime(ms))

test('reminders survive closing settings, share edits, and disable without duplicates', async () => {
  await act(async () => { render(app()) })
  togglePanel()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Enable daily reminder', pressed: false })) })
  expect(notification.requestPermission).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '09:01' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Job Applications/ }))
  togglePanel()
  expect(screen.queryByLabelText('Reminder time')).not.toBeInTheDocument()
  advance(60_000)
  expect(notification).not.toHaveBeenCalled()
  advance(10_000)
  expect(notification).toHaveBeenCalledTimes(1)
  expect(notification.mock.calls[0][1].body).toContain('LeetCode')
  expect(notification.mock.calls[0][1].body).not.toContain('Jobs')

  togglePanel()
  expect(screen.getByLabelText('Reminder time')).toHaveValue('09:01')
  fireEvent.click(screen.getByRole('checkbox', { name: /Job Applications/ }))
  advance(10_000)
  expect(notification).toHaveBeenCalledTimes(1)
  togglePanel()
  advance(30_000)
  expect(notification).toHaveBeenCalledTimes(1)
  togglePanel()
  fireEvent.click(screen.getByRole('button', { name: 'Enable daily reminder', pressed: true }))
  togglePanel()
  advance(24 * 60 * 60 * 1000)
  expect(notification).toHaveBeenCalledTimes(1)
  expect(JSON.parse(localStorage.getItem('notification_settings')).enabled).toBe(false)
})

test('saved reminders run without opening settings and stop when authentication ends', async () => {
  notification.permission = 'granted'
  localStorage.setItem('notification_settings', JSON.stringify({ enabled: true, time: '09:00', trackers: ['jobs'] }))
  let view
  await act(async () => { view = render(app()) })
  advance(10_000)
  expect(notification).toHaveBeenCalledTimes(1)
  auth.user = null
  view.rerender(app())
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  advance(24 * 60 * 60 * 1000)
  expect(notification).toHaveBeenCalledTimes(1)
})
