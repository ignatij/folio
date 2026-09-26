import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "contacts", page],
    queryFn: () => adminApi.listContacts(page),
  });
  const contacts = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));
  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteContact,
    onSuccess: async () => {
      if (contacts.length === 1 && page > 1) setPage((current) => current - 1);
      await queryClient.invalidateQueries({ queryKey: ["admin", "contacts"] });
    },
  });

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contact Submissions</h1>
      {deleteMutation.isError && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteMutation.error.message}
        </div>
      )}
      <div className="bg-(--color-bg-surface) rounded-lg shadow overflow-x-auto border border-(--color-border)">
        <table className="min-w-full divide-y divide-(--color-border)">
          <thead className="bg-(--color-bg)">
            <tr>
              {["Name", "Company", "Email", "Phone", "Date", "Message", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-(--color-muted) uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-border)">
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-(--color-muted) text-sm"
                >
                  No contact submissions yet.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-(--color-bg) align-top">
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-4 py-3 text-sm text-(--color-muted)">
                  {c.company || "—"}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <a
                    href={`mailto:${c.email}`}
                    className="text-accent hover:underline"
                  >
                    {c.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-(--color-muted) whitespace-nowrap">
                  {c.phone || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-(--color-muted) whitespace-nowrap">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-(--color-text) min-w-72 max-w-xl whitespace-pre-wrap break-all">
                  {c.message}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Permanently delete the submission from ${c.first_name} ${c.last_name}?`,
                        )
                      ) {
                        deleteMutation.mutate(c.id);
                      }
                    }}
                    className="text-red-600 hover:underline disabled:opacity-40"
                    aria-label={`Delete submission from ${c.first_name} ${c.last_name}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-(--color-muted)">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
