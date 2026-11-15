import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { Pool, types, type QueryResultRow } from "pg";

// Por defecto `pg` devuelve bigint como texto y las fechas como Date en la zona horaria del servidor.
// Los conteos de los marts caben de sobra en un número, y una fecha sin hora debe seguir siendo esa fecha
// en cualquier zona: se leen como número y como texto AAAA-MM-DD.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.DATE, (value) => value);

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL: la conexión de solo lectura a los marts.");
  }
  pool = new Pool({
    connectionString,
    // Pocas conexiones: las páginas se sirven pre-renderizadas y solo se consulta al regenerarlas.
    max: 4,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  // En Vercel cierra las conexiones inactivas antes de que la función se suspenda.
  attachDatabasePool(pool);
  return pool;
}

/** Ejecuta una consulta parametrizada. Los valores nunca se interpolan en el SQL. */
export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const result = await getPool().query<Row>(text, [...values]);
  return result.rows;
}
