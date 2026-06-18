import { useEffect } from "react";
import { Navigate, Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { adminApi } from "../api/client";
import { applyThemeToDocument } from "../utils/theme";

/** Fetches the saved theme from the DB and applies it to the document on mount. */
function useThemeSync() {
  useEffect(() => {
    adminApi
      .getSettings()
      .then((settings) => {
        const theme = settings?.theme;
        if (!theme?.colors) return;
        applyThemeToDocument(theme);
      })
      .catch(() => {
        /* ignore — fallback to CSS defaults */
      });
  }, []);
}

const links = [
  { label: "Dashboard", to: "/admin", section: false },
  { label: "Content", to: null, section: true },
  { label: "Articles", to: "/admin/articles", section: false },
  { label: "Pages", to: "/admin/pages", section: false },
  { label: "Media", to: "/admin/media", section: false },
  { label: "Data", to: null, section: true },
  { label: "Contacts", to: "/admin/contacts", section: false },
  { label: "Newsletter", to: "/admin/newsletter", section: false },
  { label: "Customization", to: null, section: true },
  { label: "Home Layout", to: "/admin/home-builder", section: false },
  { label: "Header Layout", to: "/admin/header-builder", section: false },
  { label: "Footer Layout", to: "/admin/footer-builder", section: false },
  { label: "Article Layout", to: "/admin/article-builder", section: false },
  { label: "Settings", to: "/admin/settings", section: false },
] as const;

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  useThemeSync();

  if (!isAuthenticated) {
    const redirect = location.pathname + location.search;
    return (
      <Navigate
        to={`/admin/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-56 flex flex-col shrink-0"
        style={{
          background: "color-mix(in srgb, var(--color-bg-surface) 92%, white)",
          color: "var(--color-text)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        <div
          className="h-16 flex items-center px-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <Link to="/admin" className="font-bold text-lg tracking-tight text-(--color-text)">
            Blog Admin
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {links.map((item, i) => {
            if (item.section) {
              return (
                <p
                  key={i}
                  className="px-2 pt-4 pb-1 text-xs font-semibold text-(--color-muted) uppercase tracking-wider"
                >
                  {item.label}
                </p>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? "font-medium"
                      : "text-(--color-muted) hover:text-(--color-text)"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background:
                          "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                        color: "var(--color-text)",
                      }
                    : undefined
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-sm text-(--color-muted) hover:text-(--color-text) rounded text-left transition-colors"
            style={{ background: "transparent" }}
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-(--color-bg)">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
