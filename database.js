const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'sri_gifts.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                price REAL NOT NULL,
                description TEXT,
                image TEXT,
                inStock INTEGER DEFAULT 1
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS orders (
                orderId TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                message TEXT,
                total REAL,
                items TEXT,
                customerName TEXT,
                address TEXT,
                city TEXT,
                pincode TEXT,
                userId INTEGER
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                mobile TEXT NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                address TEXT,
                city TEXT,
                pincode TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                sessionId TEXT PRIMARY KEY,
                userId INTEGER NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                productTitle TEXT NOT NULL,
                userId INTEGER,
                userName TEXT,
                rating INTEGER NOT NULL,
                comment TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }
});

module.exports = db;
