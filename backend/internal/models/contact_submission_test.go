package models_test

import (
	"context"
	"testing"

	"folio/internal/models"
)

func TestDeleteContactSubmission(t *testing.T) {
	repo := models.NewRepository(openTestDB(t))
	ctx := context.Background()

	id, err := repo.CreateContactSubmission(ctx, models.ContactSubmission{
		FirstName: "Test",
		Email:     "test@example.com",
		Message:   "Delete me",
	})
	if err != nil {
		t.Fatalf("create contact: %v", err)
	}

	deleted, err := repo.DeleteContactSubmission(ctx, id)
	if err != nil {
		t.Fatalf("delete contact: %v", err)
	}
	if !deleted {
		t.Fatal("expected the contact to be deleted")
	}

	items, total, err := repo.ListContactSubmissions(ctx, 20, 0)
	if err != nil {
		t.Fatalf("list contacts: %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Fatalf("expected no contacts after deletion; total=%d items=%d", total, len(items))
	}

	deleted, err = repo.DeleteContactSubmission(ctx, id)
	if err != nil {
		t.Fatalf("delete missing contact: %v", err)
	}
	if deleted {
		t.Fatal("expected deleting a missing contact to report false")
	}
}
