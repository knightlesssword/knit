import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ApiError,
  Project,
  ProjectCurrency,
  ProjectStatus,
  ProjectType,
  api,
} from "../../lib/api";
import { formatMoney, majorToMinor, minorToMajor } from "../../lib/money";
import { validateName } from "../../lib/validation";
import { EmptyState, ErrorState, Loading, ProgressBar } from "../../components/states";

type Status = "loading" | "ready" | "missing" | "error";

function moneySummary(project: Project): string {
  if (project.project_type === "fixed_price") {
    return project.fixed_price !== null
      ? `fixed price ${formatMoney(project.fixed_price, project.currency)}`
      : "no fixed price set";
  }
  if (project.project_type === "hourly") {
    return project.hourly_rate !== null
      ? `rate ${formatMoney(project.hourly_rate, project.currency)} per hour. tracked value arrives in phase 4.`
      : "no hourly rate set. tracked value arrives in phase 4.";
  }
  return project.recurring_amount !== null
    ? `recurring ${formatMoney(project.recurring_amount, project.currency)}`
    : "no recurring amount set";
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [status, setStatus] = useState<Status>("loading");
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("fixed_price");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("active");
  const [currency, setCurrency] = useState<ProjectCurrency>("USD");
  const [money, setMoney] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; money?: string }>({});
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

  useEffect(load, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; money?: string } = {
      name: validateName(name) ?? undefined,
    };
    let minor: number | null = null;
    if (money.trim()) {
      minor = majorToMinor(money);
      if (minor === null) errors.money = "enter an amount like 42.50";
    }
    setFieldErrors(errors);
    if (errors.name || errors.money) return; // preserve input on error
    setSaving(true);
    setFormError(null);
    try {
      const amountField =
        projectType === "fixed_price"
          ? { fixed_price: minor }
          : projectType === "hourly"
            ? { hourly_rate: minor }
            : { recurring_amount: minor };
      const updated = await api.projects.update(projectId, {
        name: name.trim(),
        project_type: projectType,
        status: projectStatus,
        currency,
        description: description.trim() || undefined,
        ...amountField,
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
        <ProgressBar value={null} />
        <p className="meta">task progress arrives in phase 3.</p>
      </section>

      <hr className="rule" />
      <section aria-labelledby="money">
        <h2 id="money">money</h2>
        <p className="meta">{moneySummary(project)}</p>
      </section>

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
              delete “{project.name}”? this permanently removes the project and cannot be
              undone.
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
      <EmptyState title="tasks" body="tasks arrive in phase 3." />
      <hr className="rule" />
      <EmptyState title="milestones" body="milestones arrive in phase 3." />
      <hr className="rule" />
      <EmptyState title="time" body="time tracking arrives in phase 4." />
      <hr className="rule" />
      <EmptyState title="files" body="project files arrive in a later phase." />
    </div>
  );
}
