require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function listTables() {
    const tables = ['products', 'orders', 'users', 'sessions', 'reviews', 'addresses', 'notifications', 'offers', 'wishlist', 'categories', 'admins'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        console.log(`${table}: ${error ? '❌ ' + error.message : '✅ OK'}`);
    }
}
listTables();
