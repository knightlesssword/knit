import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { validateEmail, validateName, validatePassword } from "../../lib/validation";
import { useAuth } from "./AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = {
      name: validateName(name) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password) return;
    setBusy(true);
    setFormError(null);
    try {
      await register(name.trim(), email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.code === "user_exists"
          ? "an account with this email already exists"
          : err instanceof ApiError
            ? err.message
            : "couldn't create the account",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="main">
      <h1>create account</h1>
      <p className="meta">one local account on this machine.</p>
      <form onSubmit={submit} noValidate>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="reg-name">name</label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="reg-email">email</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="reg-password">password</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby="reg-password-hint"
          />
          <p className="meta" id="reg-password-hint">
            at least 8 characters. stored hashed, never in plain text.
          </p>
          {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          <span className="btn-text">{busy ? "creating…" : "create account"}</span>
        </button>
      </form>
      <hr className="rule" />
      <p className="meta">
        already have one? <Link to="/login">log in</Link>
      </p>
    </main>
  );
}
