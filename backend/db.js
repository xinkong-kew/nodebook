import mysql from 'mysql2/promise';

import { DB } from './config.js';

/**
 * MySQL 连接池：整个进程共用一个，避免每次请求都新建连接。
 * dateStrings: true 让 DATE / DATETIME 直接以字符串返回，
 * 避免 mysql2 把 DATE 转成带时区的 JS Date 导致日期偏移一天。
 */
const pool = mysql.createPool({
  host: DB.host,
  port: DB.port,
  user: DB.user,
  password: DB.password,
  database: DB.database,
  waitForConnections: true,
  connectionLimit: DB.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  dateStrings: true,
  // 云数据库需要 TLS 时才加 ssl 选项
  ssl: DB.ssl ? { minVersion: 'TLSv1.2' } : undefined
});

// 连通性探测：启动自检与 /api/health 使用
async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

const dbInfo = () => `${DB.user}@${DB.host}:${DB.port}/${DB.database}`;

export { pool, ping, dbInfo };