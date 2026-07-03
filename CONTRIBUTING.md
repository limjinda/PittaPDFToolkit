# Contributing to PittaPDFToolkit

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app/) (Rust) |
| UI framework | React 19 + TypeScript (strict) |
| Bundler | Vite 7 |
| Styling | Tailwind CSS v4 |
| State | Zustand + Zundo (undo/redo) |
| PDF rendering | pdf.js (pdfjs-dist) |
| PDF manipulation | pdf-lib |
| Persistence | @tauri-apps/plugin-store |

---

## Coding Rules

### TypeScript

- **Strict mode is enforced** — `tsconfig.json` has `"strict": true`. No `any`, no type assertions without justification.
- Prefer `type` over `interface` for simple shapes; use `interface` when extension is intended.
- Export types explicitly (`export type { Foo }`).

### React

- **Functional components only** — no class components.
- **Use hooks** — encapsulate stateful logic in custom hooks (`use*.ts` files).
- **Avoid prop drilling** — if a value needs to pass through more than two levels, put it in a Zustand store or React context.
- **Prefer composition** — build complex UIs from small, focused components rather than growing a single component.

### File & Feature Structure

- **Every feature is isolated** under `src/features/<feature-name>/`.
- Shared UI primitives live in `src/components/ui/`.
- Cross-feature utilities live in `src/lib/`.
- Global state lives in `src/store/`.

```
src/
├── components/       # Shared, reusable UI components
│   └── ui/           # Primitive UI building blocks (Button, etc.)
├── features/         # One folder per product feature
│   ├── editor/
│   ├── recent/
│   ├── toolbar/
│   └── viewer/
├── lib/              # Pure utilities and Tauri helpers
│   ├── pdf/
│   └── tauri/
└── store/            # Zustand global stores
```

### Documentation

- **Every exported function must have a JSDoc comment** explaining what it does, its parameters, and its return value.
- Keep comments current — stale or misleading comments are worse than none.
- **No commented-out dead code** — delete it; Git history preserves it.

```ts
// ✅ Good
/**
 * Reads a PDF file from the given absolute path via the Tauri backend.
 * @param path - Absolute OS path to the PDF file.
 * @returns Parsed file metadata and raw bytes.
 * @throws If the file cannot be read or is not a valid PDF.
 */
export async function readPdfByPath(path: string): Promise<OpenedFile> { … }

// ❌ Bad — no docs, magic string inline
export async function doThing(p: string) { … }
```

### Size Limits

| Unit | Limit |
|---|---|
| Component file | ≤ 250 lines |
| Function body | ≤ 40 lines when possible |

When a component exceeds 250 lines, extract sub-components or custom hooks.

### Numbers & Constants

- **No magic numbers** — every non-obvious numeric literal must be a named constant.

```ts
// ✅ Good
const MAX_RECENT_FILES = 10;
const PDF_MIME_TYPE = "application/pdf";

// ❌ Bad
const updated = list.slice(0, 10);
```

### Logic & Duplication

- **No duplicated business logic** — if the same logic appears in two places, extract it to a shared utility in `src/lib/`.
- Keep business logic out of components; put it in hooks or lib functions.

### Async & Error Handling

- **Use `async/await`** — avoid raw `.then()` chains except for fire-and-forget registration (e.g., event listener setup).
- **Handle every possible error** — wrap all async calls that can fail in `try/catch`.
- **Never silently ignore exceptions** — at minimum, log the error. If user-facing, show a toast or error state.

```ts
// ✅ Good
try {
  const bytes = await readFile(path);
  return bytes;
} catch (err) {
  console.error(`[readFile] Failed to read "${path}":`, err);
  throw new Error(`Could not open file: ${path}`);
}

// ❌ Bad
try {
  const bytes = await readFile(path);
  return bytes;
} catch {
  // silently swallowed
}
```

### UI Thread

- **Never block the UI thread** — all file I/O, PDF parsing, and heavy computation must be `async` and awaited properly.
- Long operations should show loading state to the user.

### Testability

- **Every feature must be testable** — keep side-effectful code (Tauri `invoke`, file I/O) behind thin wrapper functions in `src/lib/tauri/` so they can be mocked in tests.
- Pure transformation functions (e.g., sorting, filtering, formatting) must have no dependencies on Tauri APIs.

### Naming

- **Descriptive naming** — names should explain *what* not *how*.
- Files: `camelCase.ts` for utilities, `PascalCase.tsx` for components.
- Constants: `SCREAMING_SNAKE_CASE`.
- Types/Interfaces: `PascalCase`.
- Hooks: `useDescriptiveName`.

```ts
// ✅ Good
const sortedByLastOpened = recentFiles.sort(…);

// ❌ Bad
const arr2 = files.sort(…);
```

### Dependencies

- **No unnecessary dependencies** — before adding an npm package, check if the feature can be achieved with existing deps or a small utility function.
- Every new dependency must be justified in the PR description.

---

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(recent): add remove button to recent file rows
fix(dropzone): correct Tauri v2 drag-drop event type names
refactor(pdfLoader): extract cache key logic into helper
docs: update CONTRIBUTING with async error handling rules
```

---

## UI Design Rules

### Philosophy

This is a **productivity tool**, not a portfolio piece. Every design decision should make the user faster, not more impressed. When in doubt, do less.

### Style

| Principle | Meaning |
|---|---|
| **Minimal** | Show only what is needed for the current task. Hide everything else. |
| **Clean** | Generous whitespace, clear hierarchy, no visual noise. |
| **Flat** | Flat shapes and single-colour fills. No skeuomorphism. |
| **Native feeling** | Match the OS's conventions. Feel like it belongs on the desktop, not in a browser. |

### What to Avoid

- ❌ **Glassmorphism** — no frosted-glass backgrounds or `backdrop-blur` on interactive surfaces.
- ❌ **Fancy animations** — no bounces, springs, or attention-seeking transitions.
- ❌ **Gradient overload** — gradients only as subtle backgrounds, never on text or primary actions.
- ❌ **Heavy shadows** — use `shadow-sm` at most; avoid layered or coloured shadows.

### Layout & Navigation

- **Toolbar contains only frequently used actions.** Secondary actions belong in a context menu or settings panel.
- **Everything must be reachable within two clicks** from the main view.
- Do not hide critical functionality behind hover states alone — it must also be discoverable without a mouse.

### Motion

- **All animations must complete in ≤ 150 ms.**
- Use `transition-colors` and `transition-opacity` for micro-feedback (hover, focus, active states).
- Never animate layout shifts (no animating `height`, `width`, or positional properties on data-driven lists).
- Prefer instant state changes for actions the user explicitly triggered (button clicks, keyboard shortcuts).

```css
/* ✅ Acceptable */
transition: opacity 100ms ease, color 100ms ease;

/* ❌ Too slow / distracting */
transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1); /* spring bounce */
```

### Colour & Theme

- **Support light mode, dark mode, and system preference** via the `prefers-color-scheme` media query and the app's theme store.
- Use CSS custom properties (`--color-*`) from the design token layer — never hardcode hex values in components.
- Ensure every colour combination meets **WCAG AA contrast** (4.5 : 1 for text, 3 : 1 for UI components).

### Display

- **Support High DPI (Retina / 2×) screens.** Use SVG icons or icon fonts; never raster icons at fixed pixel sizes.
- Layout must not break or overflow at 125 %, 150 %, or 200 % OS display scaling.
- Test at the minimum window size (800 × 600) as well as maximised.
