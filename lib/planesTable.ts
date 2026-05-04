const SAFE_IDENT = /^[A-Za-z0-9_]+$/;

function safeSqlIdent(value: string | undefined, fallback: string): string {
  const t = String(value ?? "").trim();
  return SAFE_IDENT.test(t) ? t : fallback;
}

/** Catálogo donde vive `planes_comerciales` (p. ej. proyectosapps). Siempre cualificado en SQL para no depender del USE del pool. */
export function planesComercialesFqn(): string {
  const schema = safeSqlIdent(process.env.MYSQL_DB_PC_PROYECTOSAPPS, "proyectosapps");
  return `\`${schema}\`.\`planes_comerciales\``;
}
