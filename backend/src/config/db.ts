import 'dotenv/config';
import {env} from './env.js';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host : env.HOST,
    user : env.USER,
    password : env.PASSWORD,
    port : env.DB_PORT,
    database : env.DB_NAME,
    timezone : 'Z',
    dateStrings : ['DATE']
});

export default pool;