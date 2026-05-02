package models_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

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

	a := models.Article{
		Translations: []models.ArticleTranslation{
			{LangCode: "en", Slug: "test-stale", Title: "Test", Excerpt: "x", Body: "y"},
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

	// Sleep so CURRENT_TIMESTAMP advances before the first update.
	time.Sleep(1100 * time.Millisecond)

	// First update — should succeed
	loaded.Translations[0].Title = "Updated by A"
	if err := repo.UpdateArticle(ctx, *loaded, stamp); err != nil {
		t.Fatalf("first update: %v", err)
	}

	// Second update with old stamp — should fail
	loaded.Translations[0].Title = "Updated by B"
	err = repo.UpdateArticle(ctx, *loaded, stamp)
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

	// Sleep so CURRENT_TIMESTAMP advances before the first update.
	time.Sleep(1100 * time.Millisecond)

	// First update — should succeed
	if err := repo.UpdatePage(ctx, *loaded, stamp); err != nil {
		t.Fatalf("first update: %v", err)
	}

	// Stale update — should fail
	err = repo.UpdatePage(ctx, *loaded, stamp)
	if !errors.Is(err, models.ErrStaleWrite) {
		t.Errorf("want ErrStaleWrite, got %v", err)
	}
}

// ── Settings concurrency ──────────────────────────────────────────────────────

func TestSetSettingIfFresh_StaleWrite(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	if err := repo.SetSetting(ctx, "site", `{"name":"test"}`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	stamp, err := repo.GetSettingsMaxUpdatedAt(ctx)
	if err != nil {
		t.Fatalf("get stamp: %v", err)
	}

	// Sleep so CURRENT_TIMESTAMP advances before the first write.
	time.Sleep(1100 * time.Millisecond)

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
