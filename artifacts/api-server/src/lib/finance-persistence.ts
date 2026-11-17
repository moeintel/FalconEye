type QueryResult = { rows: Array<Record<string, unknown>> };
export type FinanceQueryable = {
  query: (text: string, values?: any[]) => Promise<QueryResult>;
};

/** Pure dependency-injected persistence operations; callers provide a verified owner. */
export async function saveFinanceDocument(client: FinanceQueryable, userId: string, document: unknown, revision: number): Promise<
  { kind: "saved"; document: unknown; revision: number } | { kind: "conflict"; revision: number }
> {
  const values = [userId, JSON.stringify(document), revision];
  const saved = revision === 0
    ? await client.query(
      `INSERT INTO falcon_finance_documents (user_id, document, revision)
       VALUES ($1, $2::jsonb, 1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING document, revision`,
      values.slice(0, 2),
    )
    : await client.query(
      `UPDATE falcon_finance_documents
       SET document = $2::jsonb, revision = revision + 1, updated_at = now()
       WHERE user_id = $1 AND revision = $3
       RETURNING document, revision`,
      values,
    );
  if (saved.rows.length) return { kind: "saved", document: saved.rows[0].document, revision: Number(saved.rows[0].revision) };
  const current = await client.query("SELECT revision FROM falcon_finance_documents WHERE user_id = $1", [userId]);
  return { kind: "conflict", revision: current.rows.length ? Number(current.rows[0].revision) : 0 };
}

export async function deleteFinanceDocument(client: FinanceQueryable, userId: string, revision: number): Promise<{ kind: "deleted" } | { kind: "conflict"; revision: number }> {
  const deleted = await client.query("DELETE FROM falcon_finance_documents WHERE user_id = $1 AND revision = $2 RETURNING revision", [userId, revision]);
  if (deleted.rows.length) return { kind: "deleted" };
  const current = await client.query("SELECT revision FROM falcon_finance_documents WHERE user_id = $1", [userId]);
  if (!current.rows.length && revision === 0) return { kind: "deleted" };
  return { kind: "conflict", revision: current.rows.length ? Number(current.rows[0].revision) : 0 };
}
