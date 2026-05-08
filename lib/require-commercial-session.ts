import { NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { userHasRequiredRole } from "@/lib/sessionRoles";

/**
 * 401 sin sesión; 403 con sesión pero sin el rol requerido.
 */
export async function requireCommercialSession(): Promise<NextResponse | null> {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as Record<string, unknown>;
  if (!userHasRequiredRole(user)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  return null;
}
