import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 服务端口，可通过环境变量覆盖
const PORT = process.env.PORT || 3000;

// 数据目录：笔记以 Markdown 文件形式存放，作品以 JSON 存放
const DATA_DIR = path.join(__dirname, 'data');
// 默认笔记文件夹：把你写好的 .md 文件直接丢进这里即可被网站读取
const NOTES_DIR = path.join(DATA_DIR, 'notes');
// 作品数据文件
const WORKS_FILE = path.join(DATA_DIR, 'works.json');

export { PORT, DATA_DIR, NOTES_DIR, WORKS_FILE, __dirname };