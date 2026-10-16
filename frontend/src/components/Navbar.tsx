import { Link } from "@tanstack/react-router";

type TopTabPath = "/" | "/tasks" | "/timer";

function TopTabLink({ to, children }: { to: TopTabPath; children: string }) {
  return (
    <Link
      className="topbar-tab"
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{
        className: "topbar-tab is-selected",
        "aria-current": "page",
      }}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  return (
    <header className="topbar">
      <Link className="brand" to="/" aria-label="DjangoPersonal — strona główna">
        <span className="brand-mark" aria-hidden="true">
          D
        </span>
        <span>DjangoPersonal</span>
      </Link>
      <nav className="topbar-tabs" aria-label="Nawigacja widoków">
        <TopTabLink to="/">Start</TopTabLink>
        <TopTabLink to="/tasks">Zadania</TopTabLink>
        <TopTabLink to="/timer">Czas</TopTabLink>
      </nav>
    </header>
  );
}
