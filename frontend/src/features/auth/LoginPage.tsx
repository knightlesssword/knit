import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { validateEmail } from "../../lib/validation";
import { Loading } from "../../components/states";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <main className="main">
        <Loading label="loading" />
      </main>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = {
      identifier: validateEmail(identifier) ?? undefined,
      password: password ? null : "password is required",
    };
    setFieldErrors({ identifier: errors.identifier ?? undefined, password: errors.password ?? undefined });
    if (errors.identifier || errors.password) return; // preserve input on error
    setBusy(true);
    setFormError(null);
    try {
      await login(identifier.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      // input preserved so the user can correct and retry
      setFormError(err instanceof ApiError ? err.message : "couldn't log in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="main">
      <h1>log in</h1>
      <p className="meta">your data stays on this machine.</p>
      <form onSubmit={submit} noValidate>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="login-email">email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            aria-invalid={Boolean(fieldErrors.identifier)}
            aria-describedby={fieldErrors.identifier ? "login-email-error" : undefined}
          />
          {fieldErrors.identifier ? (
            <p className="field-error" id="login-email-error">
              {fieldErrors.identifier}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="login-password">password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
        </div>
        <button type="submit" disabled={busy}>
          {busy ? "logging in…" : "log in"}
        </button>
      </form>
      <hr className="rule" />
      <p className="meta">
        no account yet? <Link to="/register">create one</Link>
      </p>
    </main>
  );
}
