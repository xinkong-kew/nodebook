-- 笔记网站表结构（仅作品走数据库，笔记仍以 backend/data/notes 下的 .md 文件为准）
-- 一般不用手动执行：npm run db:init 会自动建库并执行本文件。
-- 若要手动执行：mysql -u root -p notes_site < backend/sql/schema.sql

CREATE TABLE IF NOT EXISTS `works` (
  `id`          VARCHAR(64)  NOT NULL COMMENT '作品标识',
  `title`       VARCHAR(255) NOT NULL COMMENT '标题',
  `description` TEXT         NULL COMMENT '简介',
  `cover`       VARCHAR(512) NULL COMMENT '封面图地址',
  `link`        VARCHAR(512) NULL COMMENT '作品链接',
  `tags`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '标签，逗号分隔',
  `status`      VARCHAR(64)  NOT NULL DEFAULT '规划中' COMMENT '状态',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_works_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;