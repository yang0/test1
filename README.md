# 中文 Trending 工作台

一个面向在线使用的中文 GitHub Trending 工作台。当前仓库已经接入 Prisma + SQLite、本地 README 缓存、GitHub Trending 多周期抓取，以及本地项目扫描能力。

## 当前路由

- `/`：中文 Trending 仓库列表（支持日 / 周 / 月切换）
- `/repo/[owner]/[name]`：仓库详情页（优先中文 README，支持重新渲染）
- `/projects`：我的项目列表与本地扫描结果

## 本地运行

```bash
npm install
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

## 本地校验

```bash
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run typecheck
npm run test
npm run build
```

## 说明

- Prisma schema 位于 `prisma/schema.prisma`
- 本地默认数据库通过 `.env` 中的 `DATABASE_URL` 指向 SQLite 文件
- 服务逻辑位于 `src/lib/server/`，当前已覆盖 Trending 抓取、README 缓存与翻译，以及本地项目扫描
- 首页会触发 README 预热，覆盖日 / 周 / 月任一周期内出现且带有仓库地址的全部仓库，以降低首次进入详情页的等待时间
