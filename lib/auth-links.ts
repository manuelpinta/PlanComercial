/**
 * Construye `/auth/logout?returnTo=...` para Auth0.
 *
 * Por defecto usa solo el origen (`APP_BASE_URL` sin path), que suele ser lo que ya tienes
 * en "Allowed Logout URLs". Al volver a `/`, la app redirige a `/login` si no hay sesión.
 *
 * Si quieres volver directo a `/login`, define `AUTH0_POST_LOGOUT_REDIRECT=/login` y registra
 * esa URL completa en Auth0 → Allowed Logout URLs.
 */
export function authLogoutHref(): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) return "/auth/logout";

  const base = raw.replace(/\/$/, "");
  const configured = process.env.AUTH0_POST_LOGOUT_REDIRECT?.trim();

  let absolute: string;
  if (!configured || configured === "/") {
    absolute = base;
  } else {
    const p = configured.startsWith("/") ? configured : `/${configured}`;
    absolute = `${base}${p}`;
  }

  return `/auth/logout?returnTo=${encodeURIComponent(absolute)}`;
}
