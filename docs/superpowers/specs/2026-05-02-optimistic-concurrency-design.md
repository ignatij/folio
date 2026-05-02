# Spec: Optimistic Concurrency Control

**Date:** 2026-05-02  
**Status:** Approved  
**Scope:** Articles, Pages, Settings/Builders

---

## Problem

The admin panel has no protection against concurrent edits. If two admins open the same article (or page, or settings builder), the last one to save silently overwrites the other's work. There is no warning, no error, and no record of the lost changes.

All affected resources already have an `updated_at` column in the database, which is the foundation for detecting stale writes.

## Goal

When Admin A saves a resource that was already modified by Admin B since A opened it, A receives a clear error. A's save is rejected. A must reload to see the current state before continuing.

Collaborative editing is explicitly out of scope. "Force save" / override is explicitly out of scope.

---

## Approach: Optimistic Concurrency via `updated_at`

Stateless. No new tables. No background jobs. The `updated_at` timestamp the client loaded is sent back on save; the server rejects the write if the DB row is newer.

---

## Backend Design

### Sentinel Error

A package-level sentinel `ErrStaleWrite` is defined in `internal/models/models.go`:

```go
var ErrStaleWrite = errors.New("stale write: record was modified by another request")
```

### Articles — `UpdateArticle`

The repository method signature gains a `knownUpdatedAt string` parameter:

```go
func (r *Repository) UpdateArticle(ctx context.Context, a Article, knownUpdatedAt string) error
```

The `UPDATE` statement adds a guard clause:

```sql
UPDATE articles
SET is_featured=?, cover_image_path=?, published_at=?, updated_at=CURRENT_TIMESTAMP
WHERE id=? AND updated_at=?
```

`Result.RowsAffected()` is checked. Zero rows → return `ErrStaleWrite`. The translation upserts run only after the guard passes.

### Pages — `UpdatePage`

Same pattern:

```go
func (r *Repository) UpdatePage(ctx context.Context, p Page, knownUpdatedAt string) error
```

```sql
UPDATE pages
SET is_published=?, updated_at=CURRENT_TIMESTAMP
WHERE id=? AND updated_at=?
```

Zero rows → return `ErrStaleWrite`.

### Settings — `GetSettingsMaxUpdatedAt` and `SetSettingIfFresh`

Settings use a single global version stamp: `MAX(updated_at)` across all rows in `site_settings`.

Two new repository methods:

```go
// GetSettingsMaxUpdatedAt returns MAX(updated_at) from site_settings as a string,
// or "" if no rows exist.
func (r *Repository) GetSettingsMaxUpdatedAt(ctx context.Context) (string, error)

// SetSettingIfFresh writes the value only when MAX(updated_at) in site_settings
// equals knownUpdatedAt (or knownUpdatedAt is empty, meaning first-ever write).
// Returns ErrStaleWrite if the check fails.
func (r *Repository) SetSettingIfFresh(ctx context.Context, key, value, knownUpdatedAt string) error
```

`SetSettingIfFresh` performs a read-then-write within a transaction:
1. `SELECT MAX(updated_at) FROM site_settings` inside a transaction.
2. If `knownUpdatedAt != ""` and DB max ≠ `knownUpdatedAt` → rollback, return `ErrStaleWrite`.
3. Otherwise execute the existing upsert.

`GetAllSettings` is extended to also return the max timestamp so the frontend receives it alongside the settings values.

### Handlers — `UpdateArticle` / `UpdatePage`

`admin.go` and `pages.go` extract `updated_at` from the bound request body (it is already present in `Article` and `Page` structs). They pass it through to the repository. On `ErrStaleWrite` they return:

```json
HTTP 409 Conflict
{"error": "This record was modified by someone else since you opened it. Reload to get the latest version."}
```

### Handler — `PutSettings`

`settings.go` reads an optional top-level `settings_updated_at` string from the request body. It passes this to each `SetSettingIfFresh` call. On `ErrStaleWrite` it returns the same `409` message.

The `GetSettings` response gains a top-level `settings_updated_at` field populated from `GetSettingsMaxUpdatedAt`.

---

## Frontend Design

### Types (`api/types.ts`)

`AllSettings` gains one optional field:

```typescript
settings_updated_at?: string;
```

No changes to `Article` or `Page` — both already carry `updated_at`.

### API Client (`api/client.ts`)

No signature changes. `updateArticle` and `updatePage` already pass `Partial<Article>` / `Partial<Page>`, which includes `updated_at`. `saveSettings` already passes `Partial<AllSettings>`, which will now include `settings_updated_at`.

### Article Edit Page (`ArticleEditPage.tsx`)

The `ArticleForm` component already holds the `existing` article, which includes `updated_at`. The mutation payload includes all `Article` fields, so `updated_at` is already sent. No code change needed beyond verifying the payload construction includes it.

On `409`, the existing `savingError` state renders the error message inline — no new UI component required.

### Page Edit Page (`PageEditPage.tsx`)

Same as articles. The `existing` page carries `updated_at`; it is included in the PUT payload. `409` surfaces through the existing error display.

### Settings / Builder Pages (`SettingsPage.tsx`, `HomeBuilderPage.tsx`, `HeaderBuilderPage.tsx`, `FooterBuilderPage.tsx`)

Each page already queries `adminApi.getSettings()` on mount. After the type change:

- The loaded `settings` object includes `settings_updated_at`.
- On save, each page passes `{ ...changedKeys, settings_updated_at: settings?.settings_updated_at }` to `adminApi.saveSettings(...)`.
- On `409`, the existing `serverError` / `saved` state shows the message.

---

## Data Flow Summary

```
1. Admin A opens article #5
   GET /admin/articles/5 → { id:5, updated_at:"2026-05-02T10:00:00Z", ... }

2. Admin B opens article #5, edits, saves
   PUT /admin/articles/5 { updated_at:"2026-05-02T10:00:00Z", ... }
   → Server: WHERE id=5 AND updated_at="2026-05-02T10:00:00Z" → 1 row → OK
   DB updated_at is now "2026-05-02T10:01:00Z"

3. Admin A tries to save
   PUT /admin/articles/5 { updated_at:"2026-05-02T10:00:00Z", ... }
   → Server: WHERE id=5 AND updated_at="2026-05-02T10:00:00Z" → 0 rows → ErrStaleWrite
   → 409 Conflict: "This record was modified by someone else since you opened it. Reload to get the latest version."

4. Admin A sees the error inline and reloads the page.
```

---

## What Is Not Changing

- No new database tables or columns.
- No locking mechanism; admins can still open the same page simultaneously.
- No merge or diff UI.
- No "force save" option.
- Delete operations are not guarded (deleting a record that no longer exists already returns 404).
- Read-only pages (Contacts, Newsletter, Media) are unaffected.

---

## Error Message

Consistent across all resource types:

> "This record was modified by someone else since you opened it. Reload to get the latest version."

Displayed inline in the existing error banner on each edit page.

---

## Testing

- Unit: `UpdateArticle` with a stale `updated_at` → `ErrStaleWrite`.
- Unit: `UpdateArticle` with the correct `updated_at` → success and DB `updated_at` advances.
- Unit: `SetSettingIfFresh` with a stale stamp → `ErrStaleWrite`.
- Integration: two sequential PUT requests for the same article; second returns `409`.
- Manual: open article in two tabs, save from both, verify second gets the 409 message.
