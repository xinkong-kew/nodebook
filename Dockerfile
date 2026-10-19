# syntax=docker/dockerfile:1
# 后端专用镜像（Node/Express API）
# 构建上下文为 backend/ 目录：cd backend && docker build -t notes-backend .

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 先装依赖，利用构建缓存
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 拷贝后端源码（含 data/ 初始笔记与 works.json）
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]