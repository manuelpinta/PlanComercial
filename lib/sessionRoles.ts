/** Extrae nombres de rol desde claims del usuario de sesión Auth0. */

function asRoleArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const t = value.trim();
    return t ? [t] : [];
  }
  return [];
}

/**
 * Claims del ID token relacionados con roles (custom claims que el SDK eliminaría al guardar sesión).
 */
export function pickRoleClaimsFromIdToken(
  claims: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const explicit = process.env.AUTH0_ROLES_CLAIM?.trim();

  if (claims.roles !== undefined) out.roles = claims.roles;
  if (explicit && claims[explicit] !== undefined) {
    out[explicit] = claims[explicit];
  }

  for (const [key, value] of Object.entries(claims)) {
    if (key === "roles" || (explicit && key === explicit)) continue;
    if (key.toLowerCase().endsWith("/roles")) {
      out[key] = value;
    }
  }

  return out;
}

/**
 * Roles suelen venir en `roles` o en un claim con namespace (Auth0 Action).
 * Opcional: AUTH0_ROLES_CLAIM=https://tu-dominio/roles
 */
export function rolesFromUser(user: Record<string, unknown>): string[] {
  const merged: string[] = [];
  const claimKey = process.env.AUTH0_ROLES_CLAIM?.trim();

  if (claimKey) merged.push(...asRoleArray(user[claimKey]));
  merged.push(...asRoleArray(user.roles));

  for (const [key, value] of Object.entries(user)) {
    if (claimKey && key === claimKey) continue;
    if (key === "roles") continue;
    if (key.toLowerCase().endsWith("/roles")) {
      merged.push(...asRoleArray(value));
    }
  }

  return [...new Set(merged)];
}

export function userHasRequiredRole(user: Record<string, unknown>): boolean {
  const required = (process.env.AUTH0_REQUIRED_ROLE ?? "Comercial").trim();
  if (!required) return true;

  const requiredLc = required.toLowerCase();
  const roles = rolesFromUser(user);
  return roles.some((r) => r.toLowerCase() === requiredLc);
}
