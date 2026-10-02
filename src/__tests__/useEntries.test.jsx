import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useEntries } from '../hooks/useEntries.js';
import { listEntries, createEntry, updateEntry, deleteEntry } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  listEntries: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), deleteEntry: vi.fn(),
}));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const initial = [{ id: 'a', title: 'original' }, { id: 'b', title: 'other' }];

beforeEach(() => {
  vi.resetAllMocks();
  listEntries.mockResolvedValue(initial);
});

test.each(['addEntry', 'updateEntry', 'deleteEntry'])('%s failure after switching trackers cannot change entries or errors', async (method) => {
  const request = deferred();
  ({ addEntry: createEntry, updateEntry, deleteEntry })[method].mockReturnValue(request.promise);
  const { result, rerender } = renderHook(({ tracker }) => useEntries(tracker), { initialProps: { tracker: 'first' } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  let completion;
  act(() => {
    completion = (method === 'addEntry' ? result.current[method]({ title: 'new' }) : result.current[method]('a', { title: 'edited' })).catch(e => e);
  });
  const next = [{ id: 'a', title: 'second tracker' }];
  listEntries.mockResolvedValue(next);
  rerender({ tracker: 'second' });
  await waitFor(() => expect(result.current.entries).toEqual(next));
  await act(async () => { request.reject(new Error('old failure')); await completion; });
  expect(result.current.entries).toEqual(next);
  expect(result.current.error).toBeNull();
});

test.each(['updateEntry', 'deleteEntry'])('%s rollback preserves concurrent successful creates, updates and deletes', async (method) => {
  const request = deferred();
  listEntries.mockResolvedValue([...initial, { id: 'c', title: 'remove me' }]);
  ({ updateEntry, deleteEntry })[method].mockReturnValueOnce(request.promise);
  const { result } = renderHook(() => useEntries('first'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  let completion;
  act(() => { completion = result.current[method]('a', { title: 'pending' }).catch(e => e); });
  const created = { id: 'd', title: 'created' };
  const updated = { id: 'b', title: 'saved' };
  createEntry.mockResolvedValue(created);
  updateEntry.mockResolvedValue(updated);
  deleteEntry.mockResolvedValue(undefined);
  await act(async () => { await result.current.addEntry({ title: 'created' }); });
  await act(async () => { await result.current.updateEntry('b', { title: 'saved' }); });
  await act(async () => { await result.current.deleteEntry('c'); });
  await act(async () => { request.reject(new Error('failed')); await completion; });
  expect(result.current.entries).toEqual([created, initial[0], updated]);
  expect(result.current.error).toBe('failed');
});

test('old update success is ignored even after switching back to its tracker', async () => {
  const request = deferred();
  updateEntry.mockReturnValue(request.promise);
  const { result, rerender } = renderHook(({ tracker }) => useEntries(tracker), { initialProps: { tracker: 'first' } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  let completion;
  act(() => { completion = result.current.updateEntry('a', { title: 'old update' }); });
  rerender({ tracker: 'second' });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const fresh = [{ id: 'a', title: 'fresh' }];
  listEntries.mockResolvedValue(fresh);
  rerender({ tracker: 'first' });
  await waitFor(() => expect(result.current.entries).toEqual(fresh));
  await act(async () => { request.resolve({ id: 'a', title: 'old update' }); await completion; });
  expect(result.current.entries).toEqual(fresh);
});
