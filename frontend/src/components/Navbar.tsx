import { Link, useNavigate } from "@tanstack/react-router";

import { useState } from "react";

import { Button, Drawer } from "@/design-system";
import { useAuthStore } from "@personal/shared/stores/auth";

type TopTabPath =
  | "/"
  | "/tasks"
  | "/projects"
  | "/timer"
  | "/whiteboard"
  | "/expenses"
  | "/counters"
  | "/bibliografia";

/** Link colors for the dark header bar and for the light mobile drawer. */
const tabToneClasses = {
  dark: "text-nav-muted hover:text-nav-text data-[selected]:bg-nav-selected data-[selected]:text-nav-text",
  light:
    "text-ink-soft hover:bg-wash hover:text-ink data-[selected]:bg-deep-ink data-[selected]:text-nav-text",
};

function TopTabLink({
  to,
  children,
  tone = "dark",
  onClick,
}: {
  to: TopTabPath;
  children: string;
  tone?: keyof typeof tabToneClasses;
  onClick?: () => void;
}) {
  return (
    <Link
      className={`cursor-pointer rounded-[5px] border border-transparent bg-transparent px-[14px] py-2 font-utility text-[11px] font-semibold tracking-[0.08em] transition-colors ${tabToneClasses[tone]}`}
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
  { to: "/whiteboard", label: "Notatnik" },
  { to: "/expenses", label: "Wydatki" },
  { to: "/counters", label: "Liczniki" },
  { to: "/bibliografia", label: "Bibliografia" },
];

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [isNavOpen, setIsNavOpen] = useState(false);

  function closeNav() {
    setIsNavOpen(false);
  }

  return (
    <>
      <header className="bg-deep-ink text-nav-text">
        <div className="mx-auto flex h-[68px] w-full max-w-app items-center justify-between gap-7 px-[38px]">
          <Link
            className="inline-flex items-center gap-[11px] text-[15px] font-bold tracking-[-0.03em] text-inherit no-underline"
            to="/"
            aria-label="DjangoPersonal — strona główna"
          >
            <span
              className="inline-flex h-[29px] w-[29px] items-center justify-center rounded-[5px_5px_5px_1px] bg-signal font-utility text-[13px] text-on-signal -rotate-[3deg]"
              aria-hidden="true"
            >
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
            className="md:hidden inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-[24px] leading-none text-nav-muted transition-all hover:-translate-y-px cursor-pointer"
            aria-label={isNavOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={isNavOpen}
            aria-controls="mobile-nav"
            onClick={() => setIsNavOpen((open) => !open)}
          >
            <span aria-hidden="true">{isNavOpen ? "×" : "☰"}</span>
          </button>
          {user && (
            <div className="hidden md:flex items-center gap-4">
              <Link
                className="text-[13px] font-medium text-nav-muted no-underline transition-colors hover:text-nav-text"
                to="/user"
              >
                {user.username}
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  logout();
                  navigate({ to: "/login" });
                }}
              >
                Wyloguj
              </Button>
            </div>
          )}
        </div>
      </header>
      {isNavOpen && (
        <Drawer
          id="mobile-nav"
          label="Menu"
          onClose={closeNav}
          title={
            <div className="inline-flex items-center gap-[11px] text-[15px] font-bold tracking-[-0.03em]">
              <span
                className="inline-flex h-[29px] w-[29px] items-center justify-center rounded-[5px_5px_5px_1px] bg-signal font-utility text-[13px] text-on-signal -rotate-[3deg]"
                aria-hidden="true"
              >
                D
              </span>
              <span>Menu</span>
            </div>
          }
        >
          <nav className="flex flex-col gap-1" aria-label="Nawigacja widoków">
            {NAV_ITEMS.map((item) => (
              <TopTabLink
                key={item.to}
                to={item.to}
                tone="light"
                onClick={closeNav}
              >
                {item.label}
              </TopTabLink>
            ))}
          </nav>
          {user && (
            <div className="flex items-center gap-4">
              <Link
                className="text-[13px] font-medium text-ink-soft no-underline transition-colors hover:text-ink"
                to="/user"
                onClick={closeNav}
              >
                {user.username}
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  closeNav();
                  logout();
                  navigate({ to: "/login" });
                }}
              >
                Wyloguj
              </Button>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}
