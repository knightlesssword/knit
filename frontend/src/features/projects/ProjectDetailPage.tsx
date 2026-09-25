import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  Milestone,
  Project,
  ProjectCurrency,
  ProjectStatus,
  ProjectType,
  Task,
  TaskPriority,
  TaskStatus,
  TimeEntry,
  api,
} from "../../lib/api";
import {
  formatDuration,
  minutesInputToSeconds,
  secondsToMinutes,
  secondsToMinutesInput,
} from "../../lib/duration";
import { toISODate, weekStart } from "../../lib/dates";
import { formatMoney, majorToMinor, minorToMajor } from "../../lib/money";
import { validateName } from "../../lib/validation";
import { EmptyState, ErrorState, Loading, ProgressBar } from "../../components/states";

type Status = "loading" | "ready" | "missing" | "error";
type WorkStatus = "loading" | "ready" | "error";

function moneySummary(project: Project): string {
  if (project.project_type === "fixed_price") {
    return project.fixed_price !== null
      ? `fixed price ${formatMoney(project.fixed_price, project.currency)}`
      : "no fixed price set";
  }
  if (project.project_type === "hourly") {
    return project.hourly_rate !== null
      ? `rate ${formatMoney(project.hourly_rate, project.currency)} per hour`
      : "no hourly rate set";
  }
  return project.recurring_amount !== null
    ? `recurring ${formatMoney(project.recurring_amount, project.currency)}`
    : "no recurring amount set";
}

/** This week's tracked time for one hourly project, from the timesheet summary. */
function HourlyWeekLine({ projectId }: { projectId: number }) {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .timesheet(toISODate(weekStart(new Date())))
      .then((summary) => {
        setTotal(summary.by_project.find((row) => row.project_id === projectId)?.total_seconds ?? 0);
      })
      .catch(() => setFailed(true));
  }, [projectId]);

  if (failed) {
    return (
      <p className="meta">
        <Link to="/timesheet">open timesheet</Link> for this week's tracked time.
      </p>
    );
  }
  if (total === null) return <p className="meta">loading this week's time…</p>;
  return (
    <p className="meta">
      tracked this week {formatDuration(total)} · <Link to="/timesheet">open timesheet</Link>
    </p>
  );
}

function taskStatusLabel(status: TaskStatus): string {
  return status === "todo" ? "to do" : status === "in_progress" ? "in progress" : "done";
}

