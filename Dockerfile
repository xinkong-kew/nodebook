# syntax=docker/dockerfile:1
# 后端专用镜像（Node/Express API）
# 构建上下文：项目根目录（因此下面所有路径都以 backend/ 开头）

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 先装依赖，利用构建缓存
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 拷贝后端源码（含 data/ 初始笔记与 works.json）
COPY backend/ ./

EXPOSE 3000

CMD ["node", "server.js"]