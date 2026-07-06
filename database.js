/* ==========================================================================
   ASM MOLFETTA APP - DATABASE LAYER (SQLite3)
   ========================================================================== */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

function getDb() {
    if (!db) {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('❌ Errore apertura database:', err.message);
                process.exit(1);
            }
            console.log('✅ Database SQLite connesso:', DB_PATH);
        });
        // Enable WAL mode for better concurrency
        db.run('PRAGMA journal_mode=WAL;');
        db.run('PRAGMA foreign_keys=ON;');
    }
    return db;
}

function initDb() {
    return new Promise((resolve, reject) => {
        const database = getDb();
        
        database.serialize(() => {
            // Reports table
            database.run(`
                CREATE TABLE IF NOT EXISTS reports (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    category    TEXT NOT NULL,
                    notes       TEXT,
                    latitude    TEXT,
                    longitude   TEXT,
                    address     TEXT,
                    photos      TEXT DEFAULT '[]',
                    status      TEXT NOT NULL DEFAULT 'Nuova',
                    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) return reject(err);
            });

            // Trigger to auto-update updated_at
            database.run(`
                CREATE TRIGGER IF NOT EXISTS update_reports_timestamp
                AFTER UPDATE ON reports
                BEGIN
                    UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END
            `, (err) => {
                if (err) return reject(err);
                console.log('✅ Tabella reports pronta.');
                resolve(database);
            });
        });
    });
}

// Promisify database operations
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        getDb().all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

module.exports = { initDb, dbRun, dbGet, dbAll };
