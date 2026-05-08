import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { planesComercialesFqn } from "@/lib/planesTable";
import { requireCommercialSession } from "@/lib/require-commercial-session";

type PlanPayload = Record<string, unknown> & {
  id: string;
  fecha?: string;
  timestamp?: string;
  region?: string;
  tienda?: string;
  gerente?: string;
  coordinador?: string;
  diasOperados?: number;
  diasFaltantes?: number;
  cotizacionesGV?: number;
  ventaMostrador?: number;
  objetivoMensual?: number;
  estado?: string;
};

function mesFromPlan(plan: PlanPayload): string {
  const raw = String(plan.fecha || plan.timestamp || "");
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toNullableInt(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? n : Math.trunc(n);
}

function statusFromPlan(plan: PlanPayload): "draft" | "final" {
  return String(plan.estado || "").toLowerCase() === "completado" ? "final" : "draft";
}

function buildAutofillSnapshot(plan: PlanPayload) {
  return {
    gerente: plan.gerente ?? null,
    coordinador: plan.coordinador ?? null,
    diasOperados: plan.diasOperados ?? null,
    diasFaltantes: plan.diasFaltantes ?? null,
    cotizacionesGV: plan.cotizacionesGV ?? null,
    ventaMostrador: plan.ventaMostrador ?? null,
    objetivoMensual: plan.objetivoMensual ?? null,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const authError = await requireCommercialSession();
  if (authError) return authError;

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "MySQL no configurado" }, { status: 503 });
  }
  const { planId } = await params;
  const decodedId = decodeURIComponent(planId);
  try {
    const plan = (await req.json()) as PlanPayload;
    if (plan.id && plan.id !== decodedId) {
      return NextResponse.json({ error: "id del cuerpo no coincide con la URL" }, { status: 400 });
    }
    plan.id = decodedId;
    const mes = mesFromPlan(plan);
    const regionNombre = String(plan.region || "").trim() || null;
    const sucursalNombre = String(plan.tienda || "").trim() || null;
    const regionId = toNullableInt(plan.region);
    const sucursalId = toNullableInt(plan.tienda);
    const status = statusFromPlan(plan);
    const payload = JSON.stringify(plan);
    const autofillSnapshot = JSON.stringify(buildAutofillSnapshot(plan));
    const tbl = planesComercialesFqn();
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ${tbl} SET
         mes = ?,
         region_id = ?,
         region_nombre = ?,
         sucursal_id = ?,
         sucursal_nombre = ?,
         status = ?,
         payload = CAST(? AS JSON),
         autofill_snapshot = CAST(? AS JSON),
         updated_at = CURRENT_TIMESTAMP
       WHERE plan_id = ?`,
      [mes, regionId, regionNombre, sucursalId, sucursalNombre, status, payload, autofillSnapshot, decodedId]
    );
    if (result.affectedRows === 0) {
      await pool.query(
        `INSERT INTO ${tbl} (
           plan_id, mes, region_id, region_nombre, sucursal_id, sucursal_nombre, status, payload, autofill_snapshot, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?)`,
        [decodedId, mes, regionId, regionNombre, sucursalId, sucursalNombre, status, payload, autofillSnapshot, null]
      );
    }
    return NextResponse.json(plan);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
