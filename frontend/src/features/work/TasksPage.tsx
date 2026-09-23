import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, Task, TaskStatus, api } from "../../lib/api";
import { formatDuration } from "../../lib/duration";
import { EmptyState, ErrorState, Loading } from "../../components/states";

type Status = "loading" | "ready" | "error";
type View = "list" | "kanban";

const COLUMNS: { status: TaskStatus; heading: string }[] = [
  { status: "todo", heading: "to do" },
  { status: "in_progress", heading: "in progress" },
  { status: "done", heading: "done" },
];

function statusLabel(status: TaskStatus): string {
  return status === "todo" ? "to do" : status === "in_progress" ? "in progress" : "done";
}

/** Buttons that move a task between statuses. Text-only, keyboard accessible. */
function StatusMoves({
  task,
  busy,
  onMove,
}: {
  task: Task;
  busy: boolean;
  onMove: (task: Task, next: TaskStatus) => void;
}) {
  return (
    <span>
      {task.status === "todo" ? (
        <button type="button" className="secondary" disabled={busy} onClick={() => onMove(task, "in_progress")}>
          {busy ? "moving…" : "start"}
        </button>
      ) : null}
      {task.status === "in_progress" ? (
        <>
          <button type="button" className="secondary" disabled={busy} onClick={() => onMove(task, "todo")}>
            {busy ? "moving…" : "move back to to do"}
          </button>{" "}
          <button type="button" className="secondary" disabled={busy} onClick={() => onMove(task, "done")}>
            {busy ? "moving…" : "mark done"}
          </button>
        </>
      ) : null}
      {task.status === "done" ? (
        <button type="button" className="secondary" disabled={busy} onClick={() => onMove(task, "in_progress")}>
          {busy ? "moving…" : "reopen"}
        </button>
      ) : null}
    </span>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const parts: string[] = [`status ${statusLabel(task.status)}`, `priority ${task.priority}`];
  if (task.due_date) parts.push(`due ${task.due_date}`);
  else parts.push("no due date");
  parts.push(
    task.estimated_duration_seconds !== null
      ? `estimate ${formatDuration(task.estimated_duration_seconds)}`
      : "no estimate",
  );
  return (
    <span className="meta">
      {" — "}
      <Link to={`/projects/${task.project_id}`}>{task.project_name}</Link>
      {task.milestone_name ? ` · ${task.milestone_name}` : " · no milestone"}
      {` · ${parts.join(" · ")}`}
    </span>
  );
}

export function TasksPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [moveError, setMoveError] = useState<string | null>(null);

  const load = () => {
    setStatus("loading");
    api.tasks
      .listAll()
      .then((list) => {
        setTasks(list);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "couldn't load tasks");
        setStatus("error");
      });
  };

  useEffect(load, []);

  const move = async (task: Task, next: TaskStatus) => {
    setBusyIds((prev) => new Set(prev).add(task.id));
    setMoveError(null);
    try {
      const updated = await api.tasks.update(task.id, { status: next });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setMoveError(err instanceof ApiError ? err.message : "couldn't move task");
    } finally {
      setBusyIds((prev) => {
        const next_set = new Set(prev);
        next_set.delete(task.id);
        return next_set;
      });
    }
  };

  return (
    <div>
      <h1>tasks</h1>
      <p className="meta">everything to do, across all projects.</p>
      <hr className="rule" />

      {moveError ? (
        <p className="form-error" role="alert">
          {moveError}
        </p>
      ) : null}

      {status === "loading" ? (
        <Loading label="loading tasks" />
      ) : status === "error" ? (
        <ErrorState message={loadError ?? "couldn't load tasks"} onRetry={load} />
      ) : tasks.length === 0 ? (
        <EmptyState title="no tasks yet" body="no tasks yet. create one from a project." />
      ) : (
        <>
          <div role="group" aria-label="task view">
            <button
              type="button"
              className={view === "list" ? undefined : "secondary"}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              list
            </button>{" "}
            <button
              type="button"
              className={view === "kanban" ? undefined : "secondary"}
              onClick={() => setView("kanban")}
              aria-pressed={view === "kanban"}
            >
              kanban
            </button>
          </div>
          <hr className="rule" />
          {view === "list" ? (
            <ul>
              {tasks.map((task) => (
                <li key={task.id}>
                  {task.title}
                  <TaskMeta task={task} />
                  <br />
                  <StatusMoves task={task} busy={busyIds.has(task.id)} onMove={move} />
                </li>
              ))}
            </ul>
          ) : (
            <>
              {COLUMNS.map(({ status: column, heading }) => (
                <section key={column} aria-labelledby={`kanban-${column}`}>
                  <h2 id={`kanban-${column}`}>{heading}</h2>
                  {tasks.filter((t) => t.status === column).length === 0 ? (
                    <p className="meta">nothing here.</p>
                  ) : (
                    <ul>
                      {tasks
                        .filter((t) => t.status === column)
                        .map((task) => (
                          <li key={task.id}>
                            {task.title}
                            <TaskMeta task={task} />
                            <br />
                            <StatusMoves task={task} busy={busyIds.has(task.id)} onMove={move} />
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
