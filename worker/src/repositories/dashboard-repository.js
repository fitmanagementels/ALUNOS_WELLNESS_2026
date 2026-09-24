async function all(db, sql) {
  const result = await db.prepare(sql).all();
  return result && Array.isArray(result.results) ? result.results : [];
}

export async function readDashboard(db) {
  const [
    versions, students, contracts, permanence, events, profiles, lastTeachers,
    catalog, studentTags, leads, churns, newStudents, settings, mutations
  ] = await Promise.all([
    all(db, 'SELECT version_id, reference_date, revision, activated_at FROM data_versions WHERE status = \'active\' LIMIT 1'),
    all(db, 'SELECT student_id, name, phone, status, plan_started_on, prescription_on, assessment_on FROM students'),
    all(db, 'SELECT contract_key, student_id, full_name, frequency, value_cents, current_started_on, expires_on, contract_status, location, modality FROM contracts'),
    all(db, 'SELECT student_id, customer_since, permanence_status, source_continuity_months, source_contract_count, first_seen_on, last_seen_on, present_in_latest_batch FROM permanence'),
    all(db, 'SELECT event_id, student_id, reference_date, event_type, field_name, previous_value, new_value, recorded_at FROM permanence_events'),
    all(db, 'SELECT student_id, responsible_teacher, payment_profile, payment_notes, general_notes, updated_at FROM student_profiles'),
    all(db, 'SELECT student_id, teacher_name, position FROM student_last_teachers ORDER BY student_id, position'),
    all(db, 'SELECT type, group_key, catalog_key, title, active, position FROM profile_catalog ORDER BY type, group_key, position, title'),
    all(db, 'SELECT student_id, group_key, title FROM student_tags ORDER BY student_id, group_key, title'),
    all(db, 'SELECT lead_id, name, phone, origin, referral, first_contact_on, trial_on, trial_teacher, became_customer_on, status, contracted_plan, package_value_cents, sales_report, created_at, updated_at FROM leads WHERE archived_at IS NULL'),
    all(db, 'SELECT churn_id, student_id, official_name, official_phone, official_exit_on, responsible_professional, last_teacher, manual_exit_reason, manual_context, manual_retention_action, created_at, updated_at FROM churns WHERE archived_at IS NULL'),
    all(db, 'SELECT entry_id, student_id, official_name, official_phone, official_entry_on, official_contract, official_value_cents FROM new_students'),
    all(db, 'SELECT setting_type, setting_key, active, position, value_json, title, states_json FROM settings'),
    all(db, 'SELECT created_at FROM mutation_log ORDER BY created_at DESC LIMIT 1')
  ]);
  return { versions, students, contracts, permanence, events, profiles, lastTeachers, catalog, studentTags, leads, churns, newStudents, settings, mutations };
}
