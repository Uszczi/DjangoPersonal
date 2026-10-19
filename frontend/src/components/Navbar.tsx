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
      className="cursor-pointer rounded-[5px] border border-transparent bg-transparent px-[14px] py-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-[#b5c6c6] transition-colors hover:text-white data-[selected]:bg-[#29474d] data-[selected]:text-white"
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{
        "data-selected": "true",
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
      <header className="flex h-[68px] items-center justify-between gap-7 bg-deep-ink px-[38px] text-[#f4f7f4]">
        <Link className="inline-flex items-center gap-[11px] text-[15px] font-bold tracking-[-0.03em] text-inherit no-underline" to="/" aria-label="DjangoPersonal — strona główna">
          <span className="inline-flex h-[29px] w-[29px] items-center justify-center rounded-[5px_5px_5px_1px] bg-signal font-utility text-[13px] text-white -rotate-[3deg]" aria-hidden="true">
            D
          </span>
          <span>DjangoPersonal</span>
        </Link>
        <nav className="hidden md:flex gap-1" aria-label="Nawigacja widoków">
          {NAV_ITEMS.map((item) => (
            <TopTabLink key={item.to} to={item.to}>
              {item.label}
            </TopTabLink>
          ))}
        </nav>
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-[24px] leading-none text-[#b5c6c6] transition-all hover:-translate-y-px cursor-pointer"
          aria-label={isNavOpen ? "Zamknij menu" : "Otwórz menu"}
          aria-expanded={isNavOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsNavOpen((open) => !open)}
        >
          <span aria-hidden="true">{isNavOpen ? "×" : "☰"}</span>
        </button>
        {user && (
          <div className="hidden md:flex items-center gap-4">
            <Link className="text-[13px] font-medium text-[#b5c6c6] no-underline transition-colors hover:text-white" to="/user">
              {user.username}
            </Link>
            <button
              type="button"
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
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
          className="fixed inset-0 z-5 flex items-start justify-start bg-[rgb(12_29_33/52%)] p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeNav();
          }}
        >
          <nav
            className="flex min-h-[200px] w-full max-w-[320px] flex-col gap-5 rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-nav-enter"
            aria-label="Nawigacja widoków"
            id="mobile-nav"
          >
            <div className="inline-flex items-center gap-[11px] text-[15px] font-bold tracking-[-0.03em] text-inherit no-underline">
              <span className="inline-flex h-[29px] w-[29px] items-center justify-center rounded-[5px_5px_5px_1px] bg-signal font-utility text-[13px] text-white -rotate-[3deg]" aria-hidden="true">
                D
              </span>
              <span>Menu</span>
            </div>
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <TopTabLink key={item.to} to={item.to} onClick={closeNav}>
                  {item.label}
                </TopTabLink>
              ))}
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <Link className="text-[13px] font-medium text-[#b5c6c6] no-underline transition-colors hover:text-white" to="/user" onClick={closeNav}>
                  {user.username}
                </Link>
                <button
                  type="button"
                  className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
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