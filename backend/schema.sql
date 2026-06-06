-- Supabase PostgreSQL Schema for SRI GIFTS

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    image TEXT,
    "inStock" INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
    "orderId" TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    message TEXT,
    total REAL,
    items TEXT,
    "customerName" TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    "userId" INTEGER,
    "paymentRef" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    dob TEXT,
    rewards INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    "sessionId" TEXT PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    "productTitle" TEXT NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    rating INTEGER NOT NULL,
    comment TEXT,
    photo TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    pincode TEXT NOT NULL,
    "isDefault" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    "isRead" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    "offerDate" TEXT NOT NULL,
    category TEXT,
    discount INTEGER DEFAULT 0,
    image TEXT
);

CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "productTitle" TEXT NOT NULL,
    "productPrice" REAL,
    "productImage" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

-- Insert default admin if not exists
INSERT INTO admins (username, password) VALUES ('admin', 'srigifts@123#') ON CONFLICT DO NOTHING;
