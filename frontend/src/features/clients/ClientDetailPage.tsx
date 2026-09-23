import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, Client, api } from "../../lib/api";
import { validateName, validateOptionalEmail } from "../../lib/validation";
import { EmptyState, ErrorState, Loading } from "../../components/states";

type Status = "loading" | "ready" | "missing" | "error";

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clientId = Number(id);

  const [status, setStatus] = useState<Status>("loading");
  const [client, setClient] = useState<Client | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    if (!Number.isInteger(clientId)) {
      setStatus("missing");
      return;
    }
    setStatus("loading");
    api.clients
      .get(clientId)
      .then((c) => {
        setClient(c);
        setName(c.name);
        setCompany(c.company ?? "");
        setEmail(c.email ?? "");
        setPhone(c.phone ?? "");
        setNotes(c.notes ?? "");
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) setStatus("missing");
        else {
          setLoadError(err instanceof ApiError ? err.message : "couldn't load client");
          setStatus("error");
        }
      });
  };

  useEffect(load, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errors = {
      name: validateName(name) ?? undefined,
      email: validateOptionalEmail(email) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email) return; // preserve input on error
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.clients.update(clientId, {
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setClient(updated);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.clients.remove(clientId);
      navigate("/clients");
    } catch (err) {
      setDeleting(false);
      setConfirmingDelete(false);
      setFormError(err instanceof ApiError ? err.message : "couldn't delete client");
    }
  };

  if (status === "loading") return <Loading label="loading client" />;
  if (status === "missing")
    return <EmptyState title="client not found" body="it may have been deleted." />;
  if (status === "error")
    return <ErrorState message={loadError ?? "couldn't load client"} onRetry={load} />;

  return (
    <div>
      <h1>{client?.name}</h1>
      <hr className="rule" />
      <section aria-labelledby="edit-client">
        <h2 id="edit-client">details</h2>
        <form onSubmit={save} noValidate>
          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="detail-name">name</label>
            <input
              id="detail-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="detail-company">company (optional)</label>
            <input
              id="detail-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="detail-email">email (optional)</label>
            <input
              id="detail-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="detail-phone">phone (optional)</label>
            <input
              id="detail-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="detail-notes">notes (optional)</label>
            <input
              id="detail-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            <span className="btn-text">{saving ? "saving…" : "save changes"}</span>
          </button>
        </form>
      </section>

      <hr className="rule" />
      <section aria-labelledby="delete-client">
        <h2 id="delete-client">delete</h2>
        {!confirmingDelete ? (
          <button type="button" className="secondary" onClick={() => setConfirmingDelete(true)}>
            delete client
          </button>
        ) : (
          <div>
            <p className="meta">
              delete “{client?.name}”? this permanently removes the client and cannot be
              undone.
            </p>
            <button type="button" className="btn-primary" onClick={remove} disabled={deleting}>
              <span className="btn-text">{deleting ? "deleting…" : "yes, delete"}</span>
            </button>{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              keep client
            </button>
          </div>
        )}
      </section>

      <hr className="rule" />
      <EmptyState title="no projects yet" body="projects arrive in phase 2." />
    </div>
  );
}
