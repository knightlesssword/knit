import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, Client, api } from "../../lib/api";
import { validateName, validateOptionalEmail } from "../../lib/validation";
import { EmptyState, ErrorState, Loading } from "../../components/states";

type Status = "loading" | "ready" | "error";

export function ClientsPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [clients, setClients] = useState<Client[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setStatus("loading");
    api.clients
      .list()
      .then((list) => {
        setClients(list);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "couldn't load clients");
        setStatus("error");
      });
  };

  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = {
      name: validateName(name) ?? undefined,
      email: validateOptionalEmail(email) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email) return; // preserve input on error
    setBusy(true);
    setFormError(null);
    try {
      const created = await api.clients.create({
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setClients((prev) => [...prev, created]);
      setName("");
      setCompany("");
      setEmail("");
      setPhone("");
      setNotes("");
      setFieldErrors({});
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't create client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>clients</h1>
      <p className="meta">people and companies you work for. each account has its own.</p>
      <hr className="rule" />

      {status === "loading" ? (
        <Loading label="loading clients" />
      ) : status === "error" ? (
        <ErrorState message={loadError ?? "couldn't load clients"} onRetry={load} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="no clients yet"
          body="create your first client below. then add a project from the projects page."
        />
      ) : (
        <ul>
          {clients.map((c) => (
            <li key={c.id}>
              <Link to={`/clients/${c.id}`}>{c.name}</Link>
              {c.company ? <span className="meta"> — {c.company}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <hr className="rule" />
      <section aria-labelledby="new-client">
        <h2 id="new-client">new client</h2>
        <form onSubmit={submit} noValidate>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="client-name">name</label>
            <input
              id="client-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="client-company">company (optional)</label>
            <input
              id="client-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="client-email">email (optional)</label>
            <input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="client-phone">phone (optional)</label>
            <input
              id="client-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="client-notes">notes (optional)</label>
            <input
              id="client-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy}>
            {busy ? "creating…" : "create client"}
          </button>
        </form>
      </section>
    </div>
  );
}
