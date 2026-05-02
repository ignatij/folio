# Optimistic Concurrency Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent silent last-write-wins data loss in the admin panel by rejecting saves where the record was modified since the client loaded it.

**Architecture:** The client already receives `updated_at` with every fetched resource. On PUT, the server guards the UPDATE with `AND updated_at = ?` and checks rows affected; zero rows means a concurrent save happened and the server returns HTTP 409. Settings use a single global `MAX(updated_at)` stamp across the `site_settings` table, sent in the GET response and checked on PUT.

**Tech Stack:** Go 1.25 / Echo v4 / SQLite (modernc), React 19 / TanStack Query v5 / TypeScript

---

## File Map

**Modified (backend):**
- `backend/internal/models/models.go` — add `ErrStaleWrite` sentinel
- `backend/internal/models/repository.go` — guard `UpdateArticle`, guard `UpdatePage`, add `GetSettingsMaxUpdatedAt`, add `SetSettingIfFresh`, extend `GetAllSettings`
- `backend/internal/api/handlers/admin.go` — pass `updated_at` to `UpdateArticle`, handle `ErrStaleWrite` → 409
- `backend/internal/api/handlers/pages.go` — pass `updated_at` to `UpdatePage`, handle `ErrStaleWrite` → 409
- `backend/internal/api/handlers/settings.go` — read `settings_updated_at` from request, use `SetSettingIfFresh`, include stamp in `GetSettings` response

**Modified (frontend):**
- `admin/src/api/types.ts` — add `settings_updated_at?: string` to `AllSettings`
- `admin/src/pages/admin/HomeBuilderPage.tsx` — pass `settings_updated_at` on save
- `admin/src/pages/admin/HeaderBuilderPage.tsx` — pass `settings_updated_at` on save
- `admin/src/pages/admin/FooterBuilderPage.tsx` — pass `settings_updated_at` on save
- `admin/src/pages/admin/SettingsPage.tsx` — pass `settings_updated_at` on save

**Created (tests):**
- `backend/internal/models/repository_concurrency_test.go` — unit tests for the repository guard logic

---

## Task 1: Add `ErrStaleWrite` sentinel to models

**Files:**
- Modify: `backend/internal/models/models.go`

- [ ] **Step 1: Add the sentinel error**

Open `backend/internal/models/models.go`. Add at the top of the file, after the `import` block:

```go
import (
	"encoding/json"
	"errors"
	"time"
)

// ErrStaleWrite is returned when an update is rejected because the record was
// modified by another request since the client loaded it.
var ErrStaleWrite = errors.New("stale write: record was modified by another request")
```

The existing `import` block only has `"encoding/json"` and `"time"` — add `"errors"` to it and add the var declaration after the closing paren of the import block.

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./...
```

Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/models/models.go
git commit -m "feat: add ErrStaleWrite sentinel error to models"
```

---

## Task 2: Write failing tests for repository concurrency guards

**Files:**
- Create: `backend/internal/models/repository_concurrency_test.go`

- [ ] **Step 1: Create the test file**

