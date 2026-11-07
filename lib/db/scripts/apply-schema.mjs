import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set SUPABASE_DATABASE_URL or DATABASE_URL through secure environment configuration.');
  process.exit(1);
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  await client.query(await readFile(new URL('../sql/001_falconeye.sql', import.meta.url), 'utf8'));
  console.log('FalconEye registration schema applied; no application data deleted.');
} catch {
  // Driver errors may contain connection details. Never print raw errors here.
  console.error('Schema setup failed. Check database access, TLS settings, and owner permissions.');
  process.exitCode = 1;
} finally {
  await client.end();
}
