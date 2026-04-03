import BetterSqlite3 from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface Database {
  get<T>(sql: string, params?: unknown[]): T | undefined;
  all<T>(sql: string, params?: unknown[]): T[];
  run(sql: string, params?: unknown[]): void;
  close(): void;
  readonly instance: BetterSqlite3.Database;
}

export function createDatabase(dbPath?: string): Database {
  const resolvedPath =
    dbPath ??
    join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'database.db');
  const db = new BetterSqlite3(resolvedPath);

  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');

  initSchema(db);

  return {
    get<T>(sql: string, params: unknown[] = []): T | undefined {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    all<T>(sql: string, params: unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    run(sql: string, params: unknown[] = []): void {
      db.prepare(sql).run(...params);
    },
    close(): void {
      db.close();
    },
    get instance() {
      return db;
    },
  };
}

function initSchema(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS grants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grant_type TEXT,
      authority TEXT,
      budget TEXT,
      status TEXT,
      open_date TEXT,
      close_date TEXT,
      description TEXT,
      eligible_applicants TEXT,
      match_funding_pct INTEGER,
      max_grant_value REAL,
      jurisdiction TEXT NOT NULL DEFAULT 'GB'
    );

    CREATE TABLE IF NOT EXISTS grant_items (
      id TEXT PRIMARY KEY,
      grant_id TEXT REFERENCES grants(id),
      item_code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      specification TEXT,
      grant_value REAL,
      grant_unit TEXT,
      category TEXT,
      score INTEGER,
      jurisdiction TEXT NOT NULL DEFAULT 'GB'
    );

    CREATE TABLE IF NOT EXISTS stacking_rules (
      id INTEGER PRIMARY KEY,
      grant_a TEXT REFERENCES grants(id),
      grant_b TEXT REFERENCES grants(id),
      compatible INTEGER NOT NULL,
      conditions TEXT,
      jurisdiction TEXT NOT NULL DEFAULT 'GB'
    );

    CREATE TABLE IF NOT EXISTS application_guidance (
      id INTEGER PRIMARY KEY,
      grant_id TEXT REFERENCES grants(id),
      step_order INTEGER,
      description TEXT NOT NULL,
      evidence_required TEXT,
      portal TEXT,
      jurisdiction TEXT NOT NULL DEFAULT 'GB'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      title, body, grant_type, jurisdiction
    );

    CREATE TABLE IF NOT EXISTS db_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO db_metadata (key, value) VALUES ('schema_version', '1.0');
    INSERT OR IGNORE INTO db_metadata (key, value) VALUES ('mcp_name', 'UK Farm Grants MCP');
    INSERT OR IGNORE INTO db_metadata (key, value) VALUES ('jurisdiction', 'GB');
  `);
}

export function ftsSearch(
  db: Database,
  query: string,
  limit: number = 20
): { title: string; body: string; grant_type: string; jurisdiction: string; rank: number }[] {
  return db.all(
    `SELECT title, body, grant_type, jurisdiction, rank
     FROM search_index
     WHERE search_index MATCH ?
     ORDER BY rank
     LIMIT ?`,
    [query, limit]
  );
}