```go
package models_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"folio/internal/db"
	"folio/internal/models"
)

// openTestDB opens an in-memory SQLite database with all migrations applied.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}

// ── Article concurrency ───────────────────────────────────────────────────────

func TestUpdateArticle_StaleWrite(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	// Create an article
	a := models.Article{
		Translations: []models.ArticleTranslation{
			{LangCode: "en", Slug: "test-stale", Title: "Test", Excerpt: "x", Body: "y"},
		},
	}
	id, err := repo.CreateArticle(ctx, a)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// Load it to get real updated_at
	loaded, err := repo.GetArticleByID(ctx, id)
	if err != nil || loaded == nil {
		t.Fatalf("load: %v", err)
	}
	realUpdatedAt := loaded.UpdatedAt.UTC().Format("2006-01-02 15:04:05")

	// First update — should succeed
	loaded.Translations[0].Title = "Updated by A"
	if err := repo.UpdateArticle(ctx, *loaded, realUpdatedAt); err != nil {
		t.Fatalf("first update: %v", err)
	}

	// Second update with the old timestamp — should return ErrStaleWrite
	loaded.Translations[0].Title = "Updated by B"
	err = repo.UpdateArticle(ctx, *loaded, realUpdatedAt)
	if !errors.Is(err, models.ErrStaleWrite) {
		t.Errorf("want ErrStaleWrite, got %v", err)
	}
}

func TestUpdateArticle_FreshWrite(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	a := models.Article{
		Translations: []models.ArticleTranslation{
			{LangCode: "en", Slug: "test-fresh", Title: "Fresh", Excerpt: "x", Body: "y"},
		},
	}
	id, err := repo.CreateArticle(ctx, a)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	loaded, err := repo.GetArticleByID(ctx, id)
	if err != nil || loaded == nil {
		t.Fatalf("load: %v", err)
	}
	stamp := loaded.UpdatedAt.UTC().Format("2006-01-02 15:04:05")

	loaded.Translations[0].Title = "New title"
	if err := repo.UpdateArticle(ctx, *loaded, stamp); err != nil {
		t.Errorf("fresh update should succeed, got %v", err)
	}
}

// ── Page concurrency ──────────────────────────────────────────────────────────

func TestUpdatePage_StaleWrite(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	p := models.Page{
		IsPublished: false,
		Translations: []models.PageTranslation{
			{LangCode: "en", Slug: "test-page-stale", Title: "Page"},
		},
	}
	id, err := repo.CreatePage(ctx, p)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	loaded, err := repo.GetPageByID(ctx, id)
	if err != nil || loaded == nil {
		t.Fatalf("load: %v", err)
	}
	stamp := loaded.UpdatedAt.UTC().Format("2006-01-02 15:04:05")

	// First update
	if err := repo.UpdatePage(ctx, *loaded, stamp); err != nil {
		t.Fatalf("first update: %v", err)
	}

	// Stale update
	err = repo.UpdatePage(ctx, *loaded, stamp)
	if !errors.Is(err, models.ErrStaleWrite) {
		t.Errorf("want ErrStaleWrite, got %v", err)
	}
}

// ── Settings concurrency ──────────────────────────────────────────────────────

func TestSetSettingIfFresh_StaleWrite(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	// Seed a setting
	if err := repo.SetSetting(ctx, "site", `{"name":"test"}`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	stamp, err := repo.GetSettingsMaxUpdatedAt(ctx)
	if err != nil {
		t.Fatalf("get stamp: %v", err)
	}

	// First write — OK
	if err := repo.SetSettingIfFresh(ctx, "site", `{"name":"updated"}`, stamp); err != nil {
		t.Fatalf("fresh write: %v", err)
	}

	// Stale write — should fail
	err = repo.SetSettingIfFresh(ctx, "site", `{"name":"stale"}`, stamp)
	if !errors.Is(err, models.ErrStaleWrite) {
		t.Errorf("want ErrStaleWrite, got %v", err)
	}
}

func TestSetSettingIfFresh_EmptyStamp(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	// Empty stamp always succeeds (first-ever write)
	if err := repo.SetSettingIfFresh(ctx, "site", `{"name":"first"}`, ""); err != nil {
		t.Errorf("empty stamp should always succeed, got %v", err)
	}
}
```

- [ ] **Step 2: Run the tests — expect compile error or FAIL (not yet implemented)**

```bash
cd backend && go test ./internal/models/... -run "TestUpdateArticle|TestUpdatePage|TestSetSetting" -v 2>&1 | head -30
```

Expected: compilation error because `UpdateArticle` and `UpdatePage` don't yet accept a third argument, and `SetSettingIfFresh`/`GetSettingsMaxUpdatedAt` don't exist.

- [ ] **Step 3: Commit the failing tests**

```bash
git add backend/internal/models/repository_concurrency_test.go
git commit -m "test: add failing concurrency guard tests for repository"
```

---

## Task 3: Guard `UpdateArticle` in the repository

**Files:**
- Modify: `backend/internal/models/repository.go`

- [ ] **Step 1: Update `UpdateArticle` signature and add the guard**

Find `func (r *Repository) UpdateArticle(ctx context.Context, a Article) error` (around line 337) and replace the entire function:

