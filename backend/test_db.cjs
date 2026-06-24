const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({ host: 'localhost', user: 'breww', password: 'breww123', database: 'breww' });
  const [rows] = await pool.query('DESCRIBE devices');
  console.log(rows);
  process.exit(0);
}
run();
