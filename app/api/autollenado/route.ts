import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireCommercialSession } from "@/lib/require-commercial-session";

function safeDbName(value: string | undefined, fallback: string) {
  const v = (value || fallback).trim();
  return /^[A-Za-z0-9_]+$/.test(v) ? v : fallback;
}

function getDbNames() {
  return {
    pdv: safeDbName(process.env.MYSQL_DB_PC_PDV, "pdv"),
    esta: safeDbName(process.env.MYSQL_DB_PC_ESTA, "estapinta"),
    comun: safeDbName(process.env.MYSQL_DB_PC_COMUN, "comun"),
  };
}

type RegionRow = RowDataPacket & { idRegion: number; region: string };
type SucursalRow = RowDataPacket & { numSucursal: number; sucursal: string };
type DetalleRow = {
  gerente: string | null;
  coordinador: string | null;
  responsables: string[];
  diasOperados: number | null;
  diasFaltantes: number | null;
  cotizacionesGV: number | null;
  ventaMostrador: number | null;
  objetivoMensual: number | null;
};

export async function GET(req: Request) {
  const authError = await requireCommercialSession();
  if (authError) return authError;

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "MySQL no configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");
  const { pdv, esta, comun } = getDbNames();

  try {
    if (mode === "regiones") {
      const [rows] = await pool.query<RegionRow[]>(
        `SELECT DISTINCT
            sz.idSubZona AS idRegion,
            sz.nombre AS region
         FROM ${comun}.sucursal s
         INNER JOIN ${comun}.subzonas sz ON sz.idSubZona = s.idSubZona
         WHERE s.SubTipoSuc IN ('2', 'S', 'V')
         ORDER BY sz.nombre`
      );
      return NextResponse.json(rows);
    }

    if (mode === "sucursales") {
      const idRegion = Number(searchParams.get("idRegion"));
      if (!idRegion) {
        return NextResponse.json({ error: "Falta idRegion" }, { status: 400 });
      }
      const [rows] = await pool.query<SucursalRow[]>(
        `SELECT
            s.Num_suc AS numSucursal,
            s.Nombre AS sucursal
         FROM ${comun}.sucursal s
         LEFT JOIN ${esta}.analisisventasxdia a
           ON s.Num_suc = a.Sucursal
         WHERE s.SubTipoSuc IN ('2', 'S', 'V')
           AND s.idSubZona = ?
           AND a.Fecha >= CONCAT(YEAR(CURDATE()), '0101')
         GROUP BY s.Num_suc, s.Nombre
         HAVING COUNT(a.Sucursal) > 0
         ORDER BY s.Nombre`,
        [idRegion]
      );
      return NextResponse.json(rows);
    }

    if (mode === "detalle") {
      const numSucursal = Number(searchParams.get("numSucursal"));
      const mes = (searchParams.get("mes") || "").trim();
      if (!numSucursal || !/^\d{6}$/.test(mes)) {
        return NextResponse.json({ error: "Se requiere numSucursal y mes YYYYMM" }, { status: 400 });
      }

      const base: DetalleRow = {
        diasOperados: 0,
        diasFaltantes: 0,
        cotizacionesGV: 0,
        ventaMostrador: 0,
        objetivoMensual: 0,
        gerente: null,
        coordinador: null,
        responsables: [],
      };
      let ventaTotal = 0;
      let effectiveMes = mes;
      let tpSucursal = 0;

      try {
        const [ventasRows] = await pool.query<RowDataPacket[]>(
          `SELECT
              a.Mes AS mesComis,
              COALESCE(a.Ventanetasucursal, 0) AS ventaTotal,
              COALESCE(a.tpSucursal, 0) AS tpSucursal,
              COALESCE(a.ObjNetas, 0) AS objetivoMensual,
              COALESCE(a.DiasTranscurridosSucursal, 0) AS diasOperados,
              COALESCE(a.DiasPorTranscurrirSucursal, 0) AS diasFaltantes,
              NULL AS gerente,
              NULL AS coordinador
           FROM ${esta}.ComisXVtasSuc a
           WHERE CAST(a.Mes AS UNSIGNED) <= CAST(? AS UNSIGNED)
             AND a.Sucursal = ?
           ORDER BY CAST(a.Mes AS UNSIGNED) DESC
           LIMIT 1`,
          [mes, numSucursal]
        );
        if (ventasRows[0]) {
          const row = ventasRows[0];
          const rawMes = row.mesComis ?? row.Mes;
          effectiveMes = rawMes != null ? String(rawMes).replace(/\D/g, "").slice(0, 6) : mes;
          if (effectiveMes.length !== 6) effectiveMes = mes;
          ventaTotal = Number(row.ventaTotal || 0);
          tpSucursal = Number(row.tpSucursal || 0);
          base.objetivoMensual = Number(row.objetivoMensual || 0);
          base.diasOperados = Number(row.diasOperados || 0);
          base.diasFaltantes = Number(row.diasFaltantes || 0);
        }
      } catch {
        // Keep default values when source views/tables have collation issues.
      }

      // Venta en mostrador = suma de tickets con VentaNeta < tpSucursal*15 (véase docs/Consultaparaextras.md).
      // Cotizaciones gran volumen = venta neta sucursal − mostrador.
      let ventaMostradorCalc = 0;
      try {
        const threshold = tpSucursal * 15;
        const [movRows] = await pool.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(m.VentaNeta), 0) AS ventaMostrador
           FROM ${esta}.analisisVentasXMov m
           WHERE LEFT(m.fecha, 6) = ?
             AND m.Sucursal = ?
             AND m.VentaNeta < ?`,
          [effectiveMes, numSucursal, threshold]
        );
        if (movRows[0]) {
          ventaMostradorCalc = Number(movRows[0].ventaMostrador || 0);
        }
      } catch {
        // Sin tabla movimientos o columnas distintas: atribuir todo a mostrador para conservar el total.
        ventaMostradorCalc = ventaTotal;
      }

      if (ventaMostradorCalc > ventaTotal) {
        ventaMostradorCalc = ventaTotal;
      }
      base.ventaMostrador = ventaMostradorCalc;
      base.cotizacionesGV = Math.max(0, ventaTotal - ventaMostradorCalc);

      // Prefer dias_laborables for day metrics when available.
      try {
        const [diasRows] = await pool.query<RowDataPacket[]>(
          `SELECT
              COALESCE(d.Dias_Efectivos_Pasado, 0) AS diasOperados,
              GREATEST(COALESCE(d.Base_Dinamica_Final, 0) - COALESCE(d.Dias_Efectivos_Pasado, 0), 0) AS diasFaltantes
           FROM ${esta}.dias_laborables d
           WHERE CAST(d.mes AS UNSIGNED) <= CAST(? AS UNSIGNED)
             AND d.num_suc = ?
           ORDER BY CAST(d.mes AS UNSIGNED) DESC
           LIMIT 1`,
          [mes, numSucursal]
        );
        if (diasRows[0]) {
          base.diasOperados = Number(diasRows[0].diasOperados || 0);
          base.diasFaltantes = Number(diasRows[0].diasFaltantes || 0);
        }
      } catch {
        // Keep values from ComisXVtasSuc when dias_laborables is unavailable.
      }

      // Category mapping requested by business:
      // - Gerente de tienda -> Categoria 1 (encargado) by sucursal.
      // - Coordinador Regional -> Categoria 2 by region, fallback Categoria 3 by region.
      try {
        const [peopleRows] = await pool.query<RowDataPacket[]>(
          `SELECT
              (
                SELECT c1.Nombre
                FROM ${pdv}.catcomisionistas c1
                WHERE IFNULL(c1.FechaTerm, '') = ''
                  AND c1.Categoria = 1
                  AND c1.Sucursal = ?
                ORDER BY c1.FechaRegistro DESC, c1.IdVendedor DESC
                LIMIT 1
              ) AS gerente,
              (
                SELECT c2.Nombre
                FROM ${pdv}.catcomisionistas c2
                WHERE IFNULL(c2.FechaTerm, '') = ''
                  AND c2.Categoria = 2
                  AND c2.Sucursal = (
                    SELECT st.idSubZona
                    FROM ${comun}.sucursal st
                    WHERE st.Num_suc = ?
                    LIMIT 1
                  )
                ORDER BY c2.FechaRegistro DESC, c2.IdVendedor DESC
                LIMIT 1
              ) AS coordinador,
              (
                SELECT c3.Nombre
                FROM ${pdv}.catcomisionistas c3
                WHERE IFNULL(c3.FechaTerm, '') = ''
                  AND c3.Categoria = 3
                  AND c3.Sucursal = (
                    SELECT st.idSubZona
                    FROM ${comun}.sucursal st
                    WHERE st.Num_suc = ?
                    LIMIT 1
                  )
                ORDER BY c3.FechaRegistro DESC, c3.IdVendedor DESC
                LIMIT 1
              ) AS gerenteRegional`,
          [numSucursal, numSucursal, numSucursal]
        );
        const people = peopleRows[0] as RowDataPacket | undefined;
        base.gerente = (people?.gerente as string | null) || null;
        base.coordinador =
          (people?.coordinador as string | null) ||
          (people?.gerenteRegional as string | null) ||
          null;
      } catch {
        // Keep nulls when regional assignment cannot be resolved.
      }

      // Last resort directly on sucursal (keeps requested category priorities).
      if (!base.gerente || !base.coordinador) {
        try {
          const [localPeopleRows] = await pool.query<RowDataPacket[]>(
            `SELECT
                MAX(CASE WHEN c.Categoria = 1 THEN c.Nombre END) AS gerente,
                MAX(CASE WHEN c.Categoria = 2 THEN c.Nombre END) AS coordinador,
                MAX(CASE WHEN c.Categoria = 3 THEN c.Nombre END) AS gerenteRegional
             FROM ${pdv}.catcomisionistas c
             WHERE IFNULL(c.FechaTerm, '') = ''
               AND c.Sucursal = ?`,
            [numSucursal]
          );
          const local = localPeopleRows[0] as RowDataPacket | undefined;
          if (!base.gerente) {
            base.gerente = (local?.gerente as string | null) || null;
          }
          if (!base.coordinador) {
            base.coordinador =
              (local?.coordinador as string | null) ||
              (local?.gerenteRegional as string | null) ||
              null;
          }
        } catch {
          // Keep current values.
        }
      }

      // Build suggested responsables list: active people from selected sucursal + coordinador.
      try {
        const [respRows] = await pool.query<RowDataPacket[]>(
          `SELECT c.Nombre
           FROM ${pdv}.catcomisionistas c
           WHERE IFNULL(c.FechaTerm, '') = ''
             AND c.Sucursal = ?
           ORDER BY c.Nombre`,
          [numSucursal]
        );
        const names = respRows
          .map((r) => String(r.Nombre || "").trim())
          .filter((n) => n.length > 0);
        if (base.coordinador) {
          names.push(base.coordinador);
        }
        base.responsables = Array.from(new Set(names));
      } catch {
        base.responsables = base.coordinador ? [base.coordinador] : [];
      }

      return NextResponse.json(base);
    }

    return NextResponse.json({ error: "Modo no soportado" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de base de datos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