```go
func (r *Repository) UpdateArticle(ctx context.Context, a Article, knownUpdatedAt string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE articles
		SET is_featured=?, cover_image_path=?, published_at=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=? AND updated_at=?`,
		boolToInt(a.IsFeatured), a.CoverImagePath, timePtrToStr(a.PublishedAt), a.ID, knownUpdatedAt,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrStaleWrite
	}

	for _, t := range a.Translations {
		if _, err := r.db.ExecContext(ctx, `
			INSERT INTO article_translations
				(article_id, lang_code, slug, title, excerpt, body, tag, meta_title, meta_description)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(article_id, lang_code) DO UPDATE SET
				slug=excluded.slug, title=excluded.title, excerpt=excluded.excerpt,
				body=excluded.body, tag=excluded.tag,
				meta_title=excluded.meta_title, meta_description=excluded.meta_description`,
			a.ID, t.LangCode, t.Slug, t.Title, t.Excerpt, t.Body, t.Tag, t.MetaTitle, t.MetaDescription,
		); err != nil {
			return fmt.Errorf("upsert translation %s: %w", t.LangCode, err)
		}
	}
	return nil
}
```

- [ ] **Step 2: Run the article tests**

```bash
cd backend && go test ./internal/models/... -run "TestUpdateArticle" -v
```

Expected:
```
--- PASS: TestUpdateArticle_StaleWrite
--- PASS: TestUpdateArticle_FreshWrite
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/models/repository.go
git commit -m "feat: guard UpdateArticle with updated_at concurrency check"
```

---

## Task 4: Guard `UpdatePage` in the repository

**Files:**
- Modify: `backend/internal/models/repository.go`

- [ ] **Step 1: Update `UpdatePage` signature and add the guard**

Find `func (r *Repository) UpdatePage(ctx context.Context, p Page) error` (around line 805) and replace the entire function:

```go
func (r *Repository) UpdatePage(ctx context.Context, p Page, knownUpdatedAt string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE pages SET is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND updated_at=?`,
		boolToInt(p.IsPublished), p.ID, knownUpdatedAt,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrStaleWrite
	}

	for _, t := range p.Translations {
		if t.Slug == "" {
			continue
		}
		if _, err := r.db.ExecContext(ctx, `
			INSERT INTO page_translations (page_id, lang_code, slug, title, body, sections, meta_title, meta_description)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(page_id, lang_code) DO UPDATE SET
				slug=excluded.slug, title=excluded.title, body=excluded.body,
				sections=excluded.sections,
				meta_title=excluded.meta_title, meta_description=excluded.meta_description`,
			p.ID, t.LangCode, t.Slug, t.Title, t.Body, sectionsJSON(t.Sections), t.MetaTitle, t.MetaDescription,
		); err != nil {
			return fmt.Errorf("upsert page translation %s: %w", t.LangCode, err)
		}
	}
	return nil
}
```

- [ ] **Step 2: Run the page test**

```bash
cd backend && go test ./internal/models/... -run "TestUpdatePage" -v
```

Expected:
```
--- PASS: TestUpdatePage_StaleWrite
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/models/repository.go
git commit -m "feat: guard UpdatePage with updated_at concurrency check"
```

---

## Task 5: Add settings concurrency methods to the repository

**Files:**
- Modify: `backend/internal/models/repository.go`

- [ ] **Step 1: Add `GetSettingsMaxUpdatedAt`**

After the existing `SetSetting` function (around line 570), add:

```go
// GetSettingsMaxUpdatedAt returns the MAX(updated_at) across all site_settings rows,
// as a datetime string in the format "2006-01-02 15:04:05". Returns "" if the table is empty.
func (r *Repository) GetSettingsMaxUpdatedAt(ctx context.Context) (string, error) {
	var ns sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT MAX(updated_at) FROM site_settings`).Scan(&ns)
	if err != nil {
		return "", err
	}
	return ns.String, nil
}
```

- [ ] **Step 2: Add `SetSettingIfFresh`**

Immediately after `GetSettingsMaxUpdatedAt`, add:

```go
// SetSettingIfFresh upserts a settings key only if MAX(updated_at) in site_settings
// matches knownUpdatedAt, or if knownUpdatedAt is "" (first-ever write).
// Returns ErrStaleWrite when the check fails.
func (r *Repository) SetSettingIfFresh(ctx context.Context, key, value, knownUpdatedAt string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if knownUpdatedAt != "" {
		var ns sql.NullString
		if err := tx.QueryRowContext(ctx, `SELECT MAX(updated_at) FROM site_settings`).Scan(&ns); err != nil {
			return err
		}
		if ns.String != knownUpdatedAt {
			return ErrStaleWrite
		}
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO site_settings (key, value, updated_at)
		 VALUES (?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
		key, value,
	); err != nil {
		return err
	}

	return tx.Commit()
}
```

- [ ] **Step 3: Run the settings tests**

```bash
cd backend && go test ./internal/models/... -run "TestSetSetting" -v
```

Expected:
```
--- PASS: TestSetSettingIfFresh_StaleWrite
--- PASS: TestSetSettingIfFresh_EmptyStamp
```

- [ ] **Step 4: Run all concurrency tests**

```bash
cd backend && go test ./internal/models/... -v 2>&1 | grep -E "PASS|FAIL|---"
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/models/repository.go
git commit -m "feat: add GetSettingsMaxUpdatedAt and SetSettingIfFresh to repository"
```

---

## Task 6: Update `admin.go` handler to pass `updated_at` and handle 409

**Files:**
- Modify: `backend/internal/api/handlers/admin.go`

- [ ] **Step 1: Add `errors` import**

Find the import block in `backend/internal/api/handlers/admin.go`. Add `"errors"` to it:

```go
import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"folio/internal/config"
	"folio/internal/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)
```

- [ ] **Step 2: Update `UpdateArticle` handler**

Find the `UpdateArticle` handler function in `admin.go`. The call to `h.repo.UpdateArticle` currently reads:

```go
	if err := h.repo.UpdateArticle(c.Request().Context(), a); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to update article")
	}
