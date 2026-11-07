import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

/**
 * Lazy database bootstrap.
 *
 * Importing this module must never require DATABASE_URL — Next.js evaluates
 * route modules at build time ("Collecting page data"), and deploys without a
 * PostgreSQL database (e.g. Netlify) would otherwise fail the whole build.
 * The connection is only created on first actual use; when used without
 * DATABASE_URL it still fails with the same explicit error.
 */
function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

let poolInstance: Pool | undefined;

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance =
      globalForDb.__arenaNextJsPostgresqlPool ??
      new Pool({
        connectionString: getDatabaseUrl(),
        // Bounded resources: serverless-friendly pool that cannot exhaust
        // database connections or hang requests indefinitely.
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30_000,
      });
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__arenaNextJsPostgresqlPool = poolInstance;
    }
  }
  return poolInstance;
}

type DrizzleDb = ReturnType<typeof drizzle>;

let dbInstance: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  if (!dbInstance) {
    dbInstance = drizzle(getPool());
  }
  return dbInstance;
}

/** Forwarding proxy so existing `pool` / `db` imports keep working unchanged. */
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const instance = resolve();
      const value = Reflect.get(instance, prop, receiver);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
  });
}

export const pool = lazy<Pool>(getPool);
export const db = lazy<DrizzleDb>(getDb);
