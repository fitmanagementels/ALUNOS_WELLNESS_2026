PRAGMA foreign_keys = ON;

CREATE TABLE data_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_date TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('staging','active','superseded','rejected')),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  UNIQUE(reference_date, revision)
);

CREATE TABLE students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  plan_started_on TEXT,
  prescription_on TEXT,
  assessment_on TEXT,
  source_version_id INTEGER NOT NULL REFERENCES data_versions(version_id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL
);

CREATE TABLE contracts (
  contract_key TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  value_cents INTEGER NOT NULL DEFAULT 0,
  current_started_on TEXT,
  expires_on TEXT,
  contract_status TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  modality TEXT NOT NULL DEFAULT '',
  source_version_id INTEGER NOT NULL REFERENCES data_versions(version_id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL
);

CREATE TABLE prescriptions (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  started_on TEXT,
  source_version_id INTEGER NOT NULL REFERENCES data_versions(version_id) ON DELETE RESTRICT
);

CREATE TABLE assessments (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  assessed_on TEXT,
  source_version_id INTEGER NOT NULL REFERENCES data_versions(version_id) ON DELETE RESTRICT
);

CREATE TABLE permanence (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  customer_since TEXT,
  permanence_status TEXT NOT NULL DEFAULT '',
  source_continuity_months INTEGER,
  source_contract_count INTEGER,
  first_seen_on TEXT,
  last_seen_on TEXT,
  present_in_latest_batch INTEGER NOT NULL DEFAULT 0 CHECK(present_in_latest_batch IN (0, 1)),
  source_version_id INTEGER NOT NULL REFERENCES data_versions(version_id) ON DELETE RESTRICT
);

CREATE TABLE permanence_events (
  event_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
  reference_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  previous_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  source_version_id INTEGER NOT NULL REFERENCES data_versions(version_id) ON DELETE RESTRICT,
  recorded_at TEXT NOT NULL
);

CREATE TABLE student_profiles (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  responsible_teacher TEXT NOT NULL DEFAULT '',
  payment_profile TEXT NOT NULL DEFAULT '',
  payment_notes TEXT NOT NULL DEFAULT '',
  general_notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE student_last_teachers (
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  teacher_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY(student_id, teacher_name)
);

CREATE TABLE tag_groups (
  group_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE tags (
  tag_key TEXT PRIMARY KEY,
  group_key TEXT NOT NULL REFERENCES tag_groups(group_key) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  position INTEGER NOT NULL
);

CREATE TABLE student_tags (
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  tag_key TEXT NOT NULL REFERENCES tags(tag_key) ON DELETE RESTRICT,
  PRIMARY KEY(student_id, tag_key)
);

CREATE TABLE leads (
  lead_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT '',
  referral TEXT NOT NULL DEFAULT '',
  first_contact_on TEXT NOT NULL,
  trial_on TEXT,
  trial_teacher TEXT NOT NULL DEFAULT '',
  became_customer_on TEXT,
  status TEXT NOT NULL,
  contracted_plan TEXT NOT NULL DEFAULT '',
  package_value_cents INTEGER,
  sales_report TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE churns (
  churn_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  official_name TEXT NOT NULL,
  official_phone TEXT NOT NULL DEFAULT '',
  official_exit_on TEXT NOT NULL,
  official_contract TEXT NOT NULL DEFAULT '',
  official_value_cents INTEGER,
  official_started_on TEXT,
  official_expires_on TEXT,
  responsible_professional TEXT NOT NULL DEFAULT '',
  last_teacher TEXT NOT NULL DEFAULT '',
  manual_exit_reason TEXT NOT NULL DEFAULT '',
  manual_context TEXT NOT NULL DEFAULT '',
  manual_retention_action TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE new_students (
  entry_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  official_name TEXT NOT NULL,
  official_phone TEXT NOT NULL DEFAULT '',
  official_entry_on TEXT NOT NULL,
  official_contract TEXT NOT NULL DEFAULT '',
  official_value_cents INTEGER,
  source_batch_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  setting_type TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,
  value_json TEXT NOT NULL DEFAULT '{}',
  title TEXT NOT NULL DEFAULT '',
  states_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(setting_type, setting_key)
);

CREATE TABLE import_batches (
  batch_id TEXT PRIMARY KEY,
  import_kind TEXT NOT NULL,
  reference_date TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('staging','ready','active','rejected')),
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE import_files (
  file_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(batch_id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_valid INTEGER NOT NULL DEFAULT 0,
  rows_rejected INTEGER NOT NULL DEFAULT 0,
  UNIQUE(batch_id, file_kind)
);

CREATE TABLE import_rows (
  batch_id TEXT NOT NULL REFERENCES import_batches(batch_id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  student_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  valid INTEGER NOT NULL CHECK(valid IN (0, 1)),
  error_code TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(batch_id, file_kind, row_number)
);

CREATE TABLE import_errors (
  error_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES import_batches(batch_id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL,
  row_number INTEGER,
  error_code TEXT NOT NULL,
  safe_message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE mutation_log (
  request_id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  mutation_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  result_json TEXT NOT NULL
);

CREATE TABLE usage_counters (
  usage_day TEXT NOT NULL,
  metric TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(usage_day, metric)
);