```

Replace those two lines with:

```go
	if err := h.repo.UpdateArticle(c.Request().Context(), a, a.UpdatedAt.UTC().Format("2006-01-02 15:04:05")); err != nil {
		if errors.Is(err, models.ErrStaleWrite) {
			return respondError(c, http.StatusConflict, "This record was modified by someone else since you opened it. Reload to get the latest version.")
		}
		return respondError(c, http.StatusInternalServerError, "failed to update article")
	}
```

- [ ] **Step 3: Verify the build**

```bash
cd backend && go build ./...
```

Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/handlers/admin.go
git commit -m "feat: return 409 on stale article update"
```

---

## Task 7: Update `pages.go` handler to pass `updated_at` and handle 409

**Files:**
- Modify: `backend/internal/api/handlers/pages.go`

- [ ] **Step 1: Add `errors` import**

Find the import block in `backend/internal/api/handlers/pages.go`. Add `"errors"` to it:

```go
import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"folio/internal/config"
	"folio/internal/models"

	"github.com/labstack/echo/v4"
)
```

- [ ] **Step 2: Update `UpdatePage` handler**

In `pages.go`, find the call to `h.repo.UpdatePage`:

```go
	if err := h.repo.UpdatePage(c.Request().Context(), p); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to update page")
	}
```

Replace those two lines with:

```go
	if err := h.repo.UpdatePage(c.Request().Context(), p, existing.UpdatedAt.UTC().Format("2006-01-02 15:04:05")); err != nil {
		if errors.Is(err, models.ErrStaleWrite) {
			return respondError(c, http.StatusConflict, "This record was modified by someone else since you opened it. Reload to get the latest version.")
		}
		return respondError(c, http.StatusInternalServerError, "failed to update page")
	}
```

Note: `existing` is already loaded just before the bind — its `UpdatedAt` is the correct stamp.

- [ ] **Step 3: Verify the build**

```bash
cd backend && go build ./...
```

Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/handlers/pages.go
git commit -m "feat: return 409 on stale page update"
```

---

## Task 8: Update `settings.go` handler — GET returns stamp, PUT checks it

**Files:**
- Modify: `backend/internal/api/handlers/settings.go`

- [ ] **Step 1: Add `errors` import**

Find the import block in `backend/internal/api/handlers/settings.go`. Add `"errors"` to it:

```go
import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"folio/internal/models"
	"folio/internal/services"

	"github.com/labstack/echo/v4"
)
```

- [ ] **Step 2: Update `GetSettings` to include `settings_updated_at`**

Find `GetSettings`. It currently builds `result` and returns it. Add the stamp fetch before the final `return`:

```go
	// Add global settings version stamp for optimistic concurrency.
	stamp, err := h.repo.GetSettingsMaxUpdatedAt(c.Request().Context())
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load settings version")
	}
	if stamp != "" {
		stampJSON, _ := json.Marshal(stamp)
		result["settings_updated_at"] = json.RawMessage(stampJSON)
	}

	return c.JSON(http.StatusOK, result)
