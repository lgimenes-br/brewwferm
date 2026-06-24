import mysql from 'mysql2/promise';

async function run() {
  const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'breww' });
  try {
      const [rows] = await pool.query('DESCRIBE devices');
      console.log(rows);
  } catch(e) {
      console.error(e);
  }
  process.exit(0);
}
run();
