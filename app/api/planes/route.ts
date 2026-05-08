import type { RowDataPacket } from "mysql2";
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

export async function GET() {
  const authError = await requireCommercialSession();
  if (authError) return authError;

  const pool = getPool();
  if (!pool) {
    return NextResponse.json(
      { error: "MySQL no configurado. Define MYSQL_HOST y variables relacionadas." },
      { status: 503 }
    );
  }
  try {
    const tbl = planesComercialesFqn();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT plan_id, payload FROM ${tbl} ORDER BY updated_at DESC`
    );
    const planes = rows.map((r) => {
      const raw = r.payload;
      const p =
        typeof raw === "string"
          ? (JSON.parse(raw) as PlanPayload)
          : (raw as PlanPayload);
      return p;
    });
    return NextResponse.json(planes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos";
    // In read-only bootstrap mode, allow app to load even before schema exists.
    if (msg.toLowerCase().includes("doesn't exist")) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authError = await requireCommercialSession();
  if (authError) return authError;

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "MySQL no configurado" }, { status: 503 });
  }
  try {
    const plan = (await req.json()) as PlanPayload;
    if (!plan?.id) {
      return NextResponse.json({ error: "Falta id del plan" }, { status: 400 });
    }
    const payload = JSON.stringify(plan);
    const mes = mesFromPlan(plan);
    const regionNombre = String(plan.region || "").trim() || null;
    const sucursalNombre = String(plan.tienda || "").trim() || null;
    const regionId = toNullableInt(plan.region);
    const sucursalId = toNullableInt(plan.tienda);
    const status = statusFromPlan(plan);
    const autofillSnapshot = JSON.stringify(buildAutofillSnapshot(plan));
    const tbl = planesComercialesFqn();
    await pool.query(
      `INSERT INTO ${tbl} (
         plan_id, mes, region_id, region_nombre, sucursal_id, sucursal_nombre, status, payload, autofill_snapshot, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?)
       ON DUPLICATE KEY UPDATE
         mes = VALUES(mes),
         region_id = VALUES(region_id),
         region_nombre = VALUES(region_nombre),
         sucursal_id = VALUES(sucursal_id),
         sucursal_nombre = VALUES(sucursal_nombre),
         status = VALUES(status),
         payload = VALUES(payload),
         autofill_snapshot = VALUES(autofill_snapshot),
         updated_at = CURRENT_TIMESTAMP`,
      [plan.id, mes, regionId, regionNombre, sucursalId, sucursalNombre, status, payload, autofillSnapshot, null]
    );
    return NextResponse.json(plan);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authError = await requireCommercialSession();
  if (authError) return authError;

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "MySQL no configurado" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const planes = body.planes as PlanPayload[] | undefined;
    if (!Array.isArray(planes)) {
      return NextResponse.json({ error: "Se esperaba { planes: [...] }" }, { status: 400 });
    }
    const conn = await pool.getConnection();
    try {
      const tbl = planesComercialesFqn();
      await conn.beginTransaction();
      await conn.query(`DELETE FROM ${tbl}`);
      for (const plan of planes) {
        if (!plan?.id) continue;
        const mes = mesFromPlan(plan);
        const regionNombre = String(plan.region || "").trim() || null;
        const sucursalNombre = String(plan.tienda || "").trim() || null;
        const regionId = toNullableInt(plan.region);
        const sucursalId = toNullableInt(plan.tienda);
        const status = statusFromPlan(plan);
        const payload = JSON.stringify(plan);
        const autofillSnapshot = JSON.stringify(buildAutofillSnapshot(plan));
        await conn.query(
          `INSERT INTO ${tbl} (
             plan_id, mes, region_id, region_nombre, sucursal_id, sucursal_nombre, status, payload, autofill_snapshot, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?)`,
          [plan.id, mes, regionId, regionNombre, sucursalId, sucursalNombre, status, payload, autofillSnapshot, null]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return NextResponse.json({ ok: true, count: planes.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const authError = await requireCommercialSession();
  if (authError) return authError;

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "MySQL no configurado" }, { status: 503 });
  }
  try {
    const tbl = planesComercialesFqn();
    await pool.query(`DELETE FROM ${tbl}`);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al borrar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
