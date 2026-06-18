package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"folio/internal/api/handlers"
	"folio/internal/config"
	"folio/internal/db"
	jwtMiddleware "folio/internal/middleware"
	"folio/internal/models"
	"folio/internal/services"
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// seedSettings seeds DB settings from config.yaml + theme.json on first boot.
func seedSettings(repo *models.Repository, cfg *config.Config, themePath string) {
	ctx := context.Background()
	all, err := repo.GetAllSettings(ctx)
	if err != nil {
		log.Printf("seedSettings: failed to read settings: %v", err)
		return
	}

	// Seed "site" from config.yaml if not yet stored.
	if _, ok := all["site"]; !ok {
		type sitePayload struct {
			Name         string      `json:"name"`
			Tagline      string      `json:"tagline"`
			URL          string      `json:"url"`
			BookingURL   string      `json:"bookingUrl"`
			ContactEmail string      `json:"contactEmail"`
			Tags         []string    `json:"tags"`
			Social       interface{} `json:"social"`
		}
		sp := sitePayload{
			Name:         cfg.Site.Name,
			Tagline:      cfg.Site.Tagline,
			URL:          cfg.Site.URL,
			BookingURL:   cfg.Site.BookingURL,
			ContactEmail: cfg.ContactEmail,
			Tags:         cfg.Tags,
			Social:       cfg.Site.Social,
		}
		b, _ := json.Marshal(sp)
		if err := repo.SetSetting(ctx, "site", string(b)); err != nil {
			log.Printf("seedSettings: failed to seed site: %v", err)
		}
	}

	// Seed "theme" from theme.json if not yet stored.
	if _, ok := all["theme"]; !ok {
		data, err := os.ReadFile(themePath)
		if err == nil {
			if err := repo.SetSetting(ctx, "theme", string(data)); err != nil {
				log.Printf("seedSettings: failed to seed theme: %v", err)
			}
		}
	}

	// Seed default nav_links / footer_links / social_links if absent.
	if _, ok := all["nav_links"]; !ok {
		defaultNav := `[{"type":"builtin","label":"Home","url":"/","order":0},{"type":"builtin","label":"Articles","url":"/articles/","order":1},{"type":"builtin","label":"Contact","url":"/contact/","order":2}]`
		_ = repo.SetSetting(ctx, "nav_links", defaultNav)
	}
	if _, ok := all["footer_links"]; !ok {
		defaultFooter := `[{"type":"builtin","label":"Home","url":"/","order":0},{"type":"builtin","label":"Articles","url":"/articles/","order":1},{"type":"builtin","label":"Contact","url":"/contact/","order":2}]`
		_ = repo.SetSetting(ctx, "footer_links", defaultFooter)
	}
	if _, ok := all["social_links"]; !ok {
		type socialLink struct {
			Platform string `json:"platform"`
			URL      string `json:"url"`
		}
		var links []socialLink
		if cfg.Site.Social.Twitter != "" {
			links = append(links, socialLink{"twitter", cfg.Site.Social.Twitter})
		}
		if cfg.Site.Social.LinkedIn != "" {
			links = append(links, socialLink{"linkedin", cfg.Site.Social.LinkedIn})
		}
		if cfg.Site.Social.GitHub != "" {
			links = append(links, socialLink{"github", cfg.Site.Social.GitHub})
		}
		b, _ := json.Marshal(links)
		_ = repo.SetSetting(ctx, "social_links", string(b))
	}

	// Seed default header_sections with a navigation layout.
	if _, ok := all["header_sections"]; !ok {
		defaultHeader := `[{"id":"header-nav-links","type":"nav-links","visible":true,"order":0,"config":{"dropdown_style":"simple","show_language_switcher":true,"link_color":null,"bg_color":null,"sticky":true},"translations":{}}]`
		_ = repo.SetSetting(ctx, "header_sections", defaultHeader)
	}

	// Seed default home_sections matching the existing layout.
	if _, ok := all["home_sections"]; !ok {
		defaultSections := `[
			{"id":"hero","type":"hero","visible":true,"order":0,"config":{"bg_image":"/site-assets/reference/hero.jpg","elementId":null,"customStyle":null},"translations":{"en":{"headline":"Anastasija Gichevska","subheadline":"Macedonian Pianist • Piano Accompanist • Piano Teacher","cta_label":"","cta_url":""}}},
			{"id":"about","type":"rich-text","visible":true,"order":1,"config":{"elementId":"about","customStyle":"","fullWidth":true,"content":"<div class=\"reference-section reference-about\"><div class=\"space-y-6\"><div class=\"space-y-2\"><p class=\"reference-eyebrow\">About</p><h2 class=\"reference-section-title\">Anastasija Gichevska</h2></div><div class=\"reference-about-copy\"><p>Anastasija Gichevska is a Macedonian concert pianist, chamber musician, and piano teacher with an international career. She completed her Bachelor’s degree in Piano Performance with honors at the Faculty of Music in Skopje, North Macedonia, continued her Master’s studies at the Academy of Music in Ljubljana, Slovenia, and University of Music and Performing Arts Graz (KUG), Austria. A prizewinner of over 30 international competitions, Anastasija has performed as a soloist, chamber musician, and with orchestra across Europe and the USA, earning recognition for her expressive playing and dynamic stage presence. Alongside her performing career, she is a dedicated teacher, guiding students to develop both technical mastery and deep musical artistry.</p></div><p><a class=\"inline-flex items-center justify-center rounded-full border border-[#111] px-6 py-3 text-xs uppercase tracking-[0.4em] transition hover:bg-[#111] hover:text-white\" href=\"/cv.pdf\" download>Biography PDF</a></p></div><div class=\"reference-quote-card\"><blockquote>“A pianist with a strong temperament and deep emotional expression.”</blockquote><p class=\"mt-4 text-xs uppercase tracking-[0.4em] text-[#7a7263]\">David Fray</p></div></div>"},"translations":{"en":{}}},
			{"id":"schedule","type":"schedule","visible":true,"order":2,"config":{"elementId":"schedule","customStyle":null,"items":[{"date":"FEB 08, 2026","title":"Voice & Piano Concert","location":"Biel, Switzerland"},{"date":"MAR 31, 2026","title":"Violin & Piano Concert","location":"Split, Croatia"},{"date":"MAY 30, 2026","title":"Solo Piano Concert","location":"León, Spain"}]},"translations":{"en":{"eyebrow":"Schedule","title":"Upcoming Performances"}}},
			{"id":"gallery","type":"gallery","visible":true,"order":3,"config":{"elementId":"gallery","customStyle":null,"columns":3,"imageHeight":288,"items":[{"src":"/site-assets/reference/gallery-01.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-02.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-03.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-04.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-05.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-06.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-07.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-08.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-09.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-10.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-11.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-12.jpg","alt":"Piano performance still"},{"src":"/site-assets/reference/gallery-13.jpg","alt":"Piano performance still"}]},"translations":{"en":{"eyebrow":"Gallery","title":"In Focus"}}},
			{"id":"recordings","type":"recordings","visible":true,"order":4,"config":{"elementId":"recordings","customStyle":null,"items":[]},"translations":{"en":{"eyebrow":"Recordings","title":"Watch & Listen"}}},
			{"id":"contact-section","type":"rich-text","visible":true,"order":5,"config":{"elementId":"contact","customStyle":"","fullWidth":true,"content":"<div class=\"reference-section\"><div class=\"reference-contact-section\"><div class=\"space-y-6\"><div class=\"space-y-2\"><p class=\"reference-eyebrow\">Contact</p><h2 class=\"reference-section-title\">Collaborations & Online Piano Lessons</h2></div><p class=\"text-sm leading-relaxed text-[#3d3d3d]\">For performance engagements, media requests, masterclasses, online lessons, or collaborative projects, please get in touch.</p><p><a class=\"inline-flex items-center justify-center rounded-full border border-[#111] px-6 py-3 text-xs uppercase tracking-[0.4em] transition hover:bg-[#111] hover:text-white\" href=\"/en/contact/\">Send Message</a></p></div></div></div>"},"translations":{"en":{}}}
		]`
		_ = repo.SetSetting(ctx, "home_sections", defaultSections)
	}

	// Seed languages from config.yaml if not yet stored in DB.
	if _, ok := all["languages"]; !ok {
		b, _ := json.Marshal(cfg.Languages)
		_ = repo.SetSetting(ctx, "languages", string(b))
	}

	// Seed default UI strings (English) if not yet stored.
	if _, ok := all["ui_strings"]; !ok {
		defaultUI := `{"en":{"contact_title":"Contact","contact_intro":"Fill in the form below and we'll get back to you.","contact_first_name":"First name","contact_last_name":"Last name","contact_company":"Company","contact_email":"Email","contact_phone":"Phone","contact_message":"Message","contact_submit":"Send message","contact_success":"Thank you for your message — we'll be in touch soon!","contact_error":"Something went wrong. Please try again.","unsubscribe_title":"Unsubscribe","unsubscribe_intro":"Enter your email address below to unsubscribe from the newsletter.","unsubscribe_email_placeholder":"Your email address","unsubscribe_submit":"Unsubscribe","unsubscribe_success":"You have been unsubscribed successfully.","articles_title":"Articles","articles_intro":"Articles, guides and news.","articles_all_filter":"All","articles_no_results":"No articles found for this tag.","articles_no_articles":"No articles published yet. Check back soon.","article_home":"Home","article_read_more":"Read more","article_back":"Back to Articles","reading_time_suffix":"min read"}}`
		_ = repo.SetSetting(ctx, "ui_strings", defaultUI)
	}
}

