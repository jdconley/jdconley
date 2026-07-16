CREATE TABLE supporters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL CHECK(length(first_name) BETWEEN 2 AND 40),
  display_location TEXT NOT NULL CHECK(length(display_location) BETWEEN 2 AND 60),
  ip_hmac TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX supporters_created_at ON supporters(created_at DESC);
