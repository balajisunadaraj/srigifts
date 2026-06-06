require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL or SUPABASE_KEY is missing from .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test the connection
async function checkConnection() {
    try {
        const { error } = await supabase.from('products').select('id').limit(1);
        if (error) throw error;
        console.log('✅ Connected to Supabase successfully.');
    } catch (err) {
        console.error('❌ Error connecting to Supabase:', err.message);
    }
}

checkConnection();

module.exports = supabase;
