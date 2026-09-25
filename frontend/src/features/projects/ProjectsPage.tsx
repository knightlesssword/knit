import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, Client, ProjectCurrency, ProjectStatus, ProjectType, api } from "../../lib/api";
import { majorToMinor } from "../../lib/money";
import { validateName } from "../../lib/validation";
import { EmptyState, ErrorState, Loading } from "../../components/states";

type Status = "loading" | "ready" | "error";

export function ProjectsPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof api.projects.list>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("fixed_price");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("active");
  const [currency, setCurrency] = useState<ProjectCurrency>("USD");
  const [money, setMoney] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [recurringBillingPeriod, setRecurringBillingPeriod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; client?: string; money?: string; budget?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setStatus("loading");
    Promise.all([api.projects.list(true), api.clients.list()])
      .then(([projectList, clientList]) => {
        setProjects(projectList);
        setClients(clientList);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "couldn't load projects");
        setStatus("error");
      });
  };

  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; client?: string; money?: string; budget?: string } = {
      name: validateName(name) ?? undefined,
      client: clientId ? undefined : "choose a client",
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
    if (errors.name || errors.client || errors.money || errors.budget) return; // preserve input on error
    setBusy(true);
    setFormError(null);
    try {
      const amountField =
        projectType === "fixed_price"
          ? { fixed_price: minor }
          : projectType === "hourly"
            ? { hourly_rate: minor }
            : { recurring_amount: minor };
      const created = await api.projects.create({
        name: name.trim(),
        client_id: Number(clientId),
        project_type: projectType,
        status: projectStatus,
        currency,
        ...amountField,
        budget: budgetMinor,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        recurring_billing_period: recurringBillingPeriod.trim() || undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
      });
      setProjects((prev) => [...prev, created]);
      setName("");
      setMoney("");
      setBudget("");
      setDescription("");
      setNotes("");
      setRecurringBillingPeriod("");
      setStartDate("");
      setDueDate("");
      setFieldErrors({});
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't create project");
    } finally {
      setBusy(false);
    }
  };

  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);

  return (
    <div>
      <h1>projects</h1>
      <p className="meta">work you track time and money against.</p>
      <hr className="rule" />

      {status === "loading" ? (
        <Loading label="loading projects" />
      ) : status === "error" ? (
        <ErrorState message={loadError ?? "couldn't load projects"} onRetry={load} />
      ) : projects.length === 0 ? (
        <EmptyState title="no projects yet" body="create your first project below." />
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState title="no active projects" body="all projects are archived." />
          ) : (
            <ul>
              {active.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  <span className="meta"> — {p.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
          {archived.length > 0 ? (
            <section aria-labelledby="archived-projects">
              <h2 id="archived-projects">archived</h2>
              <ul>
                {archived.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`}>{p.name}</Link>
                    <span className="meta"> — {p.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <hr className="rule" />
      <section aria-labelledby="new-project">
        <h2 id="new-project">new project</h2>
        <form onSubmit={submit} noValidate>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="project-name">name</label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="project-client">client</label>
            <select
              id="project-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-invalid={Boolean(fieldErrors.client)}
            >
              <option value="">choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.client ? <p className="field-error">{fieldErrors.client}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="project-type">type</label>
            <select
              id="project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
            >
              <option value="fixed_price">fixed price</option>
              <option value="hourly">hourly</option>
              <option value="retainer">retainer</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="project-status">status</label>
            <select
              id="project-status"
              value={projectStatus}
              onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
            >
              <option value="active">active</option>
              <option value="on_hold">on hold</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="project-currency">currency</label>
            <select
              id="project-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as ProjectCurrency)}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="project-amount">
              {projectType === "hourly" ? "hourly rate (optional)" : "amount (optional)"}
            </label>
            <input
              id="project-amount"
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
            <label htmlFor="project-budget">budget (optional)</label>
            <input
              id="project-budget"
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
            <label htmlFor="project-period">recurring billing period (optional)</label>
            <input
              id="project-period"
              type="text"
              placeholder="monthly"
              value={recurringBillingPeriod}
              onChange={(e) => setRecurringBillingPeriod(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="project-description">description (optional)</label>
            <input
              id="project-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="project-notes">notes (optional)</label>
            <input
              id="project-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="project-start">start date (optional)</label>
            <input
              id="project-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="project-due">due date (optional)</label>
            <input
              id="project-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "creating…" : "create project"}
          </button>
        </form>
      </section>
    </div>
  );
}
