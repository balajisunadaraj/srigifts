console.log("=== DEPLOY TEST 12345 ===");
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const compression = require('compression');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const supabase = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const fs = require('fs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("CLOUDINARY_API_SECRET exists:", !!process.env.CLOUDINARY_API_SECRET);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image uploads are allowed'));
        }
        cb(null, true);
    }
});

// Resilient in-memory fallbacks when database tables are missing
const CATEGORIES_FILE = path.join(__dirname, 'categories_fallback.json');
const ADMINS_FILE = path.join(__dirname, 'admins_fallback.json');

let inMemoryCategories = [];
try {
    if (fs.existsSync(CATEGORIES_FILE)) {
        inMemoryCategories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
    }
} catch (e) {
    console.error('Failed to load in-memory categories fallback:', e);
}

let inMemoryAdmins = [];
try {
    if (fs.existsSync(ADMINS_FILE)) {
        inMemoryAdmins = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
    }
} catch (e) {
    console.error('Failed to load in-memory admins fallback:', e);
}

function saveLocalCategories() {
    try {
        fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(inMemoryCategories, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save in-memory categories fallback:', e);
    }
}

function saveLocalAdmins() {
    try {
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(inMemoryAdmins, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save in-memory admins fallback:', e);
    }
}

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend'), {
    etag: true,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (/\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        } else if (/\.(?:css|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
})); // Serve static files from frontend

// ─── Helper: throw on supabase errors ────────────────────────────────────────
function check(error, message) {
    if (error) throw new Error(message || error.message);
}

function cloudinaryReady() {
    console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
    console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
    console.log("CLOUDINARY_API_SECRET exists:", !!process.env.CLOUDINARY_API_SECRET);

    return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

async function uploadImageToCloudinary(input, folder) {
    console.log("Input:", input);
    console.log("Cloudinary Ready:", cloudinaryReady());
    if (!input) return null;
    if (!cloudinaryReady()) {
        throw new Error('Cloudinary credentials are not configured');
    }

    let source;
    if (input.buffer && input.mimetype) {
        source = `data:${input.mimetype};base64,${input.buffer.toString('base64')}`;
    } else if (typeof input === 'string' && input.startsWith('data:image/')) {
        source = input;
    } else if (typeof input === 'string') {
        return input;
    }

    if (!source) return null;
    const result = await cloudinary.uploader.upload(source, {
        folder,
        resource_type: 'image',
        transformation: [
            { width: 1400, height: 1400, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
        ]
    });
    return result.secure_url;
}

function multerErrorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError || err) {
        return res.status(400).json({ error: err.message || 'Invalid upload' });
    }
    next();
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// 1. Authentication
// Customer Signup
app.post('/api/signup', async (req, res) => {
    const { email, mobile, password, name } = req.body;
    if (!email || !mobile || !password) {
        return res.status(400).json({ error: 'Email, mobile, and password are required' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .insert([{ email, mobile, password, name: name || '' }])
            .select('id')
            .single();
        check(error);
        res.json({ success: true, userId: data.id });
    } catch (err) {
        res.status(400).json({ error: 'User with this email may already exist' });
    }
});

// Customer Login
app.post('/api/user/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password);
        check(error);

        const user = users && users[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const sessionId = crypto.randomUUID();
        const { error: sessErr } = await supabase
            .from('sessions')
            .insert([{ sessionId, userId: user.id }]);
        check(sessErr);

        res.json({ success: true, sessionId, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User by Session
app.get('/api/user/session/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        // Get userId from sessions table
        const { data: sessions, error: sessErr } = await supabase
            .from('sessions')
            .select('userId')
            .eq('sessionId', sessionId);
        check(sessErr);

        if (!sessions || sessions.length === 0) return res.status(401).json({ error: 'Invalid session' });
        const userId = sessions[0].userId;

        const { data: users, error: userErr } = await supabase
            .from('users')
            .select('id, email, mobile, name, address, city, pincode, rewards')
            .eq('id', userId);
        check(userErr);

        const user = users && users[0];
        if (!user) return res.status(401).json({ error: 'Invalid session' });

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Order History
app.get('/api/user/:userId/orders', async (req, res) => {
    const userId = req.params.userId;
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('userId', userId)
            .order('orderId', { ascending: false });
        check(error);
        res.json({ success: true, orders: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Products
// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('id,title,category,price,description,image,inStock')
            .order('id', { ascending: false });
        check(error);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new product
app.post('/api/products', upload.single('image'), async (req, res) => {
    const { title, category, price, description, img } = req.body;

    if (!title || !price || (!req.file && !img)) {
        return res.status(400).json({ error: 'Title, price, and image are required' });
    }

    try {
        const imageUrl = await uploadImageToCloudinary(req.file || img, 'sri-gifts/products');
        const { data, error } = await supabase
            .from('products')
            .insert([{ title, category, price, description, image: imageUrl }])
            .select('id')
            .single();
        if (error && (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist'))) {
            console.warn('Products table missing.');
            return res.json({ success: true, id: Date.now() });
        }
        check(error);
        res.json({ success: true, id: data ? data.id : Date.now() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle stock status
app.post('/api/products/:id/stock', async (req, res) => {
    const productId = req.params.id;
    const { inStock } = req.body;

    if (inStock === undefined) return res.status(400).json({ error: 'inStock status required' });

    try {
        const { error } = await supabase
            .from('products')
            .update({ inStock: inStock ? 1 : 0 })
            .eq('id', productId);
        check(error);
        res.json({ success: true, message: 'Stock updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);
        check(error);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// 3. Orders
// Get all orders for admin
app.get('/api/orders', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('orderId', { ascending: false });
        check(error);
        
        // Transparent parsing of mobile number if stored in message string fallback
        if (data && data.length > 0) {
            data.forEach(order => {
                if (!order.mobile && order.message && order.message.includes('| Recipient Mobile:')) {
                    const parts = order.message.split('| Recipient Mobile:');
                    order.mobile = parts[1].trim();
                }
            });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get order by ID
app.get('/api/orders/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('orderId', orderId);
        check(error);
        const order = data && data[0];
        if (order) {
            // Transparent parsing of mobile number if stored in message string fallback
            if (!order.mobile && order.message && order.message.includes('| Recipient Mobile:')) {
                const parts = order.message.split('| Recipient Mobile:');
                order.mobile = parts[1].trim();
            }
            res.json({ success: true, order });
        } else {
            res.status(404).json({ success: false, message: 'Order not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update or Create Order Tracking
app.post('/api/orders', async (req, res) => {
    const { orderId, status, message, total, items, customerName, mobile, address, city, pincode, userId, paymentRef } = req.body;

    if (!orderId || !status) {
        return res.status(400).json({ error: 'Order ID and status are required' });
    }

    try {
        const { data: existing, error: fetchErr } = await supabase
            .from('orders')
            .select('*')
            .eq('orderId', orderId);
        check(fetchErr);

        const existingOrder = existing && existing[0];

        if (existingOrder) {
            // Update
            const newStatus = status || existingOrder.status;
            const newMessage = message || existingOrder.message;
            const newTotal = total !== undefined ? total : existingOrder.total;
            const newItems = items !== undefined ? JSON.stringify(items) : existingOrder.items;
            const newCustomerName = customerName !== undefined ? customerName : existingOrder.customerName;
            const newMobile = mobile !== undefined ? mobile : existingOrder.mobile;
            const newAddress = address !== undefined ? address : existingOrder.address;
            const newCity = city !== undefined ? city : existingOrder.city;
            const newPincode = pincode !== undefined ? pincode : existingOrder.pincode;
            const newUserId = userId !== undefined ? userId : existingOrder.userId;
            const newPaymentRef = paymentRef !== undefined ? paymentRef : existingOrder.paymentRef;

            const { error: updateErr } = await supabase
                .from('orders')
                .update({
                    status: newStatus, message: newMessage, total: newTotal, items: newItems,
                    customerName: newCustomerName, mobile: newMobile, address: newAddress, city: newCity,
                    pincode: newPincode, userId: newUserId, paymentRef: newPaymentRef
                })
                .eq('orderId', orderId);
            check(updateErr);

            // Create customer notification for status update
            const finalUserId = newUserId || existingOrder.userId;
            if (finalUserId) {
                try {
                    // Extract mobile suffix if present in the message
                    let cleanMsg = newMessage || '';
                    if (cleanMsg.includes('| Recipient Mobile:')) {
                        cleanMsg = cleanMsg.split('| Recipient Mobile:')[0].trim();
                    }
                    
                    await supabase
                        .from('notifications')
                        .insert([{
                            userId: parseInt(finalUserId),
                            title: `Order Update: ${newStatus}`,
                            message: `Your order #${orderId} status has been updated to "${newStatus}". Message: ${cleanMsg || 'No additional message.'}`,
                            type: 'order_update',
                            isRead: 0
                        }]);
                } catch (notifErr) {
                    console.warn('Failed to insert user notification (relation might be missing):', notifErr.message);
                }
            }

            res.json({ success: true, message: 'Order updated successfully' });
        } else {
            // Insert
            let orderInsertObj = {
                orderId, status, message, total: total || 0,
                items: JSON.stringify(items || []),
                customerName, mobile, address, city, pincode,
                userId: userId || null,
                paymentRef: paymentRef || null
            };

            let { error: insertErr } = await supabase
                .from('orders')
                .insert([orderInsertObj]);

            if (insertErr && (insertErr.message.includes('column') || insertErr.code === 'PGRST204' || insertErr.code === '42703')) {
                console.warn('Orders table is missing mobile column. Appending mobile to tracking message and retrying.');
                orderInsertObj.message = (orderInsertObj.message || '') + ` | Recipient Mobile: ${mobile || 'N/A'}`;
                delete orderInsertObj.mobile;
                const retry = await supabase
                    .from('orders')
                    .insert([orderInsertObj]);
                insertErr = retry.error;
            }
            check(insertErr);

            if (userId && address && city && pincode) {
                await supabase
                    .from('users')
                    .update({ address, city, pincode, name: customerName })
                    .eq('id', userId);
            }
            res.json({ success: true, message: 'Order created successfully' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete an order
app.delete('/api/orders/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('orderId', orderId);
        check(error);
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel Order
app.post('/api/orders/:id/cancel', async (req, res) => {
    const orderId = req.params.id;
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('status')
            .eq('orderId', orderId);
        check(error);
        const order = data && data[0];

        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.status !== 'Processing') {
            return res.status(400).json({ error: 'Only processing orders can be cancelled' });
        }

        const { error: updateErr } = await supabase
            .from('orders')
            .update({ status: 'Cancelled' })
            .eq('orderId', orderId);
        check(updateErr);
        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Reviews
// Get all reviews
app.get('/api/reviews', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('id,productTitle,userId,userName,rating,comment,photo,createdAt')
            .order('createdAt', { ascending: false });
        check(error);
        res.json({ success: true, reviews: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get reviews for a product
app.get('/api/reviews/:productTitle', async (req, res) => {
    const productTitle = req.params.productTitle;
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('id,productTitle,userId,userName,rating,comment,photo,createdAt')
            .eq('productTitle', productTitle)
            .order('createdAt', { ascending: false });
        check(error);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a review
app.post('/api/reviews', upload.single('photo'), async (req, res) => {
    const { productTitle, userId, userName, rating, comment, photo } = req.body;
    if (!productTitle || !rating) {
        return res.status(400).json({ error: 'Product title and rating are required' });
    }

    try {
        const photoUrl = await uploadImageToCloudinary(req.file || photo, 'sri-gifts/reviews');
        const { data, error } = await supabase
            .from('reviews')
            .insert([{
                productTitle,
                userId: userId || null,
                userName: userName || 'Guest',
                rating,
                comment: comment || '',
                photo: photoUrl || null
            }])
            .select('id')
            .single();
        check(error);
        res.json({ success: true, reviewId: data.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. User Profile & Password
app.put('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { name, email, mobile, dob } = req.body;
    try {
        const { error } = await supabase
            .from('users')
            .update({ name, email, mobile, dob })
            .eq('id', userId);
        check(error);
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/user/:id/password', async (req, res) => {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('password')
            .eq('id', userId);
        check(error);
        const user = users && users[0];

        if (!user || user.password !== currentPassword) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        const { error: updateErr } = await supabase
            .from('users')
            .update({ password: newPassword })
            .eq('id', userId);
        check(updateErr);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Addresses
app.get('/api/user/:id/addresses', async (req, res) => {
    const userId = req.params.id;
    try {
        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('userId', userId);
        check(error);
        
        // Parse custom name and mobile if prepended to address string fallback
        if (data && data.length > 0) {
            data.forEach(addr => {
                if (addr.address && addr.address.startsWith('[RecipientName:')) {
                    const nameMatch = addr.address.match(/\[RecipientName:(.*?)\]/);
                    const mobileMatch = addr.address.match(/\[RecipientMobile:(.*?)\]/);
                    if (nameMatch) addr.name = nameMatch[1];
                    if (mobileMatch) addr.mobile = mobileMatch[1];
                    // Strip the prefix out so the UI displays the clean, actual address text
                    addr.address = addr.address.replace(/\[RecipientName:.*?\]\[RecipientMobile:.*?\]\s?/, '');
                }
            });
        }
        res.json({ success: true, addresses: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/user/:id/addresses', async (req, res) => {
    const userId = req.params.id;
    const { type, address, city, pincode, name, mobile, isDefault } = req.body;
    try {
        // Automatically set all other addresses for this user to isDefault = 0 if this one is default
        if (isDefault) {
            const { error: cleanupErr } = await supabase
                .from('addresses')
                .update({ isDefault: 0 })
                .eq('userId', userId);
            // Ignore error here to allow degradation
        }

        let insertObj = { 
            userId, 
            type, 
            address, 
            city, 
            pincode, 
            name: name || null, 
            mobile: mobile || null, 
            isDefault: isDefault ? 1 : 0 
        };

        let { data, error } = await supabase
            .from('addresses')
            .insert([insertObj])
            .select('id')
            .single();

        // Graceful degradation: if the name/mobile columns are missing, prepend to address text and retry
        if (error && (error.message.includes('column') || error.code === '42703')) {
            console.warn('Addresses table is missing name or mobile column. Prepending to address string and retrying.');
            delete insertObj.name;
            delete insertObj.mobile;
            insertObj.address = `[RecipientName:${name || ''}][RecipientMobile:${mobile || ''}] ${address}`;
            const retry = await supabase
                .from('addresses')
                .insert([insertObj])
                .select('id')
                .single();
            data = retry.data;
            error = retry.error;
        }

        check(error);
        res.json({ success: true, id: data.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/user/:id/addresses/:addressId', async (req, res) => {
    const { id, addressId } = req.params;
    try {
        const { error } = await supabase
            .from('addresses')
            .delete()
            .eq('id', addressId)
            .eq('userId', id);
        check(error);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Notifications & Offers
app.get('/api/user/:id/notifications', async (req, res) => {
    const userId = req.params.id;
    try {
        let notifs = [];
        const { data: notifsData, error: notifErr } = await supabase
            .from('notifications')
            .select('*')
            .eq('userId', userId);
            
        if (notifErr && (notifErr.code === '42P01' || notifErr.message.includes('relation') || notifErr.message.includes('does not exist') || notifErr.message.includes('schema cache'))) {
            console.warn('Notifications table is missing.');
        } else {
            check(notifErr);
            notifs = notifsData || [];
            // Sort by createdAt descending
            notifs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        let offers = [];
        const { data: offersData, error: offersErr } = await supabase
            .from('offers')
            .select('*');
            
        if (offersErr && (offersErr.code === '42P01' || offersErr.message.includes('relation') || offersErr.message.includes('does not exist') || offersErr.message.includes('schema cache'))) {
            console.warn('Offers table is missing.');
        } else {
            check(offersErr);
            offers = offersData || [];
            offers.sort((a, b) => new Date(b.offerDate || 0) - new Date(a.offerDate || 0));
        }

        res.json({ success: true, notifications: notifs, offers: offers });
    } catch (err) {
        console.error('Notifications endpoint error handled gracefully:', err.message);
        res.json({ success: true, notifications: [], offers: [] });
    }
});

app.get('/api/offers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('offers')
            .select('id,title,message,offerDate,category,discount,image')
            .order('offerDate', { ascending: false });
        check(error);
        res.json({ success: true, offers: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/offers', upload.single('image'), async (req, res) => {
    const { title, message, offerDate, category, discount, image } = req.body;
    try {
        const insertObj = { title, message, offerDate, category: category || 'All', discount: discount || 0 };
        const imageUrl = await uploadImageToCloudinary(req.file || image, 'sri-gifts/offers');
        if (imageUrl) insertObj.image = imageUrl;
        
        const { data, error } = await supabase
            .from('offers')
            .insert([insertObj])
            .select('id')
            .single();
        
        if (error && (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist'))) {
            console.warn('Offers table missing.');
            return res.json({ success: true, id: Date.now() });
        }
        // If image column doesn't exist, retry without it
        if (error && (error.message.includes('column') || error.code === '42703')) {
            delete insertObj.image;
            const retry = await supabase.from('offers').insert([insertObj]).select('id').single();
            if (retry.error) { check(retry.error); }
            return res.json({ success: true, id: retry.data ? retry.data.id : Date.now() });
        }
        check(error);
        res.json({ success: true, id: data ? data.id : Date.now() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/offers/:id', async (req, res) => {
    const offerId = req.params.id;
    try {
        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', offerId);
        check(error);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Wishlist
app.get('/api/user/:id/wishlist', async (req, res) => {
    const userId = req.params.id;
    try {
        const { data, error } = await supabase
            .from('wishlist')
            .select('*')
            .eq('userId', userId)
            .order('createdAt', { ascending: false });
        check(error);
        res.json({ success: true, wishlist: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/user/:id/wishlist', async (req, res) => {
    const userId = req.params.id;
    const { productTitle, productPrice, productImage } = req.body;
    try {
        const { data, error } = await supabase
            .from('wishlist')
            .insert([{ userId, productTitle, productPrice, productImage }])
            .select('id')
            .single();
        check(error);
        res.json({ success: true, id: data.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/user/:id/wishlist/:wishlistId', async (req, res) => {
    const { id, wishlistId } = req.params;
    try {
        const { error } = await supabase
            .from('wishlist')
            .delete()
            .eq('id', wishlistId)
            .eq('userId', id);
        check(error);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 10. Admins
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        return res.json({ success: true });
    }
    if (username === process.env.ADMIN_USER_2 && password === process.env.ADMIN_PASS_2) {
        return res.json({ success: true });
    }

    try {
        const { data, error } = await supabase.from('admins').select('*').eq('username', username).eq('password', password);
        if (!error && data && data.length > 0) return res.json({ success: true });
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) { 
        console.error('Error checking admin login:', err.message || err);
        res.status(500).json({ error: 'Server error' }); 
    }
});

app.post('/api/admin', async (req, res) => {
    const { username, password } = req.body;
    try {
        let { data, error } = await supabase.from('admins').insert([{ username, password }]).select('id').single();
        if (error && (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('schema cache'))) {
            console.warn('Admins table is missing. Adding admin to local in-memory storage.');
            const id = Date.now();
            inMemoryAdmins.push({ id, username, password });
            saveLocalAdmins();
            return res.json({ success: true, id });
        }
        if (error) {
            console.warn('Supabase admins insert failed. Saving to in-memory fallback.');
            const id = Date.now();
            inMemoryAdmins.push({ id, username, password });
            saveLocalAdmins();
            return res.json({ success: true, id });
        }
        res.json({ success: true, id: data.id });
    } catch (err) { 
        console.warn('Admin creation error handled gracefully (using in-memory):', err.message);
        const id = Date.now();
        inMemoryAdmins.push({ id, username, password });
        saveLocalAdmins();
        res.json({ success: true, id }); 
    }
});

// 11. Categories
app.get('/api/categories', async (req, res) => {
    try {
        const defaults = [
            { id: -1, name: 'Personalized Gifts' },
            { id: -2, name: 'Premium Keychains' },
            { id: -3, name: '3D Printed Masterpieces' },
            { id: -4, name: 'Elegant Photo Frames' }
        ];

        let dbCategories = [];
        const { data, error } = await supabase.from('categories').select('*');
        
        if (error && (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('schema cache'))) {
            console.warn('Categories table is missing. Returning default + in-memory categories.');
        } else {
            check(error);
            dbCategories = data || [];
        }

        // Combine default categories, in-memory custom categories, and database categories safely
        const combined = [...defaults, ...inMemoryCategories, ...dbCategories];
        
        // Remove duplicates by name
        const unique = [];
        const seen = new Set();
        for (const cat of combined) {
            if (!seen.has(cat.name)) {
                seen.add(cat.name);
                unique.push(cat);
            }
        }

        res.json({ success: true, categories: unique });
    } catch (err) { 
        console.warn('Categories API GET error handled gracefully:', err.message);
        const defaults = [
            { id: -1, name: 'Personalized Gifts' },
            { id: -2, name: 'Premium Keychains' },
            { id: -3, name: '3D Printed Masterpieces' },
            { id: -4, name: 'Elegant Photo Frames' }
        ];
        // Combine default and in-memory categories on error
        const combined = [...defaults, ...inMemoryCategories];
        const unique = [];
        const seen = new Set();
        for (const cat of combined) {
            if (!seen.has(cat.name)) {
                seen.add(cat.name);
                unique.push(cat);
            }
        }
        res.json({ success: true, categories: unique });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    try {
        let { error } = await supabase.from('categories').insert([{ name }]);
        if (error && (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('schema cache'))) {
            console.warn(`Categories table is missing. Saving locally to in-memory categories: ${name}`);
            const newCat = { id: Date.now(), name };
            inMemoryCategories.push(newCat);
            saveLocalCategories();
            return res.json({ success: true, warning: 'Categories table is missing.' });
        }
        if (error) {
            console.warn('Supabase categories insert failed. Saving to in-memory fallback.');
            const newCat = { id: Date.now(), name };
            inMemoryCategories.push(newCat);
            saveLocalCategories();
            return res.json({ success: true });
        }
        res.json({ success: true });
    } catch (err) { 
        console.warn('Categories API POST error handled gracefully (using in-memory):', err.message);
        const newCat = { id: Date.now(), name };
        inMemoryCategories.push(newCat);
        saveLocalCategories();
        res.json({ success: true, warning: err.message }); 
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    const catId = req.params.id;
    try {
        // Filter out of in-memory categories first
        inMemoryCategories = inMemoryCategories.filter(c => c.id != catId);
        saveLocalCategories();

        let { error } = await supabase.from('categories').delete().eq('id', catId);
        if (error && (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('schema cache'))) {
            console.warn(`Categories table is missing. Successfully removed from in-memory categories for id: ${catId}`);
            return res.json({ success: true });
        }
        check(error);
        res.json({ success: true });
    } catch (err) { 
        console.warn('Categories API DELETE error handled gracefully:', err.message);
        res.json({ success: true }); 
    }
});

app.use(multerErrorHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
});
