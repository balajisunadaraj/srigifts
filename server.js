require('dotenv').config();
console.log(process.env.ADMIN_USER);
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for base64 images
app.use(express.static(path.join(__dirname))); // Serve static files (HTML, CSS, JS) from the current directory

// API Routes

// 1. Authentication
// Admin Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    console.log("INPUT:", username, password);
    console.log("ENV:", process.env.ADMIN_USER, process.env.ADMIN_PASS);

    if (
        username === process.env.ADMIN_USER &&
        password === process.env.ADMIN_PASS
    ) {
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});


// Customer Signup
app.post('/api/signup', (req, res) => {
    const { email, mobile, password, name } = req.body;
    if (!email || !mobile || !password) {
        return res.status(400).json({ error: 'Email, mobile, and password are required' });
    }

    db.run('INSERT INTO users (email, mobile, password, name) VALUES (?, ?, ?, ?)', [email, mobile, password, name || ''], function (err) {
        if (err) {
            return res.status(400).json({ error: 'User with this email may already exist' });
        }
        res.json({ success: true, userId: this.lastID });
    });
});

// Customer Login
app.post('/api/user/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const sessionId = crypto.randomUUID();
        db.run('INSERT INTO sessions (sessionId, userId) VALUES (?, ?)', [sessionId, user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, sessionId, user });
        });
    });
});

