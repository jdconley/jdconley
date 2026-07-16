CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('place', 'zip')),
  search_name TEXT NOT NULL CHECK (length(search_name) BETWEEN 1 AND 120),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  state_code TEXT NOT NULL CHECK (length(state_code) = 2),
  zip TEXT CHECK (zip IS NULL OR zip GLOB '[0-9][0-9][0-9][0-9][0-9]'),
  latitude REAL NOT NULL CHECK (latitude BETWEEN 17 AND 72),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  time_zone TEXT NOT NULL CHECK (length(time_zone) BETWEEN 3 AND 64),
  CHECK ((kind = 'zip' AND zip IS NOT NULL) OR (kind = 'place' AND zip IS NULL))
);

CREATE UNIQUE INDEX locations_kind_name_state_zip
  ON locations(kind, search_name, state_code, COALESCE(zip, ''));
CREATE INDEX locations_zip ON locations(zip) WHERE zip IS NOT NULL;
CREATE INDEX locations_name_state ON locations(search_name, state_code);

CREATE VIRTUAL TABLE locations_fts USING fts5(
  search_name,
  display_name,
  state_code,
  zip,
  content = 'locations',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER locations_ai AFTER INSERT ON locations BEGIN
  INSERT INTO locations_fts(rowid, search_name, display_name, state_code, zip)
  VALUES (new.id, new.search_name, new.display_name, new.state_code, new.zip);
END;

CREATE TRIGGER locations_ad AFTER DELETE ON locations BEGIN
  INSERT INTO locations_fts(locations_fts, rowid, search_name, display_name, state_code, zip)
  VALUES ('delete', old.id, old.search_name, old.display_name, old.state_code, old.zip);
END;

CREATE TRIGGER locations_au AFTER UPDATE ON locations BEGIN
  INSERT INTO locations_fts(locations_fts, rowid, search_name, display_name, state_code, zip)
  VALUES ('delete', old.id, old.search_name, old.display_name, old.state_code, old.zip);
  INSERT INTO locations_fts(rowid, search_name, display_name, state_code, zip)
  VALUES (new.id, new.search_name, new.display_name, new.state_code, new.zip);
END;
