# AT Protocol App Builder - Claude Instructions

## Project Overview

A wizard-style web app that helps users create ATProtocol-powered web applications.
Built with TypeScript, Vite, vanilla JS. No framework.

## Workflow Rules

### Before Starting Work

1. Check `BACKLOG.md` for the current task list
2. Read the relevant spec in `.specs/active/` before writing any code
3. If no spec exists for the work, create one from `.specs/TEMPLATE.md` first

### During Work

- Make atomic changes: one logical change per commit
- Run `npm run build` to verify TypeScript compiles after changes
- Run `npx vitest run` to verify tests pass after changes
- Keep changes scoped to what the spec describes — do not refactor adjacent code

### After Work

- Update `BACKLOG.md` to reflect completed work
- If the spec is fully implemented, move it to `.specs/done/`

## Project Structure

- `src/app/` — Wizard UI (steps, navigation, state, dialogs)
- `src/generator/` — Code generator that produces output apps
- `src/types/` — TypeScript interfaces (WizardState, etc.)
- `src/utils/` — Shared utilities
- `styles.css` — Main stylesheet
- `index.html` — Entry point

## Testing

- Test runner: Vitest
- Tests live in `tests/` at project root
- Run all tests: `npx vitest run`
- Run in watch mode: `npx vitest`
- Write tests for any new logic in `src/generator/` and `src/utils/`
- Generator functions are the highest-value test targets (they produce output apps)
