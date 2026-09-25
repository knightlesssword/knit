import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Loading } from "../components/states";
import { useAuth } from "../features/auth/AuthContext";

const NAV = [
  { to: "/", label: "overview" },
  { to: "/projects", label: "projects" },
  { to: "/clients", label: "clients" },
  { to: "/tasks", label: "tasks" },
  { to: "/timesheet", label: "timesheet" },
  { to: "/invoices", label: "invoices" },
  { to: "/settings", label: "settings" },
  { to: "/about", label: "about" },
];

export function Shell() {
  const { user, loading, logout, serverUnreachable, retry } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="main">
        <Loading label="loading knit" />
      </main>
    );
  }
  if (serverUnreachable && !user) {
    return (
      <main className="main">
        <h1>server unreachable</h1>
        <p className="meta">
          couldn't reach the local server. your login is kept — start the backend,
          then try again.
        </p>
        <button type="button" onClick={retry}>
          try again
        </button>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="shell">
      <aside className="side">
        <NavLink to="/" className="brand">
          knit
        </NavLink>
        <nav aria-label="primary">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div>
          <p className="meta">{user.email}</p>
          <button type="button" className="secondary" onClick={logout}>
            log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