func main() {
	migrateOnly := flag.Bool("migrate-only", false, "apply DB migrations and exit")
	flag.Parse()

	// 1. Load .env (ignored if absent). In local dev we usually run from
	// backend/, while the shared .env lives at the repo root.
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	// 2. Load config.yaml
	// CONFIG_PATH env var wins; otherwise auto-detect (Docker: ./config.yaml, dev: ../config.yaml).
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		if _, statErr := os.Stat("config.yaml"); statErr == nil {
			configPath = "config.yaml"
		} else {
			configPath = filepath.Join("..", "config.yaml")
		}
	}
	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("failed to load config.yaml: %v", err)
	}

	// Resolve theme.json path alongside config.yaml.
	themeDir := filepath.Dir(configPath)
	themePath := filepath.Join(themeDir, "theme.json")

	// 3. Read env vars
	dbPath := getEnv("DB_PATH", "./blog.db")
	port := getEnv("PORT", "8080")
	uploadDir := getEnv("UPLOAD_DIR", "./uploads")
	adminDistDir := getEnv("ADMIN_DIST", "./admin/dist")
	siteDistDir := getEnv("SITE_DIST", "./site/dist")
	contactEmail := getEnv("CONTACT_EMAIL", cfg.ContactEmail)

	tenantID := os.Getenv("MS_GRAPH_TENANT_ID")
	clientID := os.Getenv("MS_GRAPH_CLIENT_ID")
	clientSecret := os.Getenv("MS_GRAPH_CLIENT_SECRET")
	sender := os.Getenv("MS_GRAPH_SENDER")

	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := getEnv("SMTP_PORT", "587")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	smtpSender := os.Getenv("SMTP_SENDER")

	emailProvider := strings.ToLower(getEnv("EMAIL_PROVIDER", "msgraph"))

	// 4. Ensure upload directory exists
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Fatalf("failed to create upload dir: %v", err)
	}

	// 5. Open database
	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	if *migrateOnly {
		log.Printf("database migrations applied: %s", dbPath)
		return
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	// 6. Instantiate services and handlers
	repo := models.NewRepository(database)

	// Seed DB from config.yaml + theme.json on first boot.
	seedSettings(repo, cfg, themePath)

	var emailSvc services.EmailSender
	var emailConfigured bool
	switch emailProvider {
	case "smtp":
		emailSvc = services.NewSMTPEmailService(smtpHost, smtpPort, smtpUser, smtpPass, smtpSender)
		emailConfigured = smtpHost != ""
	default:
		emailSvc = services.NewMSGraphEmailService(tenantID, clientID, clientSecret, sender)
		emailConfigured = tenantID != "" && clientID != ""
	}
	authH := handlers.NewAuthHandler(repo, jwtSecret)
	publicH := handlers.NewPublicHandler(repo, cfg)
	adminH := handlers.NewAdminHandler(repo, cfg, uploadDir)
	contactH := handlers.NewContactHandler(repo, emailSvc, contactEmail)
	newsletterH := handlers.NewNewsletterHandler(repo)
	settingsH := handlers.NewSettingsHandler(repo, emailProvider, emailConfigured, emailSvc)
	pagesH := handlers.NewPagesHandler(repo, cfg)

	// 7. Echo setup
	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	}))

	// 8. Health check — required by ONCE for zero-downtime deploys
	e.GET("/up", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Static uploads
	e.Static("/uploads", uploadDir)

	// Admin UI — React SPA served from /admin/* with index.html fallback
	adminHandler := func(c echo.Context) error {
		subPath := filepath.Clean("/" + c.Param("*"))
		target := filepath.Join(adminDistDir, subPath)
		// Prevent path traversal outside adminDistDir
		rel, relErr := filepath.Rel(adminDistDir, target)
		if relErr != nil || strings.HasPrefix(rel, "..") {
			return echo.ErrForbidden
		}
		if info, statErr := os.Stat(target); statErr == nil && !info.IsDir() {
			return c.File(target)
		}
		return c.File(filepath.Join(adminDistDir, "index.html"))
	}
	e.GET("/admin", adminHandler)
	e.GET("/admin/*", adminHandler)

	// 9. Routes
	api := e.Group("/api/v1")

	// Auth
	api.POST("/auth/login", authH.Login)
	api.POST("/auth/refresh", authH.Refresh, jwtMiddleware.JWTMiddleware(jwtSecret))

	// Public config
	api.GET("/config/languages", publicH.GetLanguages)
	api.GET("/config/site", publicH.GetSiteConfig)
	api.GET("/config/nav", publicH.GetNavConfig)
	api.GET("/config/footer", publicH.GetFooterConfig)
	api.GET("/config/social", publicH.GetSocialConfig)
	api.GET("/config/theme", publicH.GetThemeConfig)
	api.GET("/config/home", publicH.GetHomeSections)
	api.GET("/config/header", publicH.GetHeaderSections)
	api.GET("/config/footer-sections", publicH.GetFooterSections)
	api.GET("/config/article-layout", publicH.GetArticleLayoutConfig)
	api.GET("/config/ui-strings", publicH.GetUIStrings)

	// Public articles
	api.GET("/articles", publicH.ListArticles)
	api.GET("/articles/:slug", publicH.GetArticle)

	// Public pages
	api.GET("/pages", pagesH.ListPublicPages)
	api.GET("/pages/:slug", pagesH.GetPublicPage)

	// Public forms
	api.POST("/contact", contactH.SubmitContact)
	api.POST("/newsletter/subscribe", newsletterH.Subscribe)
	api.POST("/newsletter/unsubscribe", newsletterH.Unsubscribe)

	// Admin (JWT protected)
	admin := api.Group("/admin", jwtMiddleware.JWTMiddleware(jwtSecret))

	admin.GET("/articles", adminH.ListArticles)
	admin.POST("/articles", adminH.CreateArticle)
	admin.GET("/articles/:id", adminH.GetArticleByID)
	admin.PUT("/articles/:id", adminH.UpdateArticle)
	admin.DELETE("/articles/:id", adminH.DeleteArticle)
	admin.GET("/tags", adminH.GetTags)
	admin.POST("/rebuild", adminH.TriggerRebuild)

	admin.GET("/media", adminH.ListMedia)
	admin.POST("/media", adminH.UploadMedia)
	admin.DELETE("/media/:id", adminH.DeleteMedia)

	admin.GET("/contacts", adminH.ListContacts)
	admin.GET("/newsletter", adminH.ListNewsletter)

	admin.GET("/settings", settingsH.GetSettings)
	admin.PUT("/settings", settingsH.PutSettings)
	admin.POST("/settings/test-email", settingsH.SendTestEmail)

	admin.GET("/pages", pagesH.ListPages)
	admin.POST("/pages", pagesH.CreatePage)
	admin.GET("/pages/:id", pagesH.GetPage)
	admin.PUT("/pages/:id", pagesH.UpdatePage)
	admin.DELETE("/pages/:id", pagesH.DeletePage)

	// Public site — Eleventy static output, catch-all (must be registered last)
	e.Static("/", siteDistDir)

	// 10. Start
	e.Logger.Fatal(e.Start(":" + port))
}
