package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const turnstileSiteverifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

var ErrTurnstileRejected = errors.New("turnstile verification rejected")

// TurnstileVerifier validates the short-lived token created by the browser
// before a public form submission is accepted.
type TurnstileVerifier struct {
	secret   string
	endpoint string
	client   *http.Client
}

func NewTurnstileVerifier(secret string) *TurnstileVerifier {
	return &TurnstileVerifier{
		secret:   strings.TrimSpace(secret),
		endpoint: turnstileSiteverifyURL,
		client:   &http.Client{Timeout: 5 * time.Second},
	}
}

type turnstileResponse struct {
	Success    bool     `json:"success"`
	Action     string   `json:"action"`
	ErrorCodes []string `json:"error-codes"`
}

func (v *TurnstileVerifier) Verify(ctx context.Context, token string) error {
	if v == nil || v.secret == "" {
		return fmt.Errorf("%w: verifier is not configured", ErrTurnstileRejected)
	}
	if strings.TrimSpace(token) == "" {
		return fmt.Errorf("%w: token is missing", ErrTurnstileRejected)
	}

	form := url.Values{
		"secret":   {v.secret},
		"response": {token},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("create turnstile request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("verify turnstile token: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("turnstile siteverify returned status %d", res.StatusCode)
	}

	var result turnstileResponse
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode turnstile response: %w", err)
	}
	if !result.Success {
		return fmt.Errorf("%w: %s", ErrTurnstileRejected, strings.Join(result.ErrorCodes, ","))
	}
	if result.Action != "contact" {
		return fmt.Errorf("%w: unexpected action", ErrTurnstileRejected)
	}

	return nil
}
