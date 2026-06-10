require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function addAdmin() {
    const { data, error } = await supabase.from('admins').insert([{ username: 'admin1', password: 'srigifts@123#' }]);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Admin added successfully.');
    }
}
addAdmin();

