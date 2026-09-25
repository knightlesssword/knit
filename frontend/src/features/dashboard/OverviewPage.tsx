import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toISODate, weekStart } from "../../lib/dates";
import { formatDuration } from "../../lib/duration";
import { EmptyState, ErrorState, Loading } from "../../components/states";
import { useAuth } from "../auth/AuthContext";

export function OverviewPage() {
  const { user } = useAuth();
  const [backend, setBackend] = useState<"loading" | "ok" | "down">("loading");
  const [week, setWeek] = useState<"loading" | "ready" | "error">("loading");
  const [weekTotal, setWeekTotal] = useState(0);
  const [weekError, setWeekError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(() => setBackend("ok"))
      .catch(() => setBackend("down"));
  }, []);

  useEffect(() => {
    api
      .timesheet(toISODate(weekStart(new Date())))
      .then((summary) => {
        setWeekTotal(summary.week_total_seconds);
        setWeek("ready");
      })
      .catch(() => {
        setWeekError("couldn't load this week's time");
        setWeek("error");
      });
  }, []);

  return (
    <div>
      <h1>overview</h1>
      <p className="meta">hello, {user?.name}. calm and sparse — more signal, less software.</p>
      {week === "loading" ? (
        <p className="meta">loading this week's time…</p>
      ) : week === "error" ? (
        <p className="meta">this week: {weekError}</p>
      ) : (
        <p className="meta">this week: {formatDuration(weekTotal)}</p>
      )}
      <hr className="rule" />
      {backend === "loading" ? (
        <Loading label="checking local server" />
      ) : backend === "down" ? (
        <ErrorState
          message="the local server isn't answering. start it with: uvicorn app.main:app --app-dir backend"
          onRetry={() => window.location.reload()}
        />
      ) : (
        <EmptyState
          title="nothing here yet"
          body="your clients and projects live here now."
        />
      )}
    </div>
  );
}

export function PhasePlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <EmptyState title="not built yet" body={`${title} arrive in ${phase}.`} />
    </div>
  );
}
