# Ascend — UI Improvements

## What this document covers
The three experience polish items shipped in this session — skeleton loaders, toast notifications, and improved empty states — why they were chosen, and how they work. Also covers what was deliberately left out.

---

## The core principle

> Dead space is not bad. **Unintentional** dead space is.

The goal was to fill perceived empty time and space with signals that feel like the app is working — not to add decoration. Every change had to be defensible under a "professional, backend-focused aesthetic" constraint.

---

## 1. Skeleton loaders

### What changed
`AppShell` previously rendered a centered `<div>Loading entries…</div>` while `useEntries` fetched from DynamoDB. Now it renders `<SkeletonTable tracker={tracker} />`.

### How it works

```
src/components/SkeletonTable.jsx
```

`SkeletonTable` receives the same `tracker` object as `TrackerTable`. It filters out `textarea`-type columns the same way (`visibleColumns`), then renders:

1. A disabled toolbar area (shimmer search bar + shimmer buttons)
2. A `<table>` with shimmer `<th>` cells matching the real column count
3. Six shimmer `<tr>` rows — widths vary by position so they look natural

CSS: one `@keyframes shimmer` animation moves a gradient left-to-right across every `.skeleton` element. Dark mode swaps the gradient colors.

### Why this matters for interviews
"I replaced a loading text with skeleton loaders" is a surface-level answer. The better answer: **skeletons prevent cumulative layout shift**. When content arrives after a spinner, elements jump into place. A skeleton that matches the final layout means nothing shifts — the data just materializes where the placeholders were.

### Code location
```
src/components/SkeletonTable.jsx   — component
src/index.css                      — .skeleton, .skeleton--*, @keyframes shimmer
src/App.jsx line ~155              — swap site
```

---

## 2. Toast notifications

### What changed
- Removed the static `api-error-banner` div from `AppShell`
- Added `ToastProvider` to `main.jsx` (wraps the entire tree)
- Added `useToast().addToast()` calls in `AppShell` for errors and CRUD success

### How it works

```
src/context/ToastContext.jsx
```

The toast system is a React context with a `useReducer` store:

```
addToast(message, variant, { onRetry })
    │
    ▼
dispatch ADD ──► state = [...prev.slice(-3), newToast]   (max 4 visible)
    │
    └── setTimeout(dispatch REMOVE, duration)             (auto-dismiss)
```

Variants and their durations:
- `success` — 3 seconds, green left border
- `error` — 6 seconds, red left border, optional Retry button
- `info` — 4 seconds, accent left border

The container renders `position: fixed; bottom: 24px; right: 24px` so toasts never disrupt layout. `pointer-events: none` on the container means toasts don't block clicks on the content behind them — only the toast elements themselves are clickable.

### Retry button

`addToast(error, 'error', { onRetry: refetch })` — when the user clicks Retry, `refetch()` from `useEntries` increments an internal `fetchKey` counter, which re-triggers the `useEffect` that calls the API. Clean, no component coupling.

`refetch` was added to `useEntries` in this session:
```js
const [fetchKey, setFetchKey] = useState(0)
const refetch = useCallback(() => setFetchKey((k) => k + 1), [])
useEffect(() => { /* fetch */ }, [trackerId, fetchKey])
```

### What triggers toasts
| Action | Toast |
|---|---|
| DynamoDB load fails | error + Retry button |
| Entry added successfully | success, 3s |
| Entry updated successfully | success, 3s |
| Entry deleted | success, 3s |
| CRUD operation fails | error (shown when `useEntries` rolls back and sets `error`) |

### Code location
```
src/context/ToastContext.jsx    — provider, hook, UI components
src/main.jsx                    — ToastProvider wraps app
src/App.jsx                     — useToast(), useEffect for errors, success calls
src/index.css                   — .toast*, .toast-container, @keyframes toast-in
```

---

## 3. Improved empty states

### What changed
`TrackerTable` previously rendered:
```
No entries yet. Click "+ Add Entry" to start tracking!
```
or:
```
No entries match your search.
```

Both were plain text in a `div`. Now there are two distinct states:

**First-time empty (0 entries in this tracker):**
- Large faded tracker icon (`opacity: 0.25`) — visual anchor
- `"No {tracker.name} entries yet"` — specific to the current tracker
- `"Track your first entry to get started"` — soft call to action
- `+ Add First Entry` button — direct CTA, calls the same `onAdd` prop

**Search returned nothing:**
- `"No results for '{search}'"` — shows the user exactly what they searched
- `Clear search` button — one click to reset, no need to find the input

### Why two separate states
A new user seeing "No results for ''" is confusing. A returning user who searched sees "No entries yet" and might think their data is gone. The distinction makes each state contextually accurate.

### Code location
```
src/components/TrackerTable.jsx  — .table-empty-state JSX
src/index.css                    — .table-empty-state, .table-empty-icon, etc.
```

---

## What was deliberately not built

### Pagination / virtualization
The tracker tables will stay small for a personal productivity tool (hundreds, not tens of thousands of entries). DynamoDB's `Query` with `begins_with` is O(entries per tracker) — there's no full-table scan. Pagination would add complexity with no real payoff at this scale.

If entries ever grew large enough to matter, the right move is DynamoDB pagination (using `LastEvaluatedKey`) plus `react-virtual` for the DOM — not a traditional page-number UI.

### Structured logging / observability
The Lambda functions have `console.error` calls. CloudWatch automatically captures these. Adding structured logging (JSON log lines with request IDs, latency, trace IDs) would be the right next step for moving toward mid-level backend maturity — but it's a backend-only change and is tracked separately in `docs/04-positioning.md`.
