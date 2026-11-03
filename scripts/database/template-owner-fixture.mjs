// Test owner only: simulate historical corruption so readers must still detect
// it. Product runtime never receives ALTER TABLE or trigger bypass privileges.
export async function mutateTemplateFixture(db, sql, args = []) {
  if (!/^UPDATE bsmoss_views\.template_version SET definition=/i.test(sql)) throw Error('fixture_template_update_only');
  await db.query('ALTER TABLE bsmoss_views.template_version DISABLE TRIGGER immutable_template_version');
  try { return await db.query(sql, args); }
  finally { await db.query('ALTER TABLE bsmoss_views.template_version ENABLE TRIGGER immutable_template_version'); }
}
