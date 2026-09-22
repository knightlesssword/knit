/** Client-side validation mirrors backend rules for fast feedback.
 * Backend remains authoritative (AGENTS.md section 7). */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateName(name: string): string | null {
  if (!name.trim()) return "name is required";
  if (name.trim().length > 120) return "name is too long";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!EMAIL_RE.test(email.trim().toLowerCase())) return "enter a valid email address";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "password must be at least 8 characters";
  return null;
}
