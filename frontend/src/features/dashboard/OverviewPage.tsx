import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { EmptyState, ErrorState, Loading } from "../../components/states";
import { useAuth } from "../auth/AuthContext";

export function OverviewPage() {
  const { user } = useAuth();
  const [backend, setBackend] = useState<"loading" | "ok" | "down">("loading");

  useEffect(() => {
    api
      .health()
      .then(() => setBackend("ok"))
      .catch(() => setBackend("down"));
  }, []);

  return (
    <div>
      <h1>overview</h1>
      <p className="meta">hello, {user?.name}. calm and sparse — more signal, less software.</p>
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
          body="your clients live here now. projects arrive in phase 2."
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
