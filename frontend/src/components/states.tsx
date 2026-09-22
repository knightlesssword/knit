import { ReactNode } from "react";

export function Loading({ label = "loading" }: { label?: string }) {
  return (
    <p className="state meta" role="status">
      {label}…
    </p>
  );
}

export function EmptyState({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <section className="state" aria-label={title}>
      <h2>{title}</h2>
      {body ? <p className="meta">{body}</p> : null}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="state" role="alert">
      <h2>something went wrong</h2>
      <p className="meta">{message}</p>
      {onRetry ? (
        <button type="button" className="secondary" onClick={onRetry}>
          try again
        </button>
      ) : null}
    </section>
  );
}

export function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return <p className="meta">no progress</p>;
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="progress"
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
