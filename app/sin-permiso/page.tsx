import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { authLogoutHref } from "@/lib/auth-links";
import { PcAuthCard } from "@/components/pc-auth-card";
import { auth0 } from "@/lib/auth0";
import { userHasRequiredRole } from "@/lib/sessionRoles";

export const metadata: Metadata = {
  title: "Sin acceso · Plan Comercial",
};

export default async function SinPermisoPage() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/login");
  }

  const user = session.user as Record<string, unknown>;
  if (userHasRequiredRole(user)) {
    redirect("/");
  }

  return (
    <PcAuthCard
      title="No tienes permiso"
      subtitle="Tu cuenta inició sesión correctamente, pero no está autorizada para usar esta aplicación. Si crees que es un error, contacta al administrador."
    >
      <a href={authLogoutHref()} className="pc-btn pc-btn-primary">
        Cerrar sesión
      </a>
    </PcAuthCard>
  );
}
