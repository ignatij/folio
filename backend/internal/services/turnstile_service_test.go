package services

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func responseClient(t *testing.T, response string, check func(*http.Request)) *http.Client {
	t.Helper()
	return &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if check != nil {
			check(req)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(response)),
		}, nil
	})}
}

func TestTurnstileVerifierAcceptsContactToken(t *testing.T) {
	verifier := NewTurnstileVerifier("test-secret")
	verifier.client = responseClient(t, `{"success":true,"action":"contact"}`, func(r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		values, err := url.ParseQuery(string(body))
		if err != nil {
			t.Fatal(err)
		}
		if values.Get("secret") != "test-secret" || values.Get("response") != "test-token" {
			t.Fatalf("unexpected siteverify payload: %v", values)
		}
	})
	if err := verifier.Verify(context.Background(), "test-token"); err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
}

func TestTurnstileVerifierRejectsMissingAndInvalidTokens(t *testing.T) {
	verifier := NewTurnstileVerifier("test-secret")
	if err := verifier.Verify(context.Background(), ""); !errors.Is(err, ErrTurnstileRejected) {
		t.Fatalf("missing token error = %v", err)
	}

	verifier.client = responseClient(t, `{"success":false,"error-codes":["timeout-or-duplicate"]}`, nil)
	if err := verifier.Verify(context.Background(), "invalid-token"); !errors.Is(err, ErrTurnstileRejected) {
		t.Fatalf("invalid token error = %v", err)
	}
}

func TestTurnstileVerifierRejectsWrongAction(t *testing.T) {
	verifier := NewTurnstileVerifier("test-secret")
	verifier.client = responseClient(t, `{"success":true,"action":"newsletter"}`, nil)
	if err := verifier.Verify(context.Background(), "test-token"); !errors.Is(err, ErrTurnstileRejected) {
		t.Fatalf("wrong action error = %v", err)
	}
}
