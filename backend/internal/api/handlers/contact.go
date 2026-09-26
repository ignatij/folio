package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"folio/internal/models"
	"folio/internal/services"

	"github.com/labstack/echo/v4"
)

type ContactHandler struct {
	repo         *models.Repository
	emailSvc     services.EmailSender
	contactEmail string
	turnstile    interface {
		Verify(context.Context, string) error
	}
}

func NewContactHandler(repo *models.Repository, emailSvc services.EmailSender, contactEmail string, turnstile interface {
	Verify(context.Context, string) error
}) *ContactHandler {
	return &ContactHandler{repo: repo, emailSvc: emailSvc, contactEmail: contactEmail, turnstile: turnstile}
}

type contactRequest struct {
	FirstName      string `json:"first_name" form:"first_name"`
	LastName       string `json:"last_name" form:"last_name"`
	Email          string `json:"email" form:"email"`
	Company        string `json:"company" form:"company"`
	Phone          string `json:"phone" form:"phone"`
	Message        string `json:"message" form:"message"`
	PrivacyConsent string `json:"privacy_consent" form:"privacy_consent"`
	Website        string `json:"website" form:"website"`
	TurnstileToken string `json:"cf-turnstile-response" form:"cf-turnstile-response"`
}

// SubmitContact — POST /api/v1/contact
func (h *ContactHandler) SubmitContact(c echo.Context) error {
	var req contactRequest
	if err := c.Bind(&req); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Website) != "" {
		// Honeypot fields are invisible to people. Pretend the submission
		// succeeded so simple form-filling bots do not learn to avoid it.
		return c.JSON(http.StatusCreated, map[string]bool{"ok": true})
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Email = strings.TrimSpace(req.Email)
	req.Message = strings.TrimSpace(req.Message)

	if req.FirstName == "" {
		return respondError(c, http.StatusBadRequest, "first name is required")
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return respondError(c, http.StatusBadRequest, "valid email is required")
	}
	if req.Message == "" {
		return respondError(c, http.StatusBadRequest, "message is required")
	}
	if h.turnstile == nil {
		log.Printf("[contact] rejected submission: Turnstile is not configured")
		return respondError(c, http.StatusServiceUnavailable, "contact form is temporarily unavailable")
	}
	if err := h.turnstile.Verify(c.Request().Context(), req.TurnstileToken); err != nil {
		log.Printf("[contact] Turnstile verification failed: %v", err)
		return respondError(c, http.StatusBadRequest, "human verification failed; please try again")
	}

	cs := models.ContactSubmission{
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Company:       req.Company,
		Email:         req.Email,
		Phone:         req.Phone,
		Message:       req.Message,
		PrivacyAgreed: true,
	}

	id, err := h.repo.CreateContactSubmission(c.Request().Context(), cs)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to save submission")
	}
	cs.ID = id

	// Resolve the contact recipient from the DB site settings (updated via admin UI),
	// falling back to the value set at startup via env / config.yaml.
	contactEmail := h.contactEmail
	if siteJSON, err := h.repo.GetSetting(c.Request().Context(), "site"); err == nil && siteJSON != "" {
		var site struct {
			ContactEmail string `json:"contactEmail"`
		}
		if json.Unmarshal([]byte(siteJSON), &site) == nil && site.ContactEmail != "" {
			contactEmail = site.ContactEmail
		}
	}

	fullName := strings.TrimSpace(req.FirstName + " " + req.LastName)
	subject := fmt.Sprintf("New contact from %s", fullName)
	htmlBody := fmt.Sprintf(`<table border="1" cellpadding="6" cellspacing="0">
<tr><th>Name</th><td>%s</td></tr>
<tr><th>Email</th><td>%s</td></tr>
<tr><th>Company</th><td>%s</td></tr>
<tr><th>Phone</th><td>%s</td></tr>
<tr><th>Message</th><td>%s</td></tr>
</table>`, fullName, req.Email, req.Company, req.Phone, req.Message)

	if err := h.emailSvc.SendEmail(c.Request().Context(), contactEmail, subject, htmlBody); err != nil {
		log.Printf("[contact] email notification failed: %v", err)
	}

	return c.JSON(http.StatusCreated, cs)
}
