import { useState, useEffect, useCallback } from 'react'

function storageKey(trackerId) {
  return `tracker_${trackerId}`
}

function loadEntries(trackerId) {
  try {
    const raw = localStorage.getItem(storageKey(trackerId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useStorage(trackerId) {
  const [entries, setEntries] = useState(() => loadEntries(trackerId))

  // Reload when tracker changes
  useEffect(() => {
    setEntries(loadEntries(trackerId))
  }, [trackerId])

  // Sync to localStorage whenever entries change
  useEffect(() => {
    localStorage.setItem(storageKey(trackerId), JSON.stringify(entries))
  }, [trackerId, entries])

  const addEntry = useCallback((data) => {
    const entry = { ...data, id: crypto.randomUUID(), createdAt: Date.now() }
    setEntries((prev) => [entry, ...prev])
    return entry
  }, [])

  const updateEntry = useCallback((id, data) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...data, updatedAt: Date.now() } : e))
    )
  }, [])

  const deleteEntry = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, addEntry, updateEntry, deleteEntry }
}
