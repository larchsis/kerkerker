# 🚀 Vercel 一键部署指南

## 快速部署（推荐）

### 方式一：直接从 GitHub 部署

1. **推送代码到 GitHub**
   ```bash
   # 在 GitHub 创建新仓库（不要初始化 README）
   # 然后执行以下命令
   git remote add origin https://github.com/yourusername/kerkerker.git
   git branch -M main
   git push -u origin main
   ```

2. **在 Vercel 导入项目**
   - 访问 [vercel.com](https://vercel.com)
   - 点击「New Project」
   - 选择你的 GitHub 仓库
   - 点击「Deploy」

3. **配置完成后**
   - 访问 `https://your-project.vercel.app/admin/settings`
   - 导入预设视频源配置
   - 开始使用！

### 方式二：使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署项目
vercel

# 部署到生产环境
vercel --prod
```

## ⚠️ 重要说明

### SQLite 数据库限制

**Vercel Serverless 环境下 SQLite 的限制**：
- ❌ 文件系统是临时的，每次部署会重置
- ❌ 多个 Serverless 函数无法共享同一数据库文件
- ❌ 配置会在重新部署后丢失

**解决方案**：

#### 方案 1：使用 Vercel KV（推荐生产环境）
```bash
# 安装 Vercel KV
npm install @vercel/kv

# 在 Vercel 项目设置中添加 KV 存储
```

#### 方案 2：使用外部数据库
支持的数据库：
- **PostgreSQL**（推荐）
  - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
  - [Supabase](https://supabase.com/)
  - [Neon](https://neon.tech/)
  
- **MySQL**
  - [PlanetScale](https://planetscale.com/)
  - [Railway](https://railway.app/)

- **MongoDB**
  - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

#### 方案 3：使用 Railway/Render（支持持久化）
这些平台支持持久化存储，SQLite 可以正常工作：
- [Railway](https://railway.app/) - 推荐
- [Render](https://render.com/)
- [Fly.io](https://fly.io/)

## 📝 环境变量配置

在 Vercel 项目设置中添加：

```bash
# 如果使用外部数据库
DATABASE_URL=postgresql://user:password@host:5432/dbname

# 如果需要豆瓣 API 代理
DOUBAN_API_PROXY=https://your-proxy.com
```

## 🔧 自定义域名

1. 在 Vercel 项目设置中选择「Domains」
2. 添加你的域名
3. 按照提示配置 DNS 记录
4. 等待 SSL 证书自动签发

## 📊 性能优化建议

### 1. 启用边缘缓存
```typescript
// 在 API 路由中添加
export const revalidate = 3600; // 1小时
```

### 2. 使用 CDN 加速图片
考虑使用：
- Cloudflare Images
- Cloudinary
- imgix

### 3. 启用 ISR（增量静态再生成）
```typescript
// app/page.tsx
export const revalidate = 600; // 10分钟
```

## 🐛 故障排查

### 部署失败
1. 检查 `package.json` 中的依赖是否完整
2. 确保 Node.js 版本兼容（推荐 20.x）
3. 查看 Vercel 部署日志

### 数据库连接失败
1. 检查环境变量是否正确配置
2. 确保数据库允许 Vercel IP 访问
3. 测试数据库连接字符串

### 视频源无法播放
1. 检查视频源 API 是否可访问
2. 确认在后台管理中正确配置了视频源
3. 尝试切换到其他视频源

## 📱 移动端优化

已内置响应式设计，但建议：
- 启用 Service Worker 缓存
- 使用 WebP 图片格式
- 启用懒加载

## 🔒 安全建议

1. **启用身份验证**
   - 后台管理页面已有基础认证
   - 生产环境建议使用 OAuth

2. **限制 API 调用频率**
   ```typescript
   // 使用 Vercel Rate Limiting
   import { ratelimit } from '@/lib/ratelimit';
   ```

3. **配置 CORS**
   ```typescript
   // 限制允许的来源
   const allowedOrigins = ['https://your-domain.com'];
   ```

## 📈 监控和分析

推荐集成：
- **Vercel Analytics** - 性能监控
- **Sentry** - 错误追踪
- **Google Analytics** - 用户分析

## 🎯 下一步

部署完成后：
1. ✅ 访问 `/admin/settings` 配置视频源
2. ✅ 测试播放功能
3. ✅ 配置自定义域名
4. ✅ 设置监控告警
5. ✅ 备份重要数据

---

需要帮助？[提交 Issue](https://github.com/yourusername/kerkerker/issues)
