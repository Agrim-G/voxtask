# VoxTask

A voice-first to-do dashboard prototype built with React, TypeScript, Vite and Tailwind CSS.

- Dictate with the browser's Web Speech API, or type.
- A **rule-based parser (not AI)** turns text into draft tasks. You review and edit them before anything is saved.
- Tasks are stored in your browser's `localStorage`. Memories are stored in `IndexedDB`. There is no backend, no account and no API key.
- A local **Memory** feature lets you save preferences and routines and get optional, keyword-based suggestions.

## Run on Windows (PowerShell)

1. Install **Node.js 18 or newer (LTS)** from https://nodejs.org. Check it worked:

   ```powershell
   node -v
   npm -v
   ```

2. Extract `voxtask.zip`, then open PowerShell in the extracted `voxtask` folder:

   ```powershell
   cd C:\path\to\voxtask
   ```

   Tip: in File Explorer, open the folder, click the address bar, type `powershell` and press Enter.

3. Install dependencies (once):

   ```powershell
   npm install
   ```

4. Start the app:

   ```powershell
   npm run dev
   ```

5. Open the address it prints (usually http://localhost:5173) in **Chrome or Edge**.

Stop the server with `Ctrl + C`.

### If PowerShell blocks npm
If you see "running scripts is disabled on this system", run this once, then retry:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## Voice input notes
- Works in Chrome, Edge and Safari on `localhost` or HTTPS. Firefox has no support, so typing is the fallback.
- Chrome sends audio to Google's speech service, so it needs an internet connection.
- Click the mic, allow microphone access, speak, then click stop.
- If access is denied, allow it from the lock icon in the address bar.

## Parser limits
Understands: today, tomorrow, weekdays, `15 March`, `15/03` (day/month), `2026-03-15`, `9 AM`, `18:00`, `from 9 to 11`, `for an hour`, `30 minutes`. Vague phrases like "after lunch" are kept as a note and never turned into a time. When AM/PM is missing it makes a guess and says so in the review step.

## Memory

### What it is
Facts you explicitly choose to save, such as "I prefer studying before noon". VoxTask never creates memories on its own, and it does not learn from your task history. Matching uses plain keyword rules. It is **not AI, semantic search or machine learning**, and nothing is sent to any service.

### Creating memories
Type or dictate in the capture box:

- `Remember that I prefer studying before noon.`
- `Remember that my gym session takes 90 minutes.`
- `Remember that VoxTask is my personal productivity project.`

You get an editable preview (text and category). Nothing is saved until you press **Save memory**. Unclear commands (for example `Remember to call mom`, which is a task) get a clarification message instead of a memory. Passwords, keys and card-like numbers are refused.

You can also use **Memory → New memory**.

### Other voice/text commands
| Say | Result |
| --- | --- |
| `What do you remember about me?` | Lists saved memories |
| `Forget my study preference` | Shows matching memories. You pick which one to delete |
| `Turn memory off` / `Turn memory on` | Disables or enables memory use without deleting anything |
| `Study reasoning tomorrow. Don't use memory for this task.` | Creates the task with memory skipped for it |

### Memory Center
Open **Memory** in the sidebar (or bottom bar on mobile) to search, filter by category, add, edit and delete memories, **Clear all** (with confirmation), **Export JSON**, **Import JSON** (validated, duplicates skipped) and switch **Use memory** on or off.

### Suggestions
When you review parsed tasks or create or edit a task, relevant memories are read from IndexedDB and shown with optional suggestions. Examples are a duration the memory states, an exact start time only if the memory states one, or a timing note such as "before noon". Each suggestion has **Accept** and **Dismiss**. Nothing is applied automatically, and vague preferences never become an invented time.

### How IndexedDB is used
- Database `voxtask-memory`, version 1, object store `memories` (key `id`, indexes on `updatedAt` and `category`).
- Each record: `id`, `content`, `category` (Preference, Routine, Goal, Project, Other), `keywords`, `createdAt`, `updatedAt` (ISO 8601), `source` (always `manual`).
- Tasks stay in `localStorage` under `voxtask.tasks.v1`. They are not migrated or touched.
- The on/off setting is kept in `localStorage` under `voxtask.memory.enabled`.
- Malformed records are skipped and counted instead of crashing the app. If IndexedDB is unavailable, the Memory Center shows an error and the rest of the app keeps working.

### Where data lives, limits and privacy
- Data is stored in this browser profile only. It is **not synced** between devices or browsers.
- It is **not encrypted**, and it is lost if you clear site data. Use **Export JSON** for backups.
- Private browsing modes may disable or wipe IndexedDB.
- VoxTask has no analytics and sends no memory contents anywhere.
- Voice dictation uses your browser's speech recognition, which may send audio to an online speech service (Chrome does). Typing avoids this.
- Don't store secrets as memories.

## Tests

```powershell
npm test
```

Runs Vitest against an in-memory IndexedDB (`fake-indexeddb`). It covers the storage layer, command parsing, validation, import/export, suggestions and a parser regression check.

## Other commands

```powershell
npm run build     # type-check and create a production build in dist/
npm run preview   # serve the production build locally
```

## Structure

```
src/
  App.tsx              dashboard, views, state
  types.ts             Task and form types
  lib/                 dates, parser, storage, task helpers
  hooks/useSpeech.ts   Web Speech API wrapper
  memory/              IndexedDB repository, commands, suggestions, store hook
  components/          capture, review, task list, schedule, dialogs
```

## Reset data
Browser DevTools → Application → Local Storage → delete `voxtask.tasks.v1`, then refresh.
