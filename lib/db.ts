// PostgreSQL connection helper for AbujaLifestyle.

import { Pool } from 'pg';

declare global { var __abjPool: Pool | undefined }

export function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!global.__abjPool) global.__abjPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } });
  return global.__abjPool;
}
