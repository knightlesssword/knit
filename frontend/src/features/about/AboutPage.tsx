import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { version as frontendVersion } from "../../../package.json";

/** About: what knit is, how to operate it, and where things live. */
export function AboutPage() {
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [backendState, setBackendState] = useState<"loading" | "ok" | "down">("loading");

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setBackendVersion(h.version);
        setBackendState("ok");
      })
      .catch(() => setBackendState("down"));
  }, []);

  return (
    <div>
      <h1>about</h1>
      <p className="meta">
        knit is a minimalist, local-first freelance project manager. it answers: what am i
        working on, what is due, how much work have i done, and what money is associated
        with it — without a dense administrative dashboard.
      </p>

      <hr className="rule" />
      <section aria-labelledby="about-controls">
        <h2 id="about-controls">controls</h2>
        <p className="meta">
          every interactive element is keyboard accessible. tab and shift+tab move between
          controls, enter or space activates them. the sidebar links are the navigation —
          nothing is hover-only.
        </p>
        <p className="meta">
          a command palette (ctrl/cmd+k) and discoverable shortcuts arrive in a later
          phase. they are not implemented yet.
        </p>
      </section>

      <hr className="rule" />
      <section aria-labelledby="about-usage">
        <h2 id="about-usage">usage</h2>
        <p className="meta">
          run the backend, then the frontend (two separate processes). register an
          account and log in — each account gets its own clients, projects, and data.
        </p>
        <p className="meta">
          <code>cd backend; python -m uvicorn app.main:app --port 8000</code>
          <br />
          <code>cd frontend; npm run dev</code>
        </p>
        <p className="meta">
          domain data lives in <code>backend/data/knit.db</code> next to the backend
          process. the installed app shell loads offline, but it needs the local backend
          running to read and write data — <code>/api/*</code> is never cached.
        </p>
      </section>

      <hr className="rule" />
      <section aria-labelledby="about-version">
        <h2 id="about-version">version</h2>
        {backendState === "loading" ? (
          <p className="meta" role="status">
            checking local server…
          </p>
        ) : backendState === "down" ? (
          <p className="meta" role="alert">
            local server unreachable. frontend {frontendVersion}, backend unknown.
          </p>
        ) : (
          <p className="meta">
            frontend {frontendVersion}, backend {backendVersion}.
          </p>
        )}
      </section>

      <hr className="rule" />
      <section aria-labelledby="about-dev">
        <h2 id="about-dev">development</h2>
        <p className="meta">
          ports 5173 (frontend, proxies <code>/api</code> to the backend) and 8000
          (backend). environment: <code>KNIT_DATABASE_PATH</code>,{" "}
          <code>KNIT_SECRET_KEY</code>, <code>KNIT_TOKEN_DAYS</code>. tests:{" "}
          <code>cd backend; python -m pytest -q</code> and{" "}
          <code>cd frontend; npm test</code>. every schema change ships as a new
          versioned file in <code>backend/app/migrations/</code> with a matching model
          update. full notes live in <code>README.md</code>; rules in{" "}
          <code>project.md</code> and <code>agents.md</code>.
        </p>
      </section>
    </div>
  );
}
