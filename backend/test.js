require('dotenv').config();
const supabase = require('./db');

async function testOrderInsertNoMobile() {
    const orderId = 'SG-' + Math.floor(100000 + Math.random() * 900000);
    const mockOrder = {
        orderId: orderId,
        status: 'Processing',
        message: 'Test order message',
        total: 150.0,
        items: JSON.stringify([{ title: 'Test Product', price: 150 }]),
        customerName: 'Test Customer',
        address: '123 Test St',
        city: 'Test City',
        pincode: '123456',
        userId: null,
        paymentRef: '123456789012'
    };

    console.log('Inserting mock order (no mobile):', mockOrder);
    const { data, error } = await supabase
        .from('orders')
        .insert([mockOrder]);

    if (error) {
        console.error('❌ Insert failed:', error);
    } else {
        console.log('✅ Insert succeeded!', data);
    }
}

testOrderInsertNoMobile();