// Get User by Session
app.get('/api/user/session/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    db.get(`
        SELECT u.id, u.email, u.mobile, u.name, u.address, u.city, u.pincode, u.rewards 
        FROM users u 
        JOIN sessions s ON u.id = s.userId 
        WHERE s.sessionId = ?
    `, [sessionId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid session' });
        res.json({ success: true, user });
    });
});

// Get User Order History
app.get('/api/user/:userId/orders', (req, res) => {
    const userId = req.params.userId;
    db.all('SELECT * FROM orders WHERE userId = ? ORDER BY rowid DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, orders: rows });
    });
});

// 2. Products
// Get all products
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add a new product
app.post('/api/products', (req, res) => {
    const { title, category, price, description, img } = req.body;

    if (!title || !price || !img) {
        return res.status(400).json({ error: 'Title, price, and image are required' });
    }

    const stmt = db.prepare('INSERT INTO products (title, category, price, description, image) VALUES (?, ?, ?, ?, ?)');
    stmt.run([title, category, price, description, img], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, id: this.lastID });
        }
    });
    stmt.finalize();
});

// Toggle stock status
app.post('/api/products/:id/stock', (req, res) => {
    const productId = req.params.id;
    const { inStock } = req.body; // Expects 0 or 1

    if (inStock === undefined) return res.status(400).json({ error: 'inStock status required' });

    db.run('UPDATE products SET inStock = ? WHERE id = ?', [inStock ? 1 : 0, productId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Stock updated' });
    });
});


// 3. Orders
// Get all orders for admin
app.get('/api/orders', (req, res) => {
    db.all('SELECT * FROM orders ORDER BY orderId DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get order by ID
app.get('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    db.get('SELECT * FROM orders WHERE orderId = ?', [orderId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json({ success: true, order: row });
        } else {
            res.status(404).json({ success: false, message: 'Order not found' });
        }
    });
});

// Update or Create Order Tracking
app.post('/api/orders', (req, res) => {
    const { orderId, status, message, total, items, customerName, address, city, pincode, userId, paymentRef } = req.body;

    if (!orderId || !status) {
        return res.status(400).json({ error: 'Order ID and status are required' });
    }

    db.get('SELECT * FROM orders WHERE orderId = ?', [orderId], (err, existingOrder) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existingOrder) {
            // Admin is updating the order
            const newStatus = status || existingOrder.status;
            const newMessage = message || existingOrder.message;
            const newTotal = total !== undefined ? total : existingOrder.total;
            const newItems = items !== undefined ? JSON.stringify(items) : existingOrder.items;
            const newCustomerName = customerName !== undefined ? customerName : existingOrder.customerName;
            const newAddress = address !== undefined ? address : existingOrder.address;
            const newCity = city !== undefined ? city : existingOrder.city;
            const newPincode = pincode !== undefined ? pincode : existingOrder.pincode;
            const newUserId = userId !== undefined ? userId : existingOrder.userId;
            const newPaymentRef = paymentRef !== undefined ? paymentRef : existingOrder.paymentRef;

            const stmt = db.prepare('UPDATE orders SET status=?, message=?, total=?, items=?, customerName=?, address=?, city=?, pincode=?, userId=?, paymentRef=? WHERE orderId=?');
            stmt.run([newStatus, newMessage, newTotal, newItems, newCustomerName, newAddress, newCity, newPincode, newUserId, newPaymentRef, orderId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                
                if (existingOrder.status !== 'Delivered' && newStatus === 'Delivered' && newUserId) {
                    db.run('UPDATE users SET rewards = rewards + 10 WHERE id = ?', [newUserId], function(err) {
                        if (err) console.error("Reward error", err);
                        res.json({ success: true, message: 'Order updated and rewards added' });
                    });
                } else {
                    res.json({ success: true, message: 'Order updated successfully' });
                }
            });
        } else {
            // Customer is creating a new order
            const stmt = db.prepare('INSERT INTO orders (orderId, status, message, total, items, customerName, address, city, pincode, userId, paymentRef) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            stmt.run([orderId, status, message, total || 0, JSON.stringify(items || []), customerName, address, city, pincode, userId || null, paymentRef || null], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                if (userId && address && city && pincode) {
                    db.run('UPDATE users SET address=?, city=?, pincode=?, name=? WHERE id=?', [address, city, pincode, customerName, userId]);
                }
                res.json({ success: true, message: 'Order created successfully' });
            });
        }
    });
});

// Delete an order
app.delete('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    db.run('DELETE FROM orders WHERE orderId = ?', [orderId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Order deleted successfully' });
    });
});

// 4. Reviews
// Get all reviews
app.get('/api/reviews', (req, res) => {
    db.all('SELECT * FROM reviews ORDER BY createdAt DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, reviews: rows });
    });
});

// Get reviews for a product
app.get('/api/reviews/:productTitle', (req, res) => {
    const productTitle = req.params.productTitle;
    db.all('SELECT * FROM reviews WHERE productTitle = ? ORDER BY createdAt DESC', [productTitle], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add a review
app.post('/api/reviews', (req, res) => {
    const { productTitle, userId, userName, rating, comment, photo } = req.body;
    if (!productTitle || !rating) {
        return res.status(400).json({ error: 'Product title and rating are required' });
    }

    const stmt = db.prepare('INSERT INTO reviews (productTitle, userId, userName, rating, comment, photo) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run([productTitle, userId || null, userName || 'Guest', rating, comment || '', photo || null], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ success: true, reviewId: this.lastID });
        }
    });
    stmt.finalize();
});

// 5. User Profile & Password
app.put('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    const { name, email, mobile, dob } = req.body;
    db.run('UPDATE users SET name = ?, email = ?, mobile = ?, dob = ? WHERE id = ?', [name, email, mobile, dob, userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Profile updated successfully' });
    });
});

app.put('/api/user/:id/password', (req, res) => {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;
    
    db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user || user.password !== currentPassword) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }
        
        db.run('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Password updated successfully' });
        });
    });
});

// 6. Addresses
app.get('/api/user/:id/addresses', (req, res) => {
    const userId = req.params.id;
    db.all('SELECT * FROM addresses WHERE userId = ?', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, addresses: rows });
    });
});

app.post('/api/user/:id/addresses', (req, res) => {
    const userId = req.params.id;
    const { type, address, city, pincode, isDefault } = req.body;
    db.run('INSERT INTO addresses (userId, type, address, city, pincode, isDefault) VALUES (?, ?, ?, ?, ?, ?)', 
        [userId, type, address, city, pincode, isDefault ? 1 : 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/user/:id/addresses/:addressId', (req, res) => {
    const { id, addressId } = req.params;
    db.run('DELETE FROM addresses WHERE id = ? AND userId = ?', [addressId, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 7. Notifications & Offers
app.get('/api/user/:id/notifications', (req, res) => {
    const userId = req.params.id;
    // Get user-specific notifications
    db.all('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, notifs) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Also get active offers for today (simple string comparison for YYYY-MM-DD or all if you want to show upcoming)
        // For simplicity, let's fetch all offers and let frontend decide, or fetch today's offers.
        // We will fetch all offers.
        db.all('SELECT * FROM offers ORDER BY offerDate DESC', [], (err, offers) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, notifications: notifs, offers: offers });
        });
    });
});

app.get('/api/offers', (req, res) => {
    db.all('SELECT * FROM offers ORDER BY offerDate DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, offers: rows });
    });
});

app.post('/api/offers', (req, res) => {
    const { title, message, offerDate, category, discount } = req.body;
    db.run('INSERT INTO offers (title, message, offerDate, category, discount) VALUES (?, ?, ?, ?, ?)', [title, message, offerDate, category || 'All', discount || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/offers/:id', (req, res) => {
    const offerId = req.params.id;
    db.run('DELETE FROM offers WHERE id = ?', [offerId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 8. Cancel Order
app.post('/api/orders/:id/cancel', (req, res) => {
    const orderId = req.params.id;
    // Only allow cancelling if status is Processing
    db.get('SELECT status FROM orders WHERE orderId = ?', [orderId], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        if (order.status !== 'Processing') {
            return res.status(400).json({ error: 'Only processing orders can be cancelled' });
        }
        
        db.run('UPDATE orders SET status = ? WHERE orderId = ?', ['Cancelled', orderId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Order cancelled successfully' });
        });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.delete('/api/products/:id', (req, res) => {
    const productId = req.params.id;

    db.run('DELETE FROM products WHERE id = ?', [productId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to delete product' });
        }

        res.json({ success: true });
    });
});

// 9. Wishlist
app.get('/api/user/:id/wishlist', (req, res) => {
    const userId = req.params.id;
    db.all('SELECT * FROM wishlist WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, wishlist: rows });
    });
});

app.post('/api/user/:id/wishlist', (req, res) => {
    const userId = req.params.id;
    const { productTitle, productPrice, productImage } = req.body;
    db.run('INSERT INTO wishlist (userId, productTitle, productPrice, productImage) VALUES (?, ?, ?, ?)', 
        [userId, productTitle, productPrice, productImage], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/user/:id/wishlist/:wishlistId', (req, res) => {
    const { id, wishlistId } = req.params;
    db.run('DELETE FROM wishlist WHERE id = ? AND userId = ?', [wishlistId, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});