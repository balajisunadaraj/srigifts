/**
 * Migration: Add `image` TEXT column to the `offers` table.
 * Run with: node migrate-offers-image.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrate() {
    console.log('🔄 Running migration: add image column to offers table...');

    // Supabase JS client does not expose raw SQL directly with the anon key.
    // We use the rpc route if available, otherwise we check by attempting an insert test.
    // The safest approach: attempt to use the REST API to add the column via a raw query.
    // Since Supabase anon key doesn't allow ALTER TABLE, we'll use the service role via rpc.

    // Try via supabase.rpc if a migration function exists, or try inserting with image field.
    // If that fails, print instructions to run manually.

    // Step 1: Check if column already exists by selecting it
    const { data, error } = await supabase
        .from('offers')
        .select('image')
        .limit(1);

    if (!error) {
        console.log('✅ Column `image` already exists in the `offers` table. No migration needed.');
        process.exit(0);
    }

    if (error && (error.message.includes('column') || error.code === 'PGRST204' || error.code === '42703')) {
        console.log('⚠️  Column `image` does NOT exist yet.');
        console.log('');
        console.log('📋 Please run the following SQL in your Supabase SQL Editor:');
        console.log('   Dashboard → SQL Editor → New Query → Paste and Run:');
        console.log('');
        console.log('   ALTER TABLE offers ADD COLUMN IF NOT EXISTS image TEXT;');
        console.log('');
        console.log('   URL: https://supabase.com/dashboard/project/_/sql');
        console.log('');
        console.log('Once done, offer images will save and display in the storefront slideshow.');
        process.exit(1);
    }

    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
}

migrate();