```

This replaces the existing bare `return c.JSON(http.StatusOK, result)` at the end of `GetSettings`.

- [ ] **Step 3: Update `PutSettings` to use `SetSettingIfFresh`**

Find `PutSettings`. It currently decodes into `raw map[string]json.RawMessage` and calls `h.repo.SetSetting` for each key. Replace the loop body:

```go
	// Extract optional concurrency stamp — not a stored setting key.
	var knownUpdatedAt string
	if v, ok := raw["settings_updated_at"]; ok {
		_ = json.Unmarshal(v, &knownUpdatedAt)
		delete(raw, "settings_updated_at")
	}

	allowed := make(map[string]struct{}, len(settingsKeys))
	for _, k := range settingsKeys {
		allowed[k] = struct{}{}
	}

	ctx := c.Request().Context()
	for k, v := range raw {
		if _, ok := allowed[k]; !ok {
			continue
		}
		if err := h.repo.SetSettingIfFresh(ctx, k, string(v), knownUpdatedAt); err != nil {
			if errors.Is(err, models.ErrStaleWrite) {
				return respondError(c, http.StatusConflict, "This record was modified by someone else since you opened it. Reload to get the latest version.")
			}
			return respondError(c, http.StatusInternalServerError, "failed to save setting: "+k)
		}
		// After first successful write, the stamp is consumed — subsequent keys in
		// this same request are written unconditionally (they're part of the same save).
		knownUpdatedAt = ""
	}

	return msgResponse(c, http.StatusOK, "settings saved")
```

The full `PutSettings` function body after the bind should now be exactly the block above (replacing the existing `allowed` map + loop).

- [ ] **Step 4: Verify the build**

```bash
cd backend && go build ./...
```

Expected: no output, exit 0.

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && go test ./... -v 2>&1 | grep -E "PASS|FAIL|---"
```

Expected: all PASS, none FAIL.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/api/handlers/settings.go
git commit -m "feat: add settings_updated_at stamp to GET and enforce it on PUT"
```

---

## Task 9: Frontend — add `settings_updated_at` to `AllSettings` type

**Files:**
- Modify: `admin/src/api/types.ts`

- [ ] **Step 1: Find the `AllSettings` interface**

In `admin/src/api/types.ts`, find the `AllSettings` interface. It looks like:

```typescript
export interface AllSettings {
  site?: { ... };
  theme?: ThemeSettings;
  nav_links?: NavLink[];
  ...
}
```

Add `settings_updated_at?: string;` as the last field:

```typescript
  /** Global version stamp for optimistic concurrency. Returned by GET, sent back on PUT. */
  settings_updated_at?: string;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/api/types.ts
