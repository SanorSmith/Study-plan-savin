/**
 * Parent accounts are invitation-only. ALLOWED_PARENT_EMAILS is a comma-separated list.
 * In production an empty list allows nobody (fail closed); in development it allows everyone.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(
  email: string | null | undefined,
  raw: string | undefined = process.env.ALLOWED_PARENT_EMAILS,
  production: boolean = process.env.NODE_ENV === "production",
): boolean {
  const list = parseAllowlist(raw);
  if (list.length === 0) return !production;
  return !!email && list.includes(email.trim().toLowerCase());
}

export const NOT_INVITED = "This app is invitation only. Ask the owner to add your email.";
