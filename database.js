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
                userId INTEGER,
                paymentRef TEXT
            )`);
            
            // Add paymentRef column to existing orders table
            db.run("ALTER TABLE orders ADD COLUMN paymentRef TEXT", (err) => {
                // Ignore error if column already exists
            });

            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                mobile TEXT NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                address TEXT,
                city TEXT,
                pincode TEXT,
                dob TEXT
            )`);
            
            // Add dob column to existing users table if it doesn't exist
            db.run("ALTER TABLE users ADD COLUMN dob TEXT", (err) => {
                // Ignore error if column already exists
            });

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

            db.run(`CREATE TABLE IF NOT EXISTS addresses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                type TEXT NOT NULL,
                address TEXT NOT NULL,
                city TEXT NOT NULL,
                pincode TEXT NOT NULL,
                isDefault INTEGER DEFAULT 0,
                FOREIGN KEY (userId) REFERENCES users(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT,
                isRead INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS offers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                offerDate TEXT NOT NULL,
                category TEXT,
                discount INTEGER DEFAULT 0
            )`);

            // Add category column to existing offers table if it doesn't exist
            db.run("ALTER TABLE offers ADD COLUMN category TEXT", (err) => {
                // Ignore error if column already exists
            });

            // Add discount column to existing offers table if it doesn't exist
            db.run("ALTER TABLE offers ADD COLUMN discount INTEGER DEFAULT 0", (err) => {
                // Ignore error if column already exists
            });

            // Add photo column to existing reviews table if it doesn't exist
            db.run("ALTER TABLE reviews ADD COLUMN photo TEXT", (err) => {
                // Ignore error if column already exists
            });

            // Add rewards column to existing users table if it doesn't exist
            db.run("ALTER TABLE users ADD COLUMN rewards INTEGER DEFAULT 0", (err) => {
                // Ignore error if column already exists
            });

            db.run(`CREATE TABLE IF NOT EXISTS wishlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                productTitle TEXT NOT NULL,
                productPrice REAL,
                productImage TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(id)
            )`);
        });
    }
});

module.exports = db;
