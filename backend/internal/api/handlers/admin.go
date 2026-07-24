package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"folio/internal/config"
	"folio/internal/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

const (
	maxUploadSize      = 20 << 20 // 20 MB
	maxImageDimension  = 1920
	webpQuality        = 82
	uploadSniffLength  = 512
	optimizedImageMime = "image/webp"
)

// AdminHandler handles all admin CRUD operations.
type AdminHandler struct {
	repo      *models.Repository
	cfg       *config.Config
	uploadDir string
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(repo *models.Repository, cfg *config.Config, uploadDir string) *AdminHandler {
	return &AdminHandler{repo: repo, cfg: cfg, uploadDir: uploadDir}
}

// triggerSiteRebuild runs site/build.sh asynchronously and returns a channel
// that carries any error when the script finishes.
func triggerSiteRebuild() <-chan error {
	script := os.Getenv("SITE_BUILD_SCRIPT")
	if script == "" {
		script = filepath.Join("..", "site", "build.sh")
	}
	ch := make(chan error, 1)
	go func() {
		cmd := exec.Command("bash", script)
		cmd.Env = os.Environ()
		out, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("[site rebuild] ERROR: %v\n%s", err, out)
			ch <- fmt.Errorf("%w: %s", err, out)
		} else {
			log.Printf("[site rebuild] OK: %s", out)
			ch <- nil
		}
	}()
	return ch
}

