CREATE TABLE production_resource_state (
  resource_name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL CHECK (length(checksum) = 64),
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  updated_at TEXT NOT NULL
);
