import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PcAuthCard } from "@/components/pc-auth-card";
import { auth0 } from "@/lib/auth0";
import { userHasRequiredRole } from "@/lib/sessionRoles";

export const metadata: Metadata = {
  title: "Iniciar sesión · Plan Comercial",
};

export default async function LoginPage() {
  const session = await auth0.getSession();

  if (session) {
    const user = session.user as Record<string, unknown>;
    if (userHasRequiredRole(user)) {
      redirect("/");
    }
    redirect("/sin-permiso");
  }

  return (
    <PcAuthCard
      title="Iniciar sesión"
      subtitle="Usa tu cuenta autorizada para entrar al plan de acciones comerciales."
    >
      <a href="/auth/login" className="pc-btn pc-btn-primary">
        Continuar con Auth0
      </a>
    </PcAuthCard>
  );
}
