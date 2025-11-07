# 功能清单

## 核心功能

### 1. 影视浏览
- ✅ 影视列表展示（网格布局）
- ✅ 分类筛选（38+分类）
- ✅ 搜索功能
- ✅ 无限滚动加载
- ✅ 影视卡片（封面、标题、标签）
- ✅ 图片懒加载

### 2. 影视播放
- ✅ iframe播放器嵌入
- ✅ 多播放器切换（4个播放器）
- ✅ 剧集列表（支持千集以上）
- ✅ 上一集/下一集快速切换
- ✅ 播放历史记录
- ✅ 播放进度保存

### 3. VOD源管理
- ✅ 多源配置（9个默认源）
- ✅ 源切换
- ✅ 源状态显示
- ✅ localStorage持久化

### 4. 用户界面
- ✅ 响应式设计（移动端/平板/桌面）
- ✅ 深色/浅色模式
- ✅ 侧边栏导航
- ✅ 顶部导航栏
- ✅ 移动端菜单

## 增强功能

### 1. 键盘快捷键
- ✅ ←/→: 上一集/下一集
- ✅ ↑/↓: 上一集/下一集
- ✅ S: 打开设置
- ✅ L: 显示/隐藏选集列表
- ✅ ESC: 返回/关闭

### 2. 播放控制
- ✅ 悬浮控制按钮
- ✅ 设置面板
- ✅ 播放器选择
- ✅ 快捷键说明

### 3. 性能优化
- ✅ useCallback优化
- ✅ 图片懒加载
- ✅ 节流函数
- ✅ 骨架屏加载
- ✅ 代码分割

### 4. 用户体验
- ✅ 加载动画
- ✅ 平滑过渡
- ✅ 错误处理
- ✅ 空状态提示
- ✅ 友好的错误信息

## 技术特性

### 1. Next.js 16
- ✅ App Router
- ✅ Server Components
- ✅ API Routes
- ✅ Image优化
- ✅ 自动代码分割

### 2. TypeScript
- ✅ 完整类型定义
- ✅ 接口定义
- ✅ 类型安全

### 3. Tailwind CSS 4
- ✅ 实用优先的CSS
- ✅ 响应式设计
- ✅ 深色模式支持
- ✅ 自定义主题

### 4. React Hooks
- ✅ useState
- ✅ useEffect
- ✅ useCallback
- ✅ useRef
- ✅ useRouter
- ✅ useParams

## API接口

### 1. 影视列表 (POST /api/drama/list)
**参数:**
- source: VOD源配置
- page: 页码
- limit: 每页数量
- keyword: 搜索关键词（可选）
- type_id: 分类ID（可选）

**响应:**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "list": [...],
    "page": 1,
    "pagecount": 100,
    "total": 62302
  }
}
```

### 2. 影视分类 (POST /api/drama/categories)
**参数:**
- source: VOD源配置

**响应:**
```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "name": "电影片",
      "icon": "fas fa-film"
    }
  ]
}
```

### 3. 影视详情 (POST /api/drama/detail)
**参数:**
- ids: 影视ID
- source: VOD源配置

**响应:**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "id": 23440,
    "name": "爱·回家之开心速递",
    "episodes": [
      {
        "name": "2169",
        "url": "https://..."
      }
    ]
  }
}
```

## 已配置的VOD源

1. **如意资源站** - https://cj.rycjapi.com
2. **茅台资源** - https://caiji.maotaizy.cc
3. **U酷资源网** - https://api.ukuapi.com
4. **暴风资源** - https://bfzyapi.com
5. **360资源** - https://360zy.com
6. **卧龙资源** - https://wolongzyw.com
7. **魔都资源网** - https://caiji.moduzy.net
8. **iKun资源** - https://ikunzy.cc
9. **极速资源** - https://jszyapi.com

## 播放器接口

1. **播放器1** - https://jx.xmflv.com
2. **播放器2** - https://jx.jsonplayer.com
3. **播放器3** - https://jx.m3u8.tv
4. **播放器4** - https://jx.618g.com

## 浏览器支持

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ 移动端Safari
- ✅ 移动端Chrome

## 部署方式

### Vercel (推荐)
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 自建服务器
```bash
npm run build
npm start
```

## 环境变量

无需配置环境变量，所有配置在代码中完成。

## 许可证

MIT License