func paginationParams(c echo.Context) (limit, offset, page int) {
	page, _ = strconv.Atoi(c.QueryParam("page"))
	limit, _ = strconv.Atoi(c.QueryParam("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset = (page - 1) * limit
	return
}

func optimizedDimensions(width, height int) (int, int) {
	if width <= 0 || height <= 0 {
		return width, height
	}
	if width <= maxImageDimension && height <= maxImageDimension {
		return width, height
	}
	if width >= height {
		return maxImageDimension, max(1, height*maxImageDimension/width)
	}
	return max(1, width*maxImageDimension/height), maxImageDimension
}

func optimizeImageUpload(src io.Reader, dstPath string) (int64, error) {
	data, err := io.ReadAll(io.LimitReader(src, maxUploadSize+1))
	if err != nil {
		return 0, fmt.Errorf("read upload: %w", err)
	}
	if int64(len(data)) > maxUploadSize {
		return 0, fmt.Errorf("file exceeds 20 MB limit")
	}

	sniff := data
	if len(sniff) > uploadSniffLength {
		sniff = sniff[:uploadSniffLength]
	}
	contentType := http.DetectContentType(sniff)
	if contentType != "image/jpeg" && contentType != "image/png" {
		return 0, fmt.Errorf("unsupported image type: use JPEG or PNG")
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, fmt.Errorf("invalid image")
	}
	width, height := optimizedDimensions(cfg.Width, cfg.Height)

	tmp, err := os.CreateTemp(filepath.Dir(dstPath), "upload-*")
	if err != nil {
		return 0, fmt.Errorf("create temp upload: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return 0, fmt.Errorf("write temp upload: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return 0, fmt.Errorf("close temp upload: %w", err)
	}

	args := []string{
		"-quiet",
		"-q", strconv.Itoa(webpQuality),
		"-metadata", "none",
	}
	if width != cfg.Width || height != cfg.Height {
		args = append(args, "-resize", strconv.Itoa(width), strconv.Itoa(height))
	}
	args = append(args, tmpPath, "-o", dstPath)

	out, err := exec.Command("cwebp", args...).CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("optimize image with cwebp: %w: %s", err, out)
	}

	info, err := os.Stat(dstPath)
	if err != nil {
		return 0, fmt.Errorf("stat optimized image: %w", err)
	}
	return info.Size(), nil
}

func saveOriginalUpload(src io.Reader, dstPath string) (int64, error) {
	dst, err := os.Create(dstPath)
	if err != nil {
		return 0, fmt.Errorf("create upload: %w", err)
	}
	defer dst.Close()

	written, err := io.Copy(dst, io.LimitReader(src, maxUploadSize+1))
	if err != nil {
		return 0, fmt.Errorf("write upload: %w", err)
	}
	if written > maxUploadSize {
		_ = os.Remove(dstPath)
		return 0, fmt.Errorf("file exceeds 20 MB limit")
	}
	return written, nil
}

// ── Articles ──────────────────────────────────────────────────────────────────

// ListArticles — GET /admin/articles
func (h *AdminHandler) ListArticles(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListAllArticles(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load articles")
	}
	if items == nil {
		items = []models.Article{}
	}
	return c.JSON(http.StatusOK, models.PaginatedArticles{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// GetArticleByID — GET /admin/articles/:id
func (h *AdminHandler) GetArticleByID(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid article id")
	}
	a, err := h.repo.GetArticleByID(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load article")
	}
	if a == nil {
		return respondError(c, http.StatusNotFound, "article not found")
	}
	return c.JSON(http.StatusOK, a)
}

// CreateArticle — POST /admin/articles
func (h *AdminHandler) CreateArticle(c echo.Context) error {
	var a models.Article
	if err := c.Bind(&a); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	if len(a.Translations) == 0 {
		return respondError(c, http.StatusUnprocessableEntity, "at least one translation is required")
	}

	// Validate each translation and check slug uniqueness.
	for _, t := range a.Translations {
		if t.Slug == "" || t.Title == "" {
			return respondError(c, http.StatusUnprocessableEntity,
				fmt.Sprintf("translation %q requires slug and title", t.LangCode))
		}
		conflict, err := h.repo.SlugConflictExists(c.Request().Context(), t.Slug, t.LangCode, 0)
		if err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to check slug uniqueness")
		}
		if conflict {
			return respondError(c, http.StatusConflict,
				fmt.Sprintf("slug %q already used in language %q", t.Slug, t.LangCode))
		}
	}

	id, err := h.repo.CreateArticle(c.Request().Context(), a)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to create article")
	}
	a.ID = id

	var rebuildWarning string
	if a.PublishedAt != nil {
		select {
		case rebuildErr := <-triggerSiteRebuild():
			if rebuildErr != nil {
				rebuildWarning = "Site regeneration failed — check server logs."
			}
		case <-time.After(30 * time.Second):
			// Still running; don't block the response.
		}
	}

	type resp struct {
		models.Article
		RebuildWarning string `json:"rebuild_warning,omitempty"`
	}
	return c.JSON(http.StatusCreated, resp{Article: a, RebuildWarning: rebuildWarning})
}

// UpdateArticle — PUT /admin/articles/:id
func (h *AdminHandler) UpdateArticle(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid article id")
	}

	existing, err := h.repo.GetArticleByID(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load article")
	}
	if existing == nil {
		return respondError(c, http.StatusNotFound, "article not found")
	}

	var a models.Article
	if err := c.Bind(&a); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	a.ID = id

	// Validate slug uniqueness for each provided translation.
	for _, t := range a.Translations {
		if t.Slug == "" || t.Title == "" {
			return respondError(c, http.StatusUnprocessableEntity,
				fmt.Sprintf("translation %q requires slug and title", t.LangCode))
		}
		conflict, err := h.repo.SlugConflictExists(c.Request().Context(), t.Slug, t.LangCode, id)
		if err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to check slug uniqueness")
		}
		if conflict {
			return respondError(c, http.StatusConflict,
				fmt.Sprintf("slug %q already used in language %q", t.Slug, t.LangCode))
		}
	}

	wasPublished := existing.PublishedAt != nil
	if err := h.repo.UpdateArticle(c.Request().Context(), a, a.UpdatedAt.UTC().Format("2006-01-02 15:04:05")); err != nil {
		if errors.Is(err, models.ErrStaleWrite) {
			return respondError(c, http.StatusConflict, "This record was modified by someone else since you opened it. Reload to get the latest version.")
		}
		return respondError(c, http.StatusInternalServerError, "failed to update article")
	}

	updated, _ := h.repo.GetArticleByID(c.Request().Context(), id)

	var rebuildWarning string
	publishChanged := (a.PublishedAt != nil) != wasPublished
	if publishChanged || (a.PublishedAt != nil) {
		select {
		case rebuildErr := <-triggerSiteRebuild():
			if rebuildErr != nil {
				rebuildWarning = "Site regeneration failed — check server logs."
			}
		case <-time.After(30 * time.Second):
		}
	}

	type resp struct {
		*models.Article
		RebuildWarning string `json:"rebuild_warning,omitempty"`
	}
	return c.JSON(http.StatusOK, resp{Article: updated, RebuildWarning: rebuildWarning})
}

// DeleteArticle — DELETE /admin/articles/:id
func (h *AdminHandler) DeleteArticle(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid article id")
	}
	if err := h.repo.DeleteArticle(c.Request().Context(), id); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to delete article")
	}
	return c.NoContent(http.StatusNoContent)
}

