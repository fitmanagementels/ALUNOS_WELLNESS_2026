export async function findMutation(db, requestId) {
  return db.prepare('SELECT result_json FROM mutation_log WHERE request_id = ?').bind(requestId).first();
}

export async function commitMutation(db, statements) {
  return db.batch(statements);
}

export function statement(db, sql, ...values) {
  return db.prepare(sql).bind(...values);
}
