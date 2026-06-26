const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,        // ajusta según tu server
    queueLimit: 0,              // 0 = sin límite
    multipleStatements: false   // más seguro; actívalo SOLO si lo necesitas
});

module.exports = pool;