import mysql from "mysql2/promise";

function firstNonEmptyEnv(...keys: (string | undefined)[]): string | undefined {
  for (const k of keys) {
    if (k == null) continue;
    const t = String(k).trim();
    if (t) return t;
  }
  return undefined;
}

function createPool() {
  const host = process.env.MYSQL_HOST;
  // Vacío en .env no debe caer a otra base por error; por defecto proyectosapps donde está la tabla.
  const database =
    firstNonEmptyEnv(
      process.env.MYSQL_DB_PC_PROYECTOSAPPS,
      process.env.MYSQL_DATABASE,
      process.env.MYSQL_DB_PC_ESTA
    ) ?? "proyectosapps";
  if (!host) {
    return null;
  }
  return mysql.createPool({
    host,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database,
    port: Number(process.env.MYSQL_PORT || 3306),
    ssl:
      process.env.MYSQL_SSL === "true"
        ? { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_LIMIT || 5),
  });
}

const poolSingleton = createPool();

export function getPool() {
  return poolSingleton;
}
