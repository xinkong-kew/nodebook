# 学习笔记 · 个人网站

一个简洁的个人学习笔记与作品展示网站。笔记以 Markdown 文件保存、按目录组织，浏览器端直接渲染；作品信息存放在 MySQL 中。

在线地址：[www.xinkong.us.ci](https://www.xinkong.us.ci)

## 功能

- **笔记**：按日期/主题分类展示，支持全文搜索、标签筛选、目录跳转、重点内容汇总
- **笔记详情**：左侧日期目录 + 本篇目录可折叠，右侧重点条目点击跳转正文，三栏铺满视口
- **Markdown 渲染**：支持标题、代码块、表格、图片，正文内图片写相对路径即可
- **重点标记**：正文中 `> 重点：xxx` 会自动汇总到右侧栏
- **作品展示**：新增 / 编辑 / 删除作品，数据持久化到 MySQL
- **生产部署**：构建后的前端静态文件由 Node 后端直接托管，只需一个进程 + Nginx 反代

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router 4、Vite 6 |
| 后端 | Node.js（ESM）、Express 4、marked |
| 数据库 | MySQL 8（mysql2 连接池），仅作品模块使用 |
| 部署 | Nginx 反向代理 + systemd 托管，或 Docker |

## 目录结构

```
.
├── backend/                 # 后端（Express API）
│   ├── data/
│   │   ├── notes/           # 笔记目录（Markdown + 图片）
│   │   └── works.json       # 历史作品数据，仅用于导入 MySQL
│   ├── routes/              # 路由：notes.js / works.js
│   ├── services/            # 业务逻辑：noteService.js / workService.js
│   ├── scripts/init-db.js   # 建库建表 + 导入作品
│   ├── sql/schema.sql       # 表结构
│   ├── config.js            # 读取环境变量
│   ├── db.js                # MySQL 连接池
│   └── server.js            # 服务入口，同时托管 frontend/dist
├── frontend/                # 前端（Vue 3 + Vite）
│   └── src/
│       ├── views/           # 首页 / 笔记 / 笔记详情 / 作品
│       ├── components/      # 卡片、弹窗等
│       ├── api/             # 接口封装
│       └── router/          # 路由配置
├── Dockerfile               # 后端镜像
├── start.py                 # 一键启动前后端（开发用）
└── package.json             # 根级脚本
```

## 快速开始

### 环境要求

- Node.js **20.6+**（需要 `--env-file` 支持，推荐 22 LTS）
- MySQL 8（仅作品模块需要；不配数据库时笔记功能仍可用）

### 1. 安装依赖

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. 配置后端环境变量

在 `backend/` 下新建 `.env`：

```ini
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=notes
DB_PASSWORD=your_password
DB_NAME=notes_site
DB_POOL_SIZE=10
# 云数据库需要 TLS 时置为 true，本地 MySQL 保持 false
DB_SSL=false
```

> 值不要加引号，也不要包含 `#`，否则 Node 的 `--env-file` 解析会出错。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端监听端口 |
| `DB_HOST` | `127.0.0.1` | MySQL 地址（本地连接不要写 `localhost`） |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | 数据库账号 |
| `DB_PASSWORD` | 空 | 数据库密码 |
| `DB_NAME` | `notes_site` | 数据库名 |
| `DB_POOL_SIZE` | `10` | 连接池大小 |
| `DB_SSL` | `false` | 是否启用 TLS |

### 3. 初始化数据库（仅首次）

```bash
cd backend
node --env-file=.env scripts/init-db.js
```

会创建数据库、`works` 表，并把 `data/works.json` 中的历史作品导入。

### 4. 启动开发环境

方式一：一键启动（自动装缺失依赖、释放端口、打开浏览器）

```bash
python start.py
```

方式二：使用 npm 脚本

```bash
npm run dev            # 同时启动前后端
npm run dev:backend    # 仅后端 http://localhost:3000
npm run dev:frontend   # 仅前端 http://localhost:5173
```

开发环境下 Vite 会把 `/api` 和 `/note-assets` 代理到 `localhost:3000`。

## 写笔记

### 目录规则

`backend/data/notes/` 下支持任意层级，规则只有一条：**包含 `.md` 文件的文件夹就是一篇笔记，文件夹名即 slug**。

```
backend/data/notes/
├── welcome.md                 # 单文件笔记，slug = welcome
├── STM32/
│   ├── stm32.md               # 文件夹笔记，slug = STM32
│   ├── 10.20/xxx.jpg          # 该笔记的图片
│   └── 10.21/xxx.png
└── 问题/
    └── 问题.md
```

### 元信息（可选）

Markdown 开头可以用 front-matter 指定标题、日期和标签；不写则自动取正文第一个 `#` 标题：

```markdown
---
title: STM32学习笔记
date: 2026-10-21
tags: STM32, 嵌入式
---

正文内容……
```

### 图片

图片与 `.md` 放在同一目录或子目录，正文中用相对路径引用：

```markdown
![芯片简介](./10.20/STM32芯片简介.jpg)
```

后端会把它改写成 `/note-assets/STM32/10.20/STM32芯片简介.jpg` 提供访问。

### 重点标记

单独一行写引用形式即可自动汇总：

```markdown
> 重点：GPIO 输出模式需要配置推挽或开漏
```

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，同时探测 MySQL |
| GET | `/api/notes` | 笔记列表（slug、标题、日期、标签、摘要） |
| GET | `/api/notes/:slug` | 笔记详情（HTML、目录、日期目录、重点） |
| POST | `/api/notes` | 新建笔记 |
| PUT | `/api/notes/:slug` | 修改笔记 |
| DELETE | `/api/notes/:slug` | 删除笔记 |
| GET | `/api/works` | 作品列表 |
| POST | `/api/works` | 新增作品 |
| PUT | `/api/works/:id` | 修改作品 |
| DELETE | `/api/works/:id` | 删除作品 |
| GET | `/note-assets/*` | 笔记目录内的图片资源（仅图片后缀） |

响应统一格式：`{ "ok": true, "data": ... }` 或 `{ "ok": false, "message": "..." }`。

## 生产部署

### 1. 构建前端

```bash
cd frontend
npm install
npm run build
```

产物位于 `frontend/dist`。`frontend/.env.production` 中保持：

```ini
VITE_API_BASE=/api
```

后端启动时若检测到 `frontend/dist`，会直接托管该目录并做 SPA 路由回退，**无需单独的前端服务**。

### 2. 启动后端

```bash
cd backend
node --env-file=.env server.js
```

看到以下输出即成功：

```
[backend] 笔记网站后端已启动: http://localhost:3000
[backend] MySQL 连接正常: notes@127.0.0.1:3306/notes_site
```

### 3. systemd 托管（推荐）

`/etc/systemd/system/notes-site.service`：

```ini
[Unit]
Description=Notes Site Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/backend
EnvironmentFile=/path/to/backend/.env
ExecStart=/usr/bin/node /path/to/backend/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now notes-site
sudo systemctl status notes-site --no-pager
```

> 若 Node 通过 nvm 安装，`ExecStart` 必须写 node 的绝对路径。

### 4. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name example.com;

    root /path/to/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /note-assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> `proxy_pass` 末尾**不要加斜杠**，否则 `/api` 前缀会被剥掉，接口全部 404。

### 5. Docker（可选）

```bash
docker build -t notes-site .
docker run -d --name notes-site -p 3000:3000 --env-file backend/.env notes-site
```

## 常见问题

**接口返回 `接口不存在`**
Nginx 的 `proxy_pass` 带了尾斜杠，或没有配置 `location /api/`。确认 `sudo nginx -T | grep -A5 "location /api"`。

**启动日志 `MySQL 连接失败: Access denied`**
`.env` 没被读取，或账号密码错误。用 `node --env-file=.env -e "console.log(process.env.DB_USER, process.env.DB_PASSWORD)"` 验证；本地 MySQL 的 `DB_HOST` 用 `127.0.0.1` 而非 `localhost`。

**页面白屏**
先看浏览器 Console 与 Network：接口 404/502 属于部署问题；若前端字段缺失导致报错，前端已对 `content`、`tags` 等字段做了空值兜底。

**图片不显示**
确认图片已上传到 `backend/data/notes/<笔记目录>/`，且 Nginx 配置了 `/note-assets/` 反代；后端只放行图片后缀。

**修改后不生效**
后端代码或 `.env` 变更需 `sudo systemctl restart notes-site`；笔记与图片文件无需重启，刷新页面即可；前端改动需重新构建并替换 `dist` 后强刷。
