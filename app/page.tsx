import { redirect } from "next/navigation";

import { authLogoutHref } from "@/lib/auth-links";
import { auth0 } from "@/lib/auth0";
import { userHasRequiredRole } from "@/lib/sessionRoles";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/login");
  }

  const user = session.user as Record<string, unknown>;
  if (!userHasRequiredRole(user)) {
    redirect("/sin-permiso");
  }

  const email = typeof user.email === "string" ? user.email : null;

  return (
    <div className="pc-app-shell">
      <header className="pc-app-header">
        <span className="pc-app-title">Plan Comercial</span>
        {email ? (
          <span className="pc-app-user" title={email}>
            {email}
          </span>
        ) : (
          <span className="pc-app-user" />
        )}
        <a href={authLogoutHref()} className="pc-btn pc-btn-ghost pc-btn-sm">
          Cerrar sesión
        </a>
      </header>
      <iframe
        title="Plan de Acciones Comerciales"
        src="/plan.html"
        className="pc-app-frame"
      />
    </div>
  );
}
