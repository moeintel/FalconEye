import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import test from 'node:test';
import { postgresOptions } from '../src/connection.ts';

test('local PostgreSQL configuration is unchanged', () => {
  const connectionString = 'postgresql://localhost/falconeye_test';
  assert.deepEqual(postgresOptions(connectionString), { connectionString });
});

test('Supabase pooler cannot disable certificate verification through URI options', () => {
  for (const mode of ['disable', 'require', 'no-verify']) {
    const options = postgresOptions(
      `postgresql://example.pooler.supabase.com:6543/postgres?sslmode=${mode}&sslrootcert=unused`,
    );
    assert.equal(options.ssl.rejectUnauthorized, true);
    const url = new URL(options.connectionString);
    assert.equal(url.searchParams.has('sslmode'), false);
    assert.equal(url.searchParams.has('sslrootcert'), false);
  }
});

test('trusted Supabase public CA is bundled and not expired', () => {
  const { ssl } = postgresOptions('postgresql://db.example.supabase.co/postgres');
  const certificate = new X509Certificate(ssl.ca.at(-1));
  assert.match(certificate.subject, /Supabase Root 2021 CA/);
  assert.equal(certificate.ca, true);
  assert.ok(Date.parse(certificate.validTo) > Date.now());
});

test('lookalike hostnames do not gain Supabase CA trust', () => {
  const options = postgresOptions('postgresql://example.supabase.com.attacker.invalid/postgres');
  assert.equal(options.ssl, undefined);
});

test('malformed input and non-PostgreSQL URLs are rejected without revealing input', () => {
  assert.throws(() => postgresOptions('invalid-input'), { message: 'Invalid database connection string.' });
  assert.throws(() => postgresOptions('https://example.invalid'), {
    message: 'A PostgreSQL database connection string is required.',
  });
});
