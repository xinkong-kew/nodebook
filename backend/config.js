import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 服务端口，可通过环境变量覆盖
const PORT = process.env.PORT || 3000;

// 笔记数据目录：笔记以 Markdown 文件形式存放（把 .md 文件丢进 notes 目录即可被网站读取）
const DATA_DIR = path.join(__dirname, 'data');
const NOTES_DIR = path.join(DATA_DIR, 'notes');
// 作品的历史数据文件：仅用于一次性导入 MySQL
const WORKS_FILE = path.join(DATA_DIR, 'works.json');

// MySQL 连接配置：全部通过环境变量提供，不要写死在代码里
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'notes_site',
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10)
};

export { PORT, DATA_DIR, NOTES_DIR, WORKS_FILE, DB, __dirname };