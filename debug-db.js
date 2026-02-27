const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection(useSSL) {
    console.log(`Testing with SSL: ${useSSL}`);
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        connectTimeout: 5000
    };

    if (useSSL) {
        config.ssl = { rejectUnauthorized: false };
    }

    try {
        const pool = mysql.createPool(config);
        const [rows] = await pool.execute('SELECT 1 as result');
        console.log(`✅ Success (SSL: ${useSSL}):`, rows);
        await pool.end();
    } catch (err) {
        console.error(`❌ Failed (SSL: ${useSSL}):`, err.message);
    }
}

async function run() {
    await testConnection(true);
    await testConnection(false);
}

run();