// GetTags returns the configured tag list.
// GET /admin/tags
func (h *AdminHandler) GetTags(c echo.Context) error {
	// Prefer tags stored in the "site" setting (set via Settings page).
	all, err := h.repo.GetAllSettings(c.Request().Context())
	if err == nil {
		if raw, ok := all["site"]; ok && raw != "" {
			var site struct {
				Tags []string `json:"tags"`
			}
			if json.Unmarshal([]byte(raw), &site) == nil && len(site.Tags) > 0 {
				return c.JSON(http.StatusOK, site.Tags)
			}
		}
	}
	// Fall back to config.yaml
	return c.JSON(http.StatusOK, h.cfg.Tags)
}

// TriggerRebuild manually triggers a site rebuild.
// POST /admin/rebuild
func (h *AdminHandler) TriggerRebuild(c echo.Context) error {
	select {
	case err := <-triggerSiteRebuild():
		if err != nil {
			return respondError(c, http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	case <-time.After(60 * time.Second):
		return c.JSON(http.StatusAccepted, map[string]string{"status": "building"})
	}
}

// ── Media ─────────────────────────────────────────────────────────────────────

// ListMedia — GET /admin/media
func (h *AdminHandler) ListMedia(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListMediaFiles(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to list media")
	}
	if items == nil {
		items = []models.MediaFile{}
	}
	return c.JSON(http.StatusOK, models.PaginatedMediaFiles{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// UploadMedia — POST /admin/media
func (h *AdminHandler) UploadMedia(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return respondError(c, http.StatusBadRequest, "file is required")
	}

	if file.Size > maxUploadSize {
		return respondError(c, http.StatusRequestEntityTooLarge, "file exceeds 20 MB limit")
	}

	src, err := file.Open()
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to open upload")
	}
	defer src.Close()

	ct := file.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}

	filename := fmt.Sprintf("%s%s", uuid.NewString(), filepath.Ext(file.Filename))
	mimeType := ct
	var size int64

	if strings.HasPrefix(ct, "image/") {
		filename = fmt.Sprintf("%s.webp", uuid.NewString())
		mimeType = optimizedImageMime
		dstPath := filepath.Join(h.uploadDir, filename)
		size, err = optimizeImageUpload(src, dstPath)
		if err != nil {
			if errors.Is(err, exec.ErrNotFound) {
				return respondError(c, http.StatusInternalServerError, "image optimizer is not installed")
			}
			if strings.HasPrefix(err.Error(), "file exceeds") {
				return respondError(c, http.StatusRequestEntityTooLarge, err.Error())
			}
			if strings.HasPrefix(err.Error(), "unsupported image type") || err.Error() == "invalid image" {
				return respondError(c, http.StatusUnsupportedMediaType, err.Error())
			}
			return respondError(c, http.StatusInternalServerError, "failed to optimize image")
		}
	} else {
		dstPath := filepath.Join(h.uploadDir, filename)
		size, err = saveOriginalUpload(src, dstPath)
		if err != nil {
			if strings.HasPrefix(err.Error(), "file exceeds") {
				return respondError(c, http.StatusRequestEntityTooLarge, err.Error())
			}
			return respondError(c, http.StatusInternalServerError, "failed to save file")
		}
	}

	mf := models.MediaFile{
		Filename:     filename,
		OriginalName: file.Filename,
		MimeType:     mimeType,
		SizeBytes:    size,
	}
	id, err := h.repo.CreateMediaFile(c.Request().Context(), mf)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to record media")
	}
	mf.ID = id
	return c.JSON(http.StatusCreated, mf)
}

// DeleteMedia — DELETE /admin/media/:id
func (h *AdminHandler) DeleteMedia(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid media id")
	}
	mf, err := h.repo.GetMediaFile(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to find media")
	}
	if mf == nil {
		return respondError(c, http.StatusNotFound, "not found")
	}
	_ = os.Remove(filepath.Join(h.uploadDir, filepath.Base(mf.Filename)))
	if err := h.repo.DeleteMediaFile(c.Request().Context(), id); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to delete media")
	}
	return c.NoContent(http.StatusNoContent)
}

// ── Contacts ──────────────────────────────────────────────────────────────────

// ListContacts — GET /admin/contacts
func (h *AdminHandler) ListContacts(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListContactSubmissions(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to list contacts")
	}
	if items == nil {
		items = []models.ContactSubmission{}
	}
	return c.JSON(http.StatusOK, models.PaginatedContacts{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// ── Newsletter ────────────────────────────────────────────────────────────────

// ListNewsletter — GET /admin/newsletter
func (h *AdminHandler) ListNewsletter(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListNewsletterSubscribers(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to list subscribers")
	}
	if items == nil {
		items = []models.NewsletterSubscriber{}
	}
	return c.JSON(http.StatusOK, models.PaginatedSubscribers{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}
