import { Link, useNavigate } from "@tanstack/react-router";

import { useEffect, useState } from "react";

import { useAuthStore } from "@/stores/auth";

type TopTabPath = "/" | "/tasks" | "/projects" | "/timer" | "/whiteboard" | "/expenses";

function TopTabLink({
  to,
  children,
  onClick,
}: {
  to: TopTabPath;
  children: string;
  onClick?: () => void;
}) {
  return (
    <Link
      className="topbar-tab"
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{
        className: "topbar-tab is-selected",
        "aria-current": "page",
      }}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

const NAV_ITEMS: Array<{ to: TopTabPath; label: string }> = [
  { to: "/", label: "Start" },
  { to: "/tasks", label: "Zadania" },
  { to: "/projects", label: "Projekty" },
  { to: "/timer", label: "Czas" },
  { to: "/whiteboard", label: "Notatki" },
  { to: "/expenses", label: "Wydatki" },
];

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);

  function closeNav() {
    setIsNavOpen(false);
  }

  useEffect(() => {
    if (!isNavOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeNav();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isNavOpen]);

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="DjangoPersonal — strona główna">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>DjangoPersonal</span>
        </Link>
        <nav className="topbar-tabs" aria-label="Nawigacja widoków">
          {NAV_ITEMS.map((item) => (
            <TopTabLink key={item.to} to={item.to}>
              {item.label}
            </TopTabLink>
          ))}
        </nav>
        <button
          type="button"
          className="nav-toggle"
          aria-label={isNavOpen ? "Zamknij menu" : "Otwórz menu"}
          aria-expanded={isNavOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsNavOpen((open) => !open)}
        >
          <span aria-hidden="true">{isNavOpen ? "×" : "☰"}</span>
        </button>
        {user && (
          <div className="topbar-user">
            <span>{user.username}</span>
            <button
              type="button"
              className="quiet-button"
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
            >
              Wyloguj
            </button>
          </div>
        )}
      </header>
      {isNavOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeNav();
          }}
        >
          <nav
            className="mobile-nav"
            aria-label="Nawigacja widoków"
            id="mobile-nav"
          >
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                D
              </span>
              <span>Menu</span>
            </div>
            <div className="mobile-nav-links">
              {NAV_ITEMS.map((item) => (
                <TopTabLink key={item.to} to={item.to} onClick={closeNav}>
                  {item.label}
                </TopTabLink>
              ))}
            </div>
            {user && (
              <div className="mobile-nav-user">
                <span>{user.username}</span>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => {
                    closeNav();
                    logout();
                    navigate({ to: "/login" });
                  }}
                >
                  Wyloguj
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
