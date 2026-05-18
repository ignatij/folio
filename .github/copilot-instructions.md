# GitHub Copilot instructions

## Project overview

Folio is a self-hostable blog platform: Go backend + React admin UI + Eleventy static site, all packaged in one Docker image. See [README.md](../README.md) for full feature list and [CONTRIBUTING.md](../CONTRIBUTING.md) for commit and release workflow.

## Module boundaries

| Module    | Root       | Language                                | Dev command                   |
| --------- | ---------- | --------------------------------------- | ----------------------------- |
| `backend` | `backend/` | Go 1.25, Echo v4, SQLite                | `go run ./cmd/server/main.go` |
| `admin`   | `admin/`   | React 19, TypeScript, Vite, Tailwind v4 | `npm run dev`                 |
| `site`    | `site/`    | Eleventy 3, Nunjucks, Tailwind v4       | `npm run dev`                 |

Run all three together: `make dev` (backend :8080, site :8081, admin :5173).

## Backend conventions (`backend/`)

- **No ORM** — raw SQL + manual scanning in `internal/models/repository.go`
- **Handler pattern**: `respondError(c, code, msg)` / `msgResponse(c, code, msg)` for all responses
- **Pagination**: use `paginationParams(c)` helper — returns (limit, offset, page)
- **Migrations**: add numbered SQL files in `internal/db/migrations/` (e.g. `004_my_feature.sql`)
- **Optimistic concurrency**: articles and settings use `updated_at` stamps. Always pass `knownUpdatedAt` to update methods; handle `ErrStaleWrite` in handlers (return 409). See `repository_concurrency_test.go`.
- **Site rebuild**: call `triggerSiteRebuild()` after any content save — it runs `bash site/build.sh` in a goroutine. Never block the HTTP response on it.
- **Storage**: all uploads are UUID-named files in `$UPLOAD_DIR` (default `./backend/uploads/`). No subdirectories.

## Admin conventions (`admin/`)

- **TanStack Query key prefix**: `["admin", ...]` for authenticated endpoints; no prefix for public (e.g. `["languages"]`)
- **API client**: use `adminApi.*` from `src/api/client.ts` — it handles auth headers and 401 redirect automatically
- **Block editor**: block types and their default configs are in `src/components/admin/blockShared.tsx` (`BLOCK_LABELS`, `applyTextDefaults`, etc.). Add new block types there first, then add an inspector in `src/components/admin/wysiwyg/`
- **Tailwind + theme tokens**: use CSS custom properties: `className="text-(--color-accent)"`. Never hardcode colors.
- **Auth**: JWT stored in `localStorage` as `blog_admin_token`. Auth state lives in `AuthContext`.

## Site conventions (`site/`)

- **Data files** (`src/_data/`): each file fetches from `http://localhost:8080` (or `$BACKEND_URL`) at build time. Add new data by creating a new `_data/*.js` file.
- **Theme injection**: a custom Eleventy transform injects `<style id="folio-theme">` into every page from `/api/v1/config/theme`. CSS uses `var(--color-*)`, `var(--font-*)`, `var(--radius-*)`. Never hardcode values.
- **Rebuild is atomic**: `site/build.sh` builds into a temp dir, then swaps it with the live `$SITE_DIST`. Don't modify this script without preserving the swap logic.

## Settings & theme

- `theme.json` at repo root is the **initial seed only** — once saved from admin, the DB value takes precedence.
- Settings are a key-value store in `site_settings` table. Keys: `site`, `theme`, `home`, `header`, `footer`, `nav_links`, `footer_links`, `social_links`.
- `SetSettingIfFresh` uses `MAX(updated_at)` to guard concurrent writes — always use it for settings updates.

## Commit messages

All commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/). See [CONTRIBUTING.md](../CONTRIBUTING.md) for full details.

```
<type>(<scope>): <short description>
```

Valid scopes: `backend`, `admin`, `site` (omit for cross-cutting changes).  
Valid types: `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `ci`, `test`, `style`, `build`.

```
feat(admin): add collapsible layers panel
fix(backend): prevent duplicate newsletter subscriptions
perf(site): lazy-load article cover images
chore: bump Go to 1.25
```

Never write messages like "Enhance X with Y", "Add Z component", or "Feat: ...". Always lowercase type.
