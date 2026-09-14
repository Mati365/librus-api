"use strict";
const Database = require("better-sqlite3");

function createDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      login TEXT NOT NULL,
      password_encrypted BLOB NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

function makeAccountsStore(db) {
  const insertStmt = db.prepare(
    "INSERT INTO accounts (label, login, password_encrypted, created_at) VALUES (?, ?, ?, ?)"
  );
  const listStmt = db.prepare("SELECT id, label, login FROM accounts ORDER BY id");
  const getStmt = db.prepare(
    "SELECT id, label, login, password_encrypted FROM accounts WHERE id = ?"
  );
  const deleteStmt = db.prepare("DELETE FROM accounts WHERE id = ?");

  return {
    insert(label, login, passwordEncrypted) {
      const info = insertStmt.run(label, login, passwordEncrypted, new Date().toISOString());
      return Number(info.lastInsertRowid);
    },
    list() {
      return listStmt.all();
    },
    get(id) {
      return getStmt.get(id);
    },
    remove(id) {
      deleteStmt.run(id);
    },
  };
}

module.exports = { createDb, makeAccountsStore };
