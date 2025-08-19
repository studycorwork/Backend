// db.js
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '111111',
  database: 'HKNU'
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL 연결 완료');
});

module.exports = db;