function advanceLabel(status: TaskStatus): string | null {
  if (status === "todo") return "start";
  if (status === "in_progress") return "mark done";
  return null;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [status, setStatus] = useState<Status>("loading");
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [workStatus, setWorkStatus] = useState<WorkStatus>("loading");
  const [workError, setWorkError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("fixed_price");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("active");
  const [currency, setCurrency] = useState<ProjectCurrency>("USD");
  const [money, setMoney] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [recurringBillingPeriod, setRecurringBillingPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; money?: string; budget?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [acting, setActing] = useState(false);

  const load = () => {
    if (!Number.isInteger(projectId)) {
      setStatus("missing");
      return;
    }
    setStatus("loading");
    api.projects
      .get(projectId)
      .then((p) => {
        setProject(p);
        setName(p.name);
        setProjectType(p.project_type);
        setProjectStatus(p.status);
        setCurrency(p.currency);
        const current =
          p.project_type === "fixed_price"
            ? p.fixed_price
            : p.project_type === "hourly"
              ? p.hourly_rate
              : p.recurring_amount;
        setMoney(current !== null ? minorToMajor(current) : "");
        setBudget(p.budget !== null ? minorToMajor(p.budget) : "");
        setNotes(p.notes ?? "");
        setRecurringBillingPeriod(p.recurring_billing_period ?? "");
        setStartDate(p.start_date ?? "");
        setDueDate(p.due_date ?? "");
        setDescription(p.description ?? "");
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) setStatus("missing");
        else {
          setLoadError(err instanceof ApiError ? err.message : "couldn't load project");
          setStatus("error");
        }
      });
  };

  const loadWork = () => {
    if (!Number.isInteger(projectId)) return;
    setWorkStatus("loading");
    Promise.all([api.milestones.list(projectId), api.tasks.listByProject(projectId)])
      .then(([milestoneList, taskList]) => {
        setMilestones(milestoneList);
        setTasks(taskList);
        setWorkStatus("ready");
      })
      .catch((err: unknown) => {
        setWorkError(err instanceof ApiError ? err.message : "couldn't load work");
        setWorkStatus("error");
      });
  };

  const refreshProject = () => {
    api.projects
      .get(projectId)
      .then(setProject)
      .catch(() => {
        /* progress refresh is best-effort; work lists already updated */
      });
  };

  const refreshWork = () => {
    loadWork();
    refreshProject();
  };

  useEffect(load, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadWork, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; money?: string; budget?: string } = {
      name: validateName(name) ?? undefined,
    };
    let minor: number | null = null;
    if (money.trim()) {
      minor = majorToMinor(money);
      if (minor === null) errors.money = "enter an amount like 42.50";
    }
    let budgetMinor: number | null = null;
    if (budget.trim()) {
      budgetMinor = majorToMinor(budget);
      if (budgetMinor === null) errors.budget = "enter an amount like 42.50";
    }
    setFieldErrors(errors);
    if (errors.name || errors.money || errors.budget) return; // preserve input on error
    setSaving(true);
    setFormError(null);
    try {
      const amountFields =
        projectType === "fixed_price"
          ? { fixed_price: minor, hourly_rate: null, recurring_amount: null }
          : projectType === "hourly"
            ? { fixed_price: null, hourly_rate: minor, recurring_amount: null }
            : { fixed_price: null, hourly_rate: null, recurring_amount: minor };
      const updated = await api.projects.update(projectId, {
        name: name.trim(),
        project_type: projectType,
        status: projectStatus,
        currency,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        budget: budgetMinor,
        recurring_billing_period:
          projectType === "retainer" ? recurringBillingPeriod.trim() || null : null,
        ...amountFields,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
      });
      setProject(updated);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!project) return;
    setActing(true);
    try {
      const updated = project.archived_at
        ? await api.projects.unarchive(projectId)
        : await api.projects.archive(projectId);
      setProject(updated);
      setConfirmingArchive(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't update archive state");
    } finally {
      setActing(false);
    }
  };

  const remove = async () => {
    setActing(true);
    try {
      await api.projects.remove(projectId);
      navigate("/projects");
    } catch (err) {
      setActing(false);
      setConfirmingDelete(false);
      setFormError(err instanceof ApiError ? err.message : "couldn't delete project");
    }
  };

  if (status === "loading") return <Loading label="loading project" />;
  if (status === "missing")
    return <EmptyState title="project not found" body="it may have been deleted." />;
  if (status === "error")
    return <ErrorState message={loadError ?? "couldn't load project"} onRetry={load} />;
  if (!project) return <Loading label="loading project" />;

  const progress = project.progress;

  return (
    <div>
      <h1>{project.name}</h1>
      <p className="meta">
        <Link to={`/clients/${project.client_id}`}>{project.client_name}</Link>
        {" · "}
        {project.status.replace("_", " ")}
        {project.due_date ? ` · due ${project.due_date}` : " · no deadline"}
      </p>
      <hr className="rule" />

      <section aria-labelledby="progress">
        <h2 id="progress">progress</h2>
        {progress === null ? (
          <ProgressBar value={null} />
        ) : (
          <>
            <ProgressBar
              value={progress.total > 0 ? progress.done / progress.total : null}
            />
            <p className="meta">
              {progress.done} done / {progress.total - progress.done} remaining
            </p>
          </>
        )}
      </section>

      <hr className="rule" />
      <section aria-labelledby="money">
        <h2 id="money">money</h2>
        <p className="meta">{moneySummary(project)}</p>
        {project.project_type === "hourly" ? <HourlyWeekLine projectId={project.id} /> : null}
      </section>

      <hr className="rule" />
      {workStatus === "loading" ? (
        <Loading label="loading work" />
      ) : workStatus === "error" ? (
        <ErrorState message={workError ?? "couldn't load work"} onRetry={loadWork} />
      ) : (
        <>
          <MilestonesSection
            projectId={projectId}
            milestones={milestones}
            onChanged={refreshWork}
          />
          <hr className="rule" />
          <TasksSection
            projectId={projectId}
            milestones={milestones}
            tasks={tasks}
            onChanged={refreshWork}
          />
        </>
      )}

      <hr className="rule" />
      <section aria-labelledby="edit-project">
        <h2 id="edit-project">details</h2>
        <form onSubmit={save} noValidate>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="detail-project-name">name</label>
            <input
              id="detail-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="detail-project-type">type</label>
            <select
              id="detail-project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
            >
              <option value="fixed_price">fixed price</option>
              <option value="hourly">hourly</option>
              <option value="retainer">retainer</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="detail-project-status">status</label>
            <select
              id="detail-project-status"
              value={projectStatus}
              onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
            >
              <option value="active">active</option>
              <option value="on_hold">on hold</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="detail-project-currency">currency</label>
            <select
              id="detail-project-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as ProjectCurrency)}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="detail-project-amount">amount (optional)</label>
            <input
              id="detail-project-amount"
              type="text"
              inputMode="decimal"
              placeholder="42.50"
              value={money}
              onChange={(e) => setMoney(e.target.value)}
              aria-invalid={Boolean(fieldErrors.money)}
            />
            {fieldErrors.money ? <p className="field-error">{fieldErrors.money}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="detail-project-budget">budget (optional)</label>
            <input
              id="detail-project-budget"
              type="text"
              inputMode="decimal"
              placeholder="42.50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              aria-invalid={Boolean(fieldErrors.budget)}
            />
            {fieldErrors.budget ? <p className="field-error">{fieldErrors.budget}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="detail-project-period">recurring billing period (optional)</label>
            <input
              id="detail-project-period"
              type="text"
              placeholder="monthly"
              value={recurringBillingPeriod}
              onChange={(e) => setRecurringBillingPeriod(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="detail-project-start">start date (optional)</label>
            <input
              id="detail-project-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="detail-project-due">due date (optional)</label>
            <input
              id="detail-project-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="detail-project-desc">description (optional)</label>
            <input
              id="detail-project-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="detail-project-notes">notes (optional)</label>
            <input
              id="detail-project-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button type="submit" disabled={saving}>
            {saving ? "saving…" : "save changes"}
          </button>
        </form>
      </section>

      <hr className="rule" />
      <section aria-labelledby="archive-project">
        <h2 id="archive-project">{project.archived_at ? "unarchive" : "archive"}</h2>
        {!confirmingArchive ? (
          <button
            type="button"
            className="secondary"
            onClick={() => setConfirmingArchive(true)}
          >
            {project.archived_at ? "unarchive project" : "archive project"}
          </button>
        ) : (
          <div>
            <p className="meta">
              {project.archived_at
                ? `unarchive “${project.name}”? it will return to active projects.`
                : `archive “${project.name}”? it will disappear from active projects but remain accessible with its tasks, time and invoices.`}
            </p>
            <button type="button" onClick={toggleArchive} disabled={acting}>
              {acting ? "working…" : project.archived_at ? "yes, unarchive" : "yes, archive"}
            </button>{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmingArchive(false)}
              disabled={acting}
            >
              keep as is
            </button>
          </div>
        )}
      </section>

      <hr className="rule" />
      <section aria-labelledby="delete-project">
        <h2 id="delete-project">delete</h2>
        {!confirmingDelete ? (
          <button type="button" className="secondary" onClick={() => setConfirmingDelete(true)}>
            delete project
          </button>
        ) : (
          <div>
            <p className="meta">
              delete “{project.name}”? this permanently removes the project with its
              tasks and logged time, and cannot be undone. to keep that history
              accessible, archive instead.
            </p>
            <button type="button" onClick={remove} disabled={acting}>
              {acting ? "deleting…" : "yes, delete"}
            </button>{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={acting}
            >
              keep project
            </button>
          </div>
        )}
      </section>

      <hr className="rule" />
      <TimeSection projectId={projectId} />
      <hr className="rule" />
      <EmptyState title="files" body="project files arrive in a later phase." />
    </div>
  );
}

function MilestonesSection({
  projectId,
  milestones,
  onChanged,
}: {
  projectId: number;
  milestones: Milestone[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const error = validateName(name);
    setNameError(error);
    if (error) return; // preserve input on error
    setCreating(true);
    setFormError(null);
    try {
      await api.milestones.create(projectId, {
        name: name.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      });
      setName("");
      setDescription("");
      setDueDate("");
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't create milestone");
    } finally {
      setCreating(false);
    }
  };

  const toggleComplete = async (milestone: Milestone) => {
    setBusy(milestone.id, true);
    setFormError(null);
    try {
      await api.milestones.update(milestone.id, {
        status: milestone.status === "completed" ? "open" : "completed",
      });
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't update milestone");
    } finally {
      setBusy(milestone.id, false);
    }
  };

  const remove = async (id: number) => {
    setBusy(id, true);
    try {
      await api.milestones.remove(id);
      setConfirmingDelete(null);
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't delete milestone");
    } finally {
      setBusy(id, false);
    }
  };

  return (
    <section aria-labelledby="milestones">
      <h2 id="milestones">milestones</h2>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {milestones.length === 0 ? (
        <p className="meta">no milestones yet.</p>
      ) : (
        <ul>
          {milestones.map((m) => {
            const remaining = m.task_total - m.task_done;
            const busy = busyIds.has(m.id);
            return (
              <li key={m.id}>
                {m.name}
                <span className="meta">
                  {" — "}
                  {m.status === "completed" ? "completed" : "open"}
                  {m.due_date ? ` · due ${m.due_date}` : " · no due date"}
                  {` · ${m.task_done} done / ${remaining} remaining`}
                </span>
                <br />
                <ProgressBar value={m.task_total > 0 ? m.task_done / m.task_total : null} />
                {m.description ? <p className="meta">{m.description}</p> : null}
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => toggleComplete(m)}
                >
                  {busy
                    ? "working…"
                    : m.status === "completed"
                      ? "reopen"
                      : "mark complete"}
                </button>{" "}
                {confirmingDelete === m.id ? (
                  <span>
                    <span className="meta">delete “{m.name}”? its tasks are kept. </span>
                    <button type="button" disabled={busy} onClick={() => remove(m.id)}>
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
                    onClick={() => setConfirmingDelete(m.id)}
                  >
                    delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <h3>new milestone</h3>
      <form onSubmit={create} noValidate>
        <div className="field">
          <label htmlFor="milestone-name">name</label>
          <input
            id="milestone-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(nameError)}
          />
          {nameError ? <p className="field-error">{nameError}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="milestone-description">description (optional)</label>
          <input
            id="milestone-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="milestone-due">due date (optional)</label>
          <input
            id="milestone-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <button type="submit" disabled={creating}>
          {creating ? "creating…" : "create milestone"}
        </button>
      </form>
    </section>
  );
}

function TasksSection({
  projectId,
  milestones,
  tasks,
  onChanged,
}: {
  projectId: number;
  milestones: Milestone[];
  tasks: Task[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; estimate?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const milestoneName = (task: Task): string => {
    const found = milestones.find((m) => m.id === task.milestone_id);
    return found ? found.name : (task.milestone_name ?? "no milestone");
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; estimate?: string } = {
      title: validateName(title) ?? undefined,
    };
    let estimate: number | null = null;
    if (estimateMinutes.trim()) {
      estimate = minutesInputToSeconds(estimateMinutes);
      if (estimate === null || estimate <= 0)
        errors.estimate = "enter minutes greater than 0";
    }
    setFieldErrors(errors);
    if (errors.title || errors.estimate) return; // preserve input on error
    setCreating(true);
    setFormError(null);
    try {
      await api.tasks.create(projectId, {
        title: title.trim(),
        description: description.trim() || null,
        milestone_id: milestoneId ? Number(milestoneId) : null,
        priority,
        due_date: dueDate || null,
        estimated_duration_seconds: estimate,
      });
      setTitle("");
      setDescription("");
      setMilestoneId("");
      setPriority("medium");
      setDueDate("");
      setEstimateMinutes("");
      setFieldErrors({});
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't create task");
    } finally {
      setCreating(false);
    }
  };

  const move = async (task: Task, next: TaskStatus) => {
    setBusy(task.id, true);
    setFormError(null);
    try {
      await api.tasks.update(task.id, { status: next });
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't move task");
    } finally {
      setBusy(task.id, false);
    }
  };

  const remove = async (id: number) => {
    setBusy(id, true);
    try {
      await api.tasks.remove(id);
      setConfirmingDelete(null);
      onChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't delete task");
    } finally {
      setBusy(id, false);
    }
  };

  return (
    <section aria-labelledby="tasks">
      <h2 id="tasks">tasks</h2>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {tasks.length === 0 ? (
        <p className="meta">no tasks yet.</p>
      ) : (
        <ul>
          {tasks.map((task) => {
            const busy = busyIds.has(task.id);
            const next = advanceLabel(task.status);
            if (editingId === task.id) {
              return (
                <li key={task.id}>
                  <TaskEditor
                    task={task}
                    milestones={milestones}
                    busy={busy}
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
              <li key={task.id}>
                {task.title}
                <span className="meta">
                  {" — "}
                  {`status ${taskStatusLabel(task.status)}`}
                  {` · priority ${task.priority}`}
                  {` · ${milestoneName(task)}`}
                  {task.due_date ? ` · due ${task.due_date}` : " · no due date"}
                  {task.estimated_duration_seconds !== null
                    ? ` · estimate ${formatDuration(task.estimated_duration_seconds)}`
                    : " · no estimate"}
                </span>
                {task.description ? <p className="meta">{task.description}</p> : null}
                <br />
                {task.status === "in_progress" ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => move(task, "todo")}
                  >
                    {busy ? "moving…" : "move back to to do"}
                  </button>
                ) : null}{" "}
                {next ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      move(task, task.status === "todo" ? "in_progress" : "done")
                    }
                  >
                    {busy ? "moving…" : next}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => move(task, "in_progress")}
                  >
                    {busy ? "moving…" : "reopen"}
                  </button>
                )}{" "}
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditingId(task.id)}
                >
                  edit
                </button>{" "}
                {confirmingDelete === task.id ? (
                  <span>
                    <span className="meta">
                      delete “{task.title}”? logged time on this task must be deleted
                      first, otherwise deletion is blocked. cannot be undone.{" "}
                    </span>
                    <button type="button" disabled={busy} onClick={() => remove(task.id)}>
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
                    onClick={() => setConfirmingDelete(task.id)}
                  >
                    delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <h3>new task</h3>
      <form onSubmit={create} noValidate>
        <div className="field">
          <label htmlFor="task-title">title</label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
          />
          {fieldErrors.title ? <p className="field-error">{fieldErrors.title}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="task-description">description (optional)</label>
          <input
            id="task-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="task-milestone">milestone (optional)</label>
          <select
            id="task-milestone"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
          >
            <option value="">no milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="task-priority">priority</label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="task-due">due date (optional)</label>
          <input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="task-estimate">estimate in minutes (optional)</label>
          <input
            id="task-estimate"
            type="number"
            min={0}
            step="any"
            placeholder="90"
            value={estimateMinutes}
            onChange={(e) => setEstimateMinutes(e.target.value)}
            aria-invalid={Boolean(fieldErrors.estimate)}
          />
          {fieldErrors.estimate ? (
            <p className="field-error">{fieldErrors.estimate}</p>
          ) : null}
        </div>
        <button type="submit" disabled={creating}>
          {creating ? "creating…" : "create task"}
        </button>
      </form>
    </section>
  );
}

function TaskEditor({
  task,
  milestones,
  busy,
  onCancel,
  onSaved,
}: {
  task: Task;
  milestones: Milestone[];
  busy: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [milestoneId, setMilestoneId] = useState(
    task.milestone_id !== null ? String(task.milestone_id) : "",
  );
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(() =>
    task.estimated_duration_seconds !== null
      ? (secondsToMinutesInput(task.estimated_duration_seconds) ??
        String(secondsToMinutes(task.estimated_duration_seconds)))
      : "",
  );
  const estimateRoundsDown =
    task.estimated_duration_seconds !== null &&
    secondsToMinutesInput(task.estimated_duration_seconds) === null;
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; estimate?: string }>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; estimate?: string } = {
      title: validateName(title) ?? undefined,
    };
    let estimate: number | null = null;
    if (estimateMinutes.trim()) {
      estimate = minutesInputToSeconds(estimateMinutes);
      if (estimate === null || estimate <= 0)
        errors.estimate = "enter minutes greater than 0";
    }
    setFieldErrors(errors);
    if (errors.title || errors.estimate) return; // preserve input on error
    setSaving(true);
    setSaveError(null);
    try {
      await api.tasks.update(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        milestone_id: milestoneId ? Number(milestoneId) : null,
        priority,
        due_date: dueDate || null,
        estimated_duration_seconds: estimate,
      });
      onSaved();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "couldn't save task");
    } finally {
      setSaving(false);
    }
  };

  const prefix = `task-edit-${task.id}`;

  return (
    <form onSubmit={save} noValidate>
      {saveError ? (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor={`${prefix}-title`}>title</label>
        <input
          id={`${prefix}-title`}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(fieldErrors.title)}
        />
        {fieldErrors.title ? <p className="field-error">{fieldErrors.title}</p> : null}
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-desc`}>description (optional)</label>
        <input
          id={`${prefix}-desc`}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-milestone`}>milestone (optional)</label>
        <select
          id={`${prefix}-milestone`}
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
        >
          <option value="">no milestone</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-priority`}>priority</label>
        <select
          id={`${prefix}-priority`}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-due`}>due date (optional)</label>
        <input
          id={`${prefix}-due`}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-estimate`}>estimate in minutes (optional)</label>
        <input
          id={`${prefix}-estimate`}
          type="number"
          min={0}
          step="any"
          value={estimateMinutes}
          onChange={(e) => setEstimateMinutes(e.target.value)}
          aria-invalid={Boolean(fieldErrors.estimate)}
        />
        {fieldErrors.estimate ? (
          <p className="field-error">{fieldErrors.estimate}</p>
        ) : null}
        {!fieldErrors.estimate && estimateRoundsDown ? (
          <p className="meta">
            this estimate has extra seconds — saving rounds down to whole minutes.
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={saving || busy}>
        {saving ? "saving…" : "save task"}
      </button>{" "}
      <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
        cancel
      </button>
    </form>
  );
}

function TimeSection({ projectId }: { projectId: number }) {
  const [status, setStatus] = useState<WorkStatus>("loading");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setStatus("loading");
    api.timeEntries
      .listByProject(projectId)
      .then((list) => {
        setEntries(list);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "couldn't load time");
        setStatus("error");
      });
  };

  useEffect(load, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = entries.reduce((sum, e) => sum + e.duration_seconds, 0);

  return (
    <section aria-labelledby="time">
      <h2 id="time">time</h2>
      {status === "loading" ? (
        <Loading label="loading time" />
      ) : status === "error" ? (
        <ErrorState message={error ?? "couldn't load time"} onRetry={load} />
      ) : entries.length === 0 ? (
        <p className="meta">no time logged yet.</p>
      ) : (
        <>
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                {entry.entry_date}
                {" — "}
                {entry.description || entry.task_title || "untracked work"}
                {" · "}
                {formatDuration(entry.duration_seconds)}
                {" · "}
                {entry.billable ? "billable" : "non-billable"}
              </li>
            ))}
          </ul>
          <p className="meta">project total {formatDuration(total)}</p>
        </>
      )}
      <p className="meta">
        <Link to="/timesheet">open timesheet</Link>
      </p>
    </section>
  );
}