git commit -m "feat: add settings_updated_at field to AllSettings type"
```

---

## Task 10: Frontend — `HomeBuilderPage` passes `settings_updated_at` on save

**Files:**
- Modify: `admin/src/pages/admin/HomeBuilderPage.tsx`

- [ ] **Step 1: Pass the stamp in the mutation**

In `HomeBuilderPage.tsx`, the `saveMutation` currently reads:

```typescript
  const saveMutation = useMutation({
    mutationFn: (home_sections: HomeBlock[]) =>
      adminApi.saveSettings({ home_sections } as any),
```

Replace the `mutationFn` line:

```typescript
  const saveMutation = useMutation({
    mutationFn: (home_sections: HomeBlock[]) =>
      adminApi.saveSettings({ home_sections, settings_updated_at: settings?.settings_updated_at } as any),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/admin/HomeBuilderPage.tsx
git commit -m "feat: pass settings_updated_at on HomeBuilder save"
```

---

## Task 11: Frontend — `HeaderBuilderPage` passes `settings_updated_at` on save

**Files:**
- Modify: `admin/src/pages/admin/HeaderBuilderPage.tsx`

- [ ] **Step 1: Pass the stamp in the mutation**

In `HeaderBuilderPage.tsx`, the `saveMutation` reads:

```typescript
  const saveMutation = useMutation({
    mutationFn: (header_sections: HomeBlock[]) =>
      adminApi.saveSettings({ header_sections } as any),
```

Replace the `mutationFn` line:

```typescript
  const saveMutation = useMutation({
    mutationFn: (header_sections: HomeBlock[]) =>
      adminApi.saveSettings({ header_sections, settings_updated_at: settings?.settings_updated_at } as any),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/admin/HeaderBuilderPage.tsx
git commit -m "feat: pass settings_updated_at on HeaderBuilder save"
```

---

## Task 12: Frontend — `FooterBuilderPage` passes `settings_updated_at` on save

**Files:**
- Modify: `admin/src/pages/admin/FooterBuilderPage.tsx`

- [ ] **Step 1: Pass the stamp in the mutation**

In `FooterBuilderPage.tsx`, the `saveMutation` reads:

```typescript
  const saveMutation = useMutation({
    mutationFn: (footer_sections: HomeBlock[]) =>
      adminApi.saveSettings({ footer_sections } as any),
```

Replace the `mutationFn` line:

```typescript
  const saveMutation = useMutation({
    mutationFn: (footer_sections: HomeBlock[]) =>
      adminApi.saveSettings({ footer_sections, settings_updated_at: settings?.settings_updated_at } as any),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/admin/FooterBuilderPage.tsx
git commit -m "feat: pass settings_updated_at on FooterBuilder save"
```

---

## Task 13: Frontend — `SettingsPage` passes `settings_updated_at` on save

**Files:**
- Modify: `admin/src/pages/admin/SettingsPage.tsx`

- [ ] **Step 1: Pass the stamp in `handleSave`**

In `SettingsPage.tsx`, find the `handleSave` function. It calls `saveMutation.mutate({...})`. Add `settings_updated_at` to the object:

```typescript
  function handleSave() {
    setServerError(null);
    saveMutation.mutate({
      site: site ?? undefined,
      theme: theme ?? undefined,
      nav_links: navLinks,
      footer_links: footerLinks,
      social_links: socialLinks,
      languages: langs,
      ui_strings: uiStrings,
      settings_updated_at: settings?.settings_updated_at,
    } as Partial<AllSettings>);
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/admin/SettingsPage.tsx
git commit -m "feat: pass settings_updated_at on SettingsPage save"
```

---

## Task 14: Verify article `updated_at` is included in PUT payload

**Files:**
- Read: `admin/src/pages/admin/ArticleEditPage.tsx`

The `ArticleForm` builds its PUT payload in `handleSave`. Verify that `existing.updated_at` is included. The payload is built as:

```typescript
    const payload: Partial<Article> = {
      is_featured: isFeatured,
      cover_image_path: coverImagePath,
      published_at: publishedAt,
      translations: Object.values(translations),
    };
```

`updated_at` is **not** in this object — the server ignores client-supplied `updated_at` on create, but for updates we need it. 

- [ ] **Step 1: Add `updated_at` to the PUT payload**

Find the payload construction in `ArticleEditPage.tsx` and add `updated_at`:

```typescript
    const payload: Partial<Article> = {
      is_featured: isFeatured,
      cover_image_path: coverImagePath,
      published_at: publishedAt,
      updated_at: existing?.updated_at ?? "",
      translations: Object.values(translations),
    };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/admin/ArticleEditPage.tsx
git commit -m "feat: include updated_at in article PUT payload for concurrency guard"
```

---

## Task 15: Verify page `updated_at` is included in PUT payload

**Files:**
- Read: `admin/src/pages/admin/PageEditPage.tsx`

- [ ] **Step 1: Inspect the page PUT payload**

In `PageEditPage.tsx`, find the `PageForm` component's save call — look for `adminApi.updatePage(...)`. Check what payload it sends.

- [ ] **Step 2: Add `updated_at` to the payload if missing**

If `updated_at` is not already in the payload object, find the payload construction and add:

```typescript
      updated_at: existing?.updated_at ?? "",
```

alongside the other fields.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/admin/PageEditPage.tsx
git commit -m "feat: include updated_at in page PUT payload for concurrency guard"
```

---

## Task 16: Integration smoke test and final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && go test ./... -v 2>&1 | grep -E "PASS|FAIL|---"
```

Expected: all PASS.

- [ ] **Step 2: Build the backend**

```bash
cd backend && go build ./...
```

Expected: exit 0, no output.

- [ ] **Step 3: Build the frontend**

```bash
cd admin && npm run build 2>&1 | tail -10
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 4: Manual smoke test**

Start the server locally. Open the same article in two browser tabs.

1. In Tab 1, make an edit and save — expect success.
2. Without reloading Tab 2, make a different edit there and save — expect the error banner: *"This record was modified by someone else since you opened it. Reload to get the latest version."*
3. Reload Tab 2, edit, and save again — expect success.

Repeat with a Settings page (open in two tabs, save from both).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: optimistic concurrency control — complete implementation"
```
