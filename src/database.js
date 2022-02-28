const sqlite3 = require('sqlite3').verbose();

const db_path = './database/database.db';

let db = null;

const getConnection = async () => {
    if (db === null) {
        await new Promise((resolve, reject) => {
            db = new sqlite3.Database(db_path, (err) => {
                if (err) {
                    return reject(err);
                }
                console.log('Connected to the database.');
                resolve();
            });
        });
    }
    return db;
};

const closeConnection = async () => {
    if (db !== null) {
        await new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    return reject(err);
                }
                console.log('Close the database connection.');
                resolve();
            });
        });
    }
};

const select = async (sql, params) => {
    const connection = await getConnection();
    return new Promise((resolve, reject) => {
        connection.all(sql, params, (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
};

const insert = async (table, object) => {
    const connection = await getConnection();
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO ${table}
            (${Object.keys(object).join(', ')})
            VALUES
            (${Object.keys(object).map(() => '?').join(', ')})
        `;
        const params = Object.values(object);
        connection.run(sql, params, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};

const populateDatabase = async () => {
    const sqls = [`
        CREATE TABLE IF NOT EXISTS monitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT,
            url TEXT,
            heart_beat_interval INTEGER,
            min_fail_attemps INTEGER,
            max_redirects INTEGER,
            min_acceptable_status_code INTEGER,
            max_acceptable_status_code INTEGER,
            method TEXT,
            headers TEXT,
            body TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS monitor_heart_beats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monitor_id INTEGER,
            status_code INTEGER,
            response_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        `,
        `
        CREATE TABLE IF NOT EXISTS monitor_failures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monitor_id INTEGER,
            status_code INTEGER,
            response_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        `,
    ];

    const connection = await getConnection();
    await new Promise((resolve, reject) => {
        connection.serialize(() => {
            connection.run('BEGIN');
            const promises = sqls.map(sql => new Promise((res, rej) => {
                connection.run(sql, (err) => {
                    if (err) {
                        return rej(err);
                    };
                    res();
                });
            }));
            Promise.all(promises).then(() => {
                connection.run('COMMIT');
                resolve();
            }).catch(reject);
        });
    });
};

module.exports = {
    getConnection,
    closeConnection,
    select,
    insert,
    populateDatabase,
};