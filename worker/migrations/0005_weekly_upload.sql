CREATE TABLE weekly_uploads (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  reference_date TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','preview','applied')),
  preview_json TEXT,
  baseline_version INTEGER NOT NULL DEFAULT 0,
  baseline_mutation INTEGER NOT NULL DEFAULT 0,
  backed_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  applied_at TEXT
);
CREATE UNIQUE INDEX weekly_upload_once ON weekly_uploads(fingerprint) WHERE status='applied';
CREATE TABLE weekly_upload_chunks (
  upload_id TEXT NOT NULL REFERENCES weekly_uploads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position INTEGER NOT NULL,
  rows_json TEXT NOT NULL,
  PRIMARY KEY(upload_id,type,position)
);
CREATE TABLE weekly_upload_guard (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
