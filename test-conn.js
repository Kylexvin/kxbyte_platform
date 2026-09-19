// test-conn.js
import 'dotenv/config';
import pg from 'pg';
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
client.connect()
  .then(() => client.query('SELECT 1'))
  .then(r => { console.log('OK', r.rows); client.end(); })
  .catch(err => console.error('FAILED', err));