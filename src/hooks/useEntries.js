import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
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
  const mutationScope = useRef(null);

  // Each visit to a tracker owns its completions, including when switching back.
  useLayoutEffect(() => {
    mutationScope.current = {};
    return () => { mutationScope.current = null; };
  }, [trackerId]);

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
    const scope = mutationScope.current;
    // 1. Build optimistic record with a temp id
    const tempId = crypto.randomUUID();
    const optimistic = { ...data, id: tempId, createdAt: Date.now() };

    // 2. Show it immediately
    setEntries((prev) => [optimistic, ...prev]);

    try {
      // 3. Create on server
      const created = await createEntry(trackerId, data);
      if (mutationScope.current !== scope) return created;
      // 4. Replace temp record with real server record (real id + createdAt)
      setEntries((prev) =>
        prev.map((e) => (e.id === tempId ? created : e))
      );
      return created;
    } catch (e) {
      // 5. Roll back on failure
      if (mutationScope.current === scope) {
        setEntries((prev) => prev.filter((e) => e.id !== tempId));
        setError(e.message);
      }
      throw e; // let the caller know it failed
    }
  }, [trackerId]);

  // ── updateEntry ────────────────────────────────────────────────────────────
  const updateEntry_ = useCallback(async (id, data) => {
    const scope = mutationScope.current;
    // Capture only this record; unrelated mutations must survive a rollback.
    let previous;
    let optimistic;
    setEntries((prev) => {
      previous = prev.find((e) => e.id === id);
      optimistic = previous && { ...previous, ...data, updatedAt: Date.now() };
      return prev.map((e) => (e.id === id ? optimistic : e));
    });

    try {
      // 2. Await the real request so callers can rely on this promise
      //    settling only once the server has actually confirmed the update.
      const updated = await updateEntry(trackerId, id, data);
      if (mutationScope.current === scope) {
        setEntries((cur) => cur.map((e) => (e === optimistic ? updated : e)));
      }
      return updated;
    } catch (e) {
      // Restore only our optimistic version, preserving later changes.
      if (mutationScope.current === scope) {
        setEntries((cur) => cur.map((entry) => (entry === optimistic ? previous : entry)));
        setError(e.message);
      }
      throw e; // let the caller know it failed
    }
  }, [trackerId]);

  // ── deleteEntry ────────────────────────────────────────────────────────────
  const deleteEntry_ = useCallback(async (id) => {
    const scope = mutationScope.current;
    // 1. Remove from UI immediately
    let removed;
    let followingIds;
    setEntries((prev) => {
      const index = prev.findIndex((e) => e.id === id);
      removed = prev[index];
      followingIds = prev.slice(index + 1).map((e) => e.id);
      return prev.filter((e) => e.id !== id);
    });

    try {
      // 2. Await the real request (see updateEntry above for why)
      await deleteEntry(trackerId, id);
    } catch (e) {
      // Restore the deleted record beside its surviving successors.
      if (mutationScope.current === scope) {
        setEntries((cur) => {
          if (!removed || cur.some((entry) => entry.id === id)) return cur;
          const index = cur.findIndex((entry) => followingIds.includes(entry.id));
          const insertion = index < 0 ? cur.length : index;
          return [...cur.slice(0, insertion), removed, ...cur.slice(insertion)];
        });
        setError(e.message);
      }
      throw e; // let the caller know it failed
    }
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
