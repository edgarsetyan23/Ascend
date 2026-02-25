import { useState, useEffect, useCallback } from 'react';
import {
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
} from '../lib/api.js';

/**
 * useEntries — API-backed replacement for useStorage.
 *
 * Replaces localStorage reads/writes with real DynamoDB operations
 * via the Lambda API. Keeps the same public interface so App.jsx
 * needs minimal changes:
 *   { entries, addEntry, updateEntry, deleteEntry, loading, error }
 *
 * Optimistic update strategy:
 *   1. Apply the change to local state immediately (instant UI feedback)
 *   2. Fire the API call in the background
 *   3. On success: replace the optimistic record with the server's response
 *      (which may include server-generated fields like updatedAt)
 *   4. On failure: roll back to the previous state and surface the error
 *
 * Interview point: "optimistic UI" is a pattern used by apps like
 * Twitter/X — your like registers instantly and only rolls back if
 * the server rejects it. The alternative (waiting for the API) makes
 * every interaction feel laggy.
 *
 * @param {string} trackerId - e.g. 'fitness', 'jobs', 'books'
 */
export function useEntries(trackerId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Incrementing this re-triggers the fetch without changing trackerId.
  // Used by refetch() so the error toast can offer a "Retry" button.
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  // Re-runs whenever trackerId changes (user switches tabs) or when
  // refetch() is called (user retries after a load error).
  useEffect(() => {
    let cancelled = false; // prevents setState on unmounted component

    setLoading(true);
    setError(null);

    listEntries(trackerId)
      .then((data) => {
        if (!cancelled) {
          setEntries(data);
          // Keep a local cache so useNotifications can read stats without an API call
          try { localStorage.setItem(`tracker_${trackerId}`, JSON.stringify(data)) } catch {}
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Cleanup: if the user switches trackers before the fetch completes,
    // ignore the stale response (race condition prevention).
    return () => { cancelled = true; };
  }, [trackerId, fetchKey]);

  // ── addEntry ───────────────────────────────────────────────────────────────
  const addEntry = useCallback(async (data) => {
    // 1. Build optimistic record with a temp id
    const tempId = crypto.randomUUID();
    const optimistic = { ...data, id: tempId, createdAt: Date.now() };

    // 2. Show it immediately
    setEntries((prev) => [optimistic, ...prev]);

    try {
      // 3. Create on server
      const created = await createEntry(trackerId, data);
      // 4. Replace temp record with real server record (real id + createdAt)
      setEntries((prev) =>
        prev.map((e) => (e.id === tempId ? created : e))
      );
      return created;
    } catch (e) {
      // 5. Roll back on failure
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
      setError(e.message);
      throw e; // let the caller know it failed
    }
  }, [trackerId]);

  // ── updateEntry ────────────────────────────────────────────────────────────
  const updateEntry_ = useCallback(async (id, data) => {
    // 1. Save old state for rollback
    setEntries((prev) => {
      const previous = prev;
      const optimistic = prev.map((e) =>
        e.id === id ? { ...e, ...data, updatedAt: Date.now() } : e
      );

      // 2. Fire API in parallel (we're inside setState so we schedule it)
      updateEntry(trackerId, id, data)
        .then((updated) => {
          setEntries((cur) =>
            cur.map((e) => (e.id === id ? updated : e))
          );
        })
        .catch((e) => {
          // Roll back to the state we captured above
          setEntries(previous);
          setError(e.message);
        });

      return optimistic;
    });
  }, [trackerId]);

  // ── deleteEntry ────────────────────────────────────────────────────────────
  const deleteEntry_ = useCallback(async (id) => {
    // 1. Remove from UI immediately
    setEntries((prev) => {
      const removed = prev;
      const next = prev.filter((e) => e.id !== id);

      // 2. Fire API
      deleteEntry(trackerId, id).catch((e) => {
        // Roll back
        setEntries(removed);
        setError(e.message);
      });

      return next;
    });
  }, [trackerId]);

  return {
    entries,
    addEntry,
    updateEntry: updateEntry_,
    deleteEntry: deleteEntry_,
    loading,
    error,
    refetch,
  };
}
