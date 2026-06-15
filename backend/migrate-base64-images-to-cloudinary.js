require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { v2: cloudinary } = require('cloudinary');
const supabase = require('./db');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function assertCloudinaryConfig() {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error('Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET');
    }
}

function isBase64Image(value) {
    return typeof value === 'string' && value.startsWith('data:image/');
}

async function uploadBase64(value, folder) {
    const result = await cloudinary.uploader.upload(value, {
        folder,
        resource_type: 'image',
        transformation: [
            { width: 1400, height: 1400, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
        ]
    });
    return result.secure_url;
}

async function migrateTable({ table, idColumn, imageColumn, folder }) {
    const { data, error } = await supabase
        .from(table)
        .select(`${idColumn},${imageColumn}`);

    if (error) throw error;

    const rows = (data || []).filter(row => isBase64Image(row[imageColumn]));
    console.log(`${table}: found ${rows.length} base64 image(s)`);

    for (const row of rows) {
        const id = row[idColumn];
        try {
            const url = await uploadBase64(row[imageColumn], folder);
            const { error: updateError } = await supabase
                .from(table)
                .update({ [imageColumn]: url })
                .eq(idColumn, id);
            if (updateError) throw updateError;
            console.log(`${table}: migrated ${id}`);
        } catch (err) {
            console.error(`${table}: failed to migrate ${id}: ${err.message}`);
        }
    }
}

async function run() {
    assertCloudinaryConfig();
    await migrateTable({ table: 'products', idColumn: 'id', imageColumn: 'image', folder: 'sri-gifts/products' });
    await migrateTable({ table: 'offers', idColumn: 'id', imageColumn: 'image', folder: 'sri-gifts/offers' });
    await migrateTable({ table: 'reviews', idColumn: 'id', imageColumn: 'photo', folder: 'sri-gifts/reviews' });
    console.log('Migration complete.');
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
