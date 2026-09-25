import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  Project,
  Task,
  TimeEntry,
  WeekSummary,
  api,
} from "../../lib/api";
import { addDays, formatDayLabel, parseISODate, toISODate, weekStart } from "../../lib/dates";
import { formatDuration, minutesToSeconds, secondsToMinutes } from "../../lib/duration";
import { EmptyState, ErrorState, Loading } from "../../components/states";

type SectionStatus = "loading" | "ready" | "error";

function mondayOfToday(): string {
  return toISODate(weekStart(new Date()));
}

function shiftWeek(iso: string, weeks: number): string {
  return toISODate(addDays(parseISODate(iso), weeks * 7));
}

function entryLabel(entry: TimeEntry): string {
  const what = entry.description || entry.task_title || "untracked work";
  return `${what} · ${formatDuration(entry.duration_seconds)} · ${entry.billable ? "billable" : "non-billable"}`;
}

export function TimesheetPage() {
  const [weekStartIso, setWeekStartIso] = useState(mondayOfToday);

  const [summaryStatus, setSummaryStatus] = useState<SectionStatus>("loading");
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [entriesStatus, setEntriesStatus] = useState<SectionStatus>("loading");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectFilter, setProjectFilter] = useState("");

  const load = (week: string) => {
    const from = week;
    const to = toISODate(addDays(parseISODate(week), 6));
    setSummaryStatus("loading");
    api
      .timesheet(week)
      .then((s) => {
        setSummary(s);
        setSummaryStatus("ready");
      })
      .catch((err: unknown) => {
        setSummaryError(err instanceof ApiError ? err.message : "couldn't load timesheet");
        setSummaryStatus("error");
      });
    setEntriesStatus("loading");
    api.timeEntries
      .listFiltered({ from, to })
      .then((list) => {
        setEntries(list);
        setEntriesStatus("ready");
      })
      .catch((err: unknown) => {
        setEntriesError(err instanceof ApiError ? err.message : "couldn't load entries");
        setEntriesStatus("error");
      });
  };

  useEffect(() => {
    api.projects
      .list(true)
      .then(setProjects)
      .catch(() => {
        /* dropdown stays empty; create form surfaces the failure on submit */
      });
    api.tasks
      .listAll()
      .then(setTasks)
      .catch(() => {
        /* task dropdown stays empty; entries still work without tasks */
      });
  }, []);

  useEffect(() => {
    load(weekStartIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartIso]);

  const refresh = () => load(weekStartIso);

  const visibleEntries = projectFilter
    ? entries.filter((e) => e.project_id === Number(projectFilter))
    : entries;

  const grouped = new Map<string, TimeEntry[]>();
  for (const entry of visibleEntries) {
    const list = grouped.get(entry.entry_date) ?? [];
    list.push(entry);
    grouped.set(entry.entry_date, list);
  }
  const groupDates = [...grouped.keys()].sort();

  return (
    <div>
      <h1>timesheet</h1>
      <p className="meta">week of {weekStartIso} (monday–sunday).</p>
      <div role="group" aria-label="week navigation">
        <button type="button" className="secondary" onClick={() => setWeekStartIso((w) => shiftWeek(w, -1))}>
          previous week
        </button>{" "}
        <button type="button" className="secondary" onClick={() => setWeekStartIso(mondayOfToday())}>
          this week
        </button>{" "}
        <button type="button" className="secondary" onClick={() => setWeekStartIso((w) => shiftWeek(w, 1))}>
          next week
        </button>
      </div>
      <hr className="rule" />

      <section aria-labelledby="week-summary">
        <h2 id="week-summary">week summary</h2>
        {summaryStatus === "loading" ? (
          <Loading label="loading week" />
        ) : summaryStatus === "error" || !summary ? (
          <ErrorState
            message={summaryError ?? "couldn't load timesheet"}
            onRetry={refresh}
          />
        ) : (
          <>
            <ul>
              {summary.days.map((day) => (
                <li key={day.date}>
                  {formatDayLabel(day.date)} — {formatDuration(day.total_seconds)}
                </li>
              ))}
            </ul>
            <p className="meta">week total {formatDuration(summary.week_total_seconds)}</p>
            <p className="meta">billable {formatDuration(summary.week_billable_seconds)}</p>
            <p className="meta">non-billable {formatDuration(summary.week_non_billable_seconds)}</p>
            {summary.by_project.length > 0 ? (
              <>
                <h3>by project</h3>
                <ul>
                  {summary.by_project.map((row) => (
                    <li key={row.project_id}>
                      <Link to={`/projects/${row.project_id}`}>{row.project_name}</Link>
                      {" — "}
                      {formatDuration(row.total_seconds)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </section>

      <hr className="rule" />
      <section aria-labelledby="week-entries">
        <h2 id="week-entries">entries</h2>
        <div className="field">
          <label htmlFor="timesheet-filter-project">filter by project (optional)</label>
          <select
            id="timesheet-filter-project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">all projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {entriesStatus === "loading" ? (
          <Loading label="loading entries" />
        ) : entriesStatus === "error" ? (
          <ErrorState message={entriesError ?? "couldn't load entries"} onRetry={refresh} />
        ) : visibleEntries.length === 0 ? (
          <EmptyState title="no time logged" body="no time logged this week. log time below." />
        ) : (
          <EntriesList entries={groupDates.map((date) => [date, grouped.get(date)!] as const)} onChanged={refresh} tasks={tasks} />
        )}
      </section>

      <hr className="rule" />
      <section aria-labelledby="log-time">
        <h2 id="log-time">log time</h2>
        <EntryCreateForm projects={projects} tasks={tasks} onCreated={refresh} />
      </section>
    </div>
  );
}

function EntriesList({
  entries,
  tasks,
  onChanged,
}: {
  entries: readonly (readonly [string, TimeEntry[]])[];
  tasks: Task[];
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const remove = async (id: number) => {
    setBusy(id, true);
    setActionError(null);
    try {
      await api.timeEntries.remove(id);
      setConfirmingDelete(null);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "couldn't delete entry");
    } finally {
      setBusy(id, false);
    }
  };

  return (
    <div>
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {entries.map(([date, dayEntries]) => {
        const dayTotal = dayEntries.reduce((sum, e) => sum + e.duration_seconds, 0);
        return (
          <section key={date} aria-labelledby={`day-${date}`}>
            <h3 id={`day-${date}`}>
              {formatDayLabel(date)} — {formatDuration(dayTotal)}
            </h3>
            <ul>
              {dayEntries.map((entry) => {
                const busy = busyIds.has(entry.id);
                if (editingId === entry.id) {
                  return (
                    <li key={entry.id}>
                      <EntryEditor
                        entry={entry}
                        tasks={tasks.filter((t) => t.project_id === entry.project_id)}
                        onCancel={() => setEditingId(null)}
                        onSaved={() => {
                          setEditingId(null);
                          onChanged();
                        }}
                      />
                    </li>
                  );
                }
                return (
                  <li key={entry.id}>
                    <Link to={`/projects/${entry.project_id}`}>{entry.project_name}</Link>
                    {" — "}
                    {entryLabel(entry)}
                    <br />
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => setEditingId(entry.id)}
                    >
                      edit
                    </button>{" "}
                    {confirmingDelete === entry.id ? (
                      <span>
                        <span className="meta">delete this entry? cannot be undone. </span>
                        <button type="button" disabled={busy} onClick={() => remove(entry.id)}>
                          {busy ? "deleting…" : "yes, delete"}
                        </button>{" "}
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => setConfirmingDelete(null)}
                        >
                          keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setConfirmingDelete(entry.id)}
                      >
                        delete
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EntryCreateForm({
  projects,
  tasks,
  onCreated,
}: {
  projects: Project[];
  tasks: Task[];
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [entryDate, setEntryDate] = useState(() => toISODate(new Date()));
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ project?: string; minutes?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const projectTasks = projectId ? tasks.filter((t) => t.project_id === Number(projectId)) : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { project?: string; minutes?: string } = {
      project: projectId ? undefined : "choose a project",
    };
    let seconds: number | null = null;
    if (!minutes.trim()) {
      errors.minutes = "enter minutes greater than 0";
    } else {
      seconds = minutesToSeconds(minutes);
      if (seconds === null || seconds <= 0) errors.minutes = "enter minutes greater than 0";
    }
    setFieldErrors(errors);
    if (errors.project || errors.minutes) return; // preserve input on error
    setCreating(true);
    setFormError(null);
    try {
      await api.timeEntries.create(Number(projectId), {
        task_id: taskId ? Number(taskId) : null,
        entry_date: entryDate,
        duration_seconds: seconds!,
        description: description.trim() || null,
        billable,
      });
      setProjectId("");
      setTaskId("");
      setEntryDate(toISODate(new Date()));
      setMinutes("");
      setDescription("");
      setBillable(true);
      setFieldErrors({});
      onCreated();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't log time");
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="log-project">project</label>
        <select
          id="log-project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTaskId("");
          }}
          aria-invalid={Boolean(fieldErrors.project)}
        >
          <option value="">choose a project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {fieldErrors.project ? <p className="field-error">{fieldErrors.project}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="log-task">task (optional)</label>
        <select id="log-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">no task</option>
          {projectTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="log-date">date</label>
        <input
          id="log-date"
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="log-minutes">minutes</label>
        <input
          id="log-minutes"
          type="number"
          min={1}
          step={1}
          placeholder="60"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          aria-invalid={Boolean(fieldErrors.minutes)}
        />
        {fieldErrors.minutes ? <p className="field-error">{fieldErrors.minutes}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="log-description">description (optional)</label>
        <input
          id="log-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="log-billable">billable</label>
        <input
          id="log-billable"
          type="checkbox"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
        />
      </div>
      <button type="submit" disabled={creating}>
        {creating ? "logging…" : "log time"}
      </button>
    </form>
  );
}

function EntryEditor({
  entry,
  tasks,
  onCancel,
  onSaved,
}: {
  entry: TimeEntry;
  tasks: Task[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [taskId, setTaskId] = useState(entry.task_id !== null ? String(entry.task_id) : "");
  const [entryDate, setEntryDate] = useState(entry.entry_date);
  const [minutes, setMinutes] = useState(String(secondsToMinutes(entry.duration_seconds)));
  const [description, setDescription] = useState(entry.description ?? "");
  const [billable, setBillable] = useState(entry.billable);
  const [fieldErrors, setFieldErrors] = useState<{ minutes?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const prefix = `entry-edit-${entry.id}`;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { minutes?: string } = {};
    let seconds: number | null = null;
    if (!minutes.trim()) {
      errors.minutes = "enter minutes greater than 0";
    } else {
      seconds = minutesToSeconds(minutes);
      if (seconds === null || seconds <= 0) errors.minutes = "enter minutes greater than 0";
    }
    setFieldErrors(errors);
    if (errors.minutes) return; // preserve input on error
    setSaving(true);
    setSaveError(null);
    try {
      await api.timeEntries.update(entry.id, {
        task_id: taskId ? Number(taskId) : null,
        entry_date: entryDate,
        duration_seconds: seconds!,
        description: description.trim() || null,
        billable,
      });
      onSaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "couldn't save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      {saveError ? (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      ) : null}
      <p className="meta">{entry.project_name}</p>
      <div className="field">
        <label htmlFor={`${prefix}-task`}>task (optional)</label>
        <select id={`${prefix}-task`} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">no task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-date`}>date</label>
        <input
          id={`${prefix}-date`}
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-minutes`}>minutes</label>
        <input
          id={`${prefix}-minutes`}
          type="number"
          min={1}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          aria-invalid={Boolean(fieldErrors.minutes)}
        />
        {fieldErrors.minutes ? <p className="field-error">{fieldErrors.minutes}</p> : null}
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-description`}>description (optional)</label>
        <input
          id={`${prefix}-description`}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-billable`}>billable</label>
        <input
          id={`${prefix}-billable`}
          type="checkbox"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
        />
      </div>
      <button type="submit" disabled={saving}>
        {saving ? "saving…" : "save entry"}
      </button>{" "}
      <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
        cancel
      </button>
    </form>
  );
}
