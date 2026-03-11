const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = path.join(__dirname, "..", "database.db");

const db = new sqlite3.Database(databasePath, (error) => {
  if (error) {
    console.error("Failed to connect to SQLite database:", error.message);
    return;
  }

  console.log("Connected to SQLite database.");
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      reps_or_time TEXT NOT NULL,
      sets TEXT NOT NULL,
      rest_time TEXT NOT NULL,
      FOREIGN KEY (level_id) REFERENCES levels (id) ON DELETE CASCADE
    )
  `);
});

module.exports = db;
