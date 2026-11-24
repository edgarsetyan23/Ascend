---
name: add-tracker
description: Add a new tracker type to Ascend (e.g. "reading", "workouts") end to end — frontend config, registry, stats, backend allowlist, and tests. Use when asked to add, create, or support a new kind of tracker.
---

# Add a tracker

Trackers are data-driven: one config object drives the table, entry modal,
sidebar, and CSV export. The backend routes are already generic
(`/trackers/{trackerId}/entries`), but the tracker ID must be allowlisted
because it becomes a DynamoDB sort-key prefix.

## Checklist

1. **Config** — create `src/trackers/<id>.js`, modeled on `leetcode.js`:

   ```js
   export default {
     id: '<id>',               // lowercase, stable forever (it's in DynamoDB keys)
     name: '<Display Name>',
     icon: '<emoji>',
     color: '#rrggbb',
     dateField: 'date',
     defaultSort: { key: 'date', dir: 'desc' },
     columns: [
       { key: 'date', label: 'Date', type: 'date', required: true },
       { key: 'status', label: 'Status', type: 'select', required: true,
         options: ['A', 'B'], badge: { A: { bg: '#d1fae5', color: '#065f46' } } },
       // types in use today: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'url'
     ],
   }
   ```

   Look at how the existing tracker files shape their columns before adding
   a new column `type`. Don't invent one the table/modal doesn't render.

2. **Register** it in `src/trackers/index.js` (import + `TRACKER_CONFIGS`
   entry). The sidebar and hash routing in `TrackerApp.jsx` read from here.

3. **Stats (optional)** — add a builder to `STAT_BUILDERS` in
   `src/utils/stats.js` returning `[{ label, value, color }]`. Without one
   the stats bar is just empty for that tracker.

4. **Custom view (only if needed)** — `TrackerApp.jsx` special-cases
   `resume`, `leetcode`, `jobs`, `activity`, and `gaming`. A plain tracker
   needs no change here.

5. **Backend allowlist** — add the ID to `VALID_TRACKERS` in
   `infra/lambda/shared/validate.mjs`, and add a case to
   `infra/lambda/__tests__/validate.test.mjs`.

6. **Public visibility** — by default a new tracker is **private**. Only add
   it to `ALLOWED_TRACKERS` in `infra/lambda/public-entries-list.mjs` if the
   owner explicitly asks for it on the public portfolio.

7. **Verify**
   - `npm test` and `npm --prefix infra test`
   - `npm run build`, then `npx vite preview` (see CLAUDE.md gotchas:
     dummy Cognito env, clear the service worker) and confirm the tracker
     appears in the sidebar and the add-entry modal renders every column.

8. **Deploy note for the user** — the frontend ships with the next Vercel
   deploy, but saving entries returns 400 until the backend allowlist is
   deployed with `cd infra && npx cdk deploy`. Tell the user. Don't run it
   yourself.
