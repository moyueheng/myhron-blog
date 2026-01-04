# Astro 博客使用指南 & 写作 SOP

> 本文档介绍如何使用 Astro + Fuwari 主题搭建和管理博客

---

## 目录

1. [Astro 基础知识](#1-astro-基础知识)
2. [开发环境使用](#2-开发环境使用)
3. [Fuwari 主题配置](#3-fuwari-主题配置)
4. [写博客 SOP](#4-写博客-sop)
5. [Markdown 扩展语法](#5-markdown-扩展语法)
6. [部署指南](#6-部署指南)
7. [常见问题 FAQ](#7-常见问题-faq)

---

## 1. Astro 基础知识

### 1.1 什么是 Astro？

Astro 是一个现代化的静态站点生成器，具有以下特点：

- **零默认 JavaScript**：默认不向浏览器发送任何 JavaScript
- **岛屿架构**：可以按需为特定组件添加交互性
- **框架无关**：支持 React、Vue、Svelte 等多种 UI 框架
- **性能优先**：自动优化图片、CSS 和资源加载
- **内容集合**：类型安全的内容管理系统

### 1.2 项目结构

```
myhron-blog/
├── src/
│   ├── assets/           # 静态资源（图片、字体等）
│   ├── components/       # Astro/Svelte 组件
│   ├── config.ts         # 网站主配置文件 ⭐
│   ├── content/          # 内容集合
│   │   ├── config.ts     # 内容集合配置
│   │   └── posts/        # 博客文章存放位置 ⭐
│   ├── i18n/            # 国际化翻译文件
│   ├── layouts/         # 页面布局
│   ├── pages/           # 路由页面
│   ├── plugins/         # 自定义插件
│   ├── types/           # TypeScript 类型定义
│   └── utils/           # 工具函数
├── public/              # 公共静态资源
├── scripts/             # 构建脚本
│   └── new-post.js     # 创建新文章脚本 ⭐
├── docs/                # 项目文档
├── astro.config.mjs     # Astro 框架配置 ⭐
├── package.json
└── pnpm-lock.yaml
```

### 1.3 核心概念

**组件（.astro 文件）**
```astro
---
// 服务器端代码（在构建时运行）
const title = "Hello";
---
<!-- HTML 模板 -->
<h1>{title}</h1>
<style>
  /* 组件作用域的 CSS */
  h1 { color: blue; }
</style>
```

**页面路由**
- `src/pages/index.astro` → `/`
- `src/pages/about.astro` → `/about`
- `src/pages/blog/[slug].astro` → `/blog/:slug`

**布局**
```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="页面标题">
  <main>页面内容</main>
</Layout>
```

---

## 2. 开发环境使用

### 2.1 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器（推荐）
pnpm dev
# 访问 http://localhost:4321

# 构建生产版本
pnpm build
# 输出到 dist/ 目录

# 预览构建结果
pnpm preview

# 创建新博客文章
pnpm new-post "文章标题"

# 代码格式化
pnpm format

# 代码检查
pnpm check
```

### 2.2 文件监听和热更新

Astro 开发服务器支持：
- 保存文件后自动刷新页面
- CSS 修改即时更新（无需刷新）
- 组件修改热替换（保留页面状态）

### 2.3 开发工具

**推荐 VSCode 扩展**
- Astro - 官方扩展
- Biome - 代码格式化和检查

---

## 3. Fuwari 主题配置

### 3.1 基本配置

编辑 `src/config.ts`：

```typescript
export const siteConfig: SiteConfig = {
  title: "你的博客标题",
  subtitle: "博客副标题",
  lang: "zh_CN",  // 语言代码：zh_CN, en, ja 等
  themeColor: {
    hue: 210,     // 主题色相（0-360）
    fixed: false, // 是否固定主题色
  },
  banner: {
    enable: false,
    src: "assets/images/banner.png",
  },
  toc: {
    enable: true,  // 是否显示文章目录
    depth: 2,      // 目录深度（1-3）
  },
};
```

### 3.2 导航栏配置

```typescript
export const navBarConfig: NavBarConfig = {
  links: [
    LinkPreset.Home,      // 首页
    LinkPreset.Archive,   // 归档
    LinkPreset.About,     // 关于
    {
      name: "GitHub",
      url: "https://github.com/yourname",
      external: true,
    },
  ],
};
```

### 3.3 个人信息配置

```typescript
export const profileConfig: ProfileConfig = {
  avatar: "assets/images/avatar.png",
  name: "你的名字",
  bio: "个人简介",
  links: [
    {
      name: "GitHub",
      icon: "fa6-brands:github",
      url: "https://github.com/yourname",
    },
    {
      name: "Email",
      icon: "fa6-solid:envelope",
      url: "mailto:your@email.com",
    },
  ],
};
```

### 3.4 Astro 配置

编辑 `astro.config.mjs`：

```javascript
export default defineConfig({
  site: 'https://yourdomain.com',  // 你的网站域名
  base: '/',                        // 基础路径
  trailingSlash: 'always',          // URL 是否带尾部斜杠
  // ... 其他配置
});
```

---

## 4. 写博客 SOP

### 4.1 创建新文章

**方法一：使用脚本（推荐）**

```bash
pnpm new-post "文章标题"
```

这会在 `src/content/posts/` 目录下自动创建一个 Markdown 文件。

**方法二：手动创建**

在 `src/content/posts/` 目录下创建 `.md` 或 `.mdx` 文件。

### 4.2 文章 Frontmatter

每个文章必须包含 frontmatter（元数据）：

```yaml
---
title: 文章标题
published: 2025-01-04
description: 这是一篇文章的摘要，会显示在列表页
image: ./cover.jpg  # 可选，文章封面图
tags: [Astro, 前端开发]  # 可选，标签
category: 技术  # 可选，分类
draft: false  # 可选，是否为草稿
lang: zh_CN  # 可选，文章语言
---
```

**字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 文章标题 |
| `published` | ✅ | 发布日期 |
| `description` | ❌ | 文章摘要 |
| `image` | ❌ | 封面图片 |
| `tags` | ❌ | 标签数组 |
| `category` | ❌ | 分类名称 |
| `draft` | ❌ | 草稿标记（true 不发布） |
| `lang` | ❌ | 语言代码 |

### 4.3 图片路径规则

Fuwari 支持三种图片路径方式：

```yaml
---
# 方式 1: 网络图片
image: https://example.com/image.jpg

# 方式 2: public 目录中的图片
image: /images/photo.jpg

# 方式 3: 相对于文章的图片
image: ./assets/cover.jpg
---
```

**建议：** 使用图床服务（如 Cloudflare R2、阿里云 OSS）存储图片，避免大文件提交到仓库。

### 4.4 Markdown 写作规范

**文章结构示例：**

```markdown
---
title: Astro + Fuwari 博客搭建指南
published: 2025-01-04
description: 介绍如何使用 Fuwari 主题快速搭建一个美观的 Astro 博客
tags: [Astro, 博客, 前端开发]
category: 技术教程
---

## 引言

简要介绍文章背景...

## 主要内容

### 第一部分

内容...

### 第二部分

内容...

## 总结

总结全文...
```

**写作建议：**
- 每个段落之间空一行
- 使用语义化的标题结构（h1 → h2 → h3）
- 代码块指定语言：` ```js `
- 图片添加 alt 文本
- 避免过长的段落

### 4.5 文章存放位置

```
src/content/posts/
├── 2025/
│   ├── 01-hello-world.md
│   └── 02-astro-guide.md
├── tech/
│   ├── javascript-tips.md
│   └── css-tricks.md
└── life/
    └── my-diary.md
```

支持使用子目录组织文章，不影响 URL 生成。

### 4.6 草稿功能

创建草稿文章：

```yaml
---
title: 未完成的文章
published: 2025-01-04
draft: true  # 设置为 true
---
```

草稿文章不会在网站显示，直到将 `draft` 改为 `false`。

### 4.7 发布流程

**标准操作流程：**

1. 创建文章
   ```bash
   pnpm new-post "新文章标题"
   ```

2. 编写内容
   ```bash
   code src/content/posts/新文章.md
   ```

3. 本地预览
   ```bash
   pnpm dev
   # 访问 http://localhost:4321
   ```

4. 提交代码
   ```bash
   git add .
   git commit -m "新增文章：文章标题"
   git push
   ```

5. 自动部署
   - 推送到 GitHub 后自动触发部署
   - 几分钟后访问线上网站查看

### 4.8 更新和删除文章

**更新文章：**
1. 找到对应的 `.md` 文件
2. 修改内容
3. 更新 `published` 日期（可选）
4. 提交更改

**删除文章：**
1. 删除对应的 `.md` 文件
2. 提交更改

---

## 5. Markdown 扩展语法

### 5.1 Admonitions（提示框）

Fuwari 支持类似 GitHub 的提示框：

```markdown
> [!NOTE]
> 有用的信息

> [!TIP]
> 实用建议

> [!IMPORTANT]
> 重要信息

> [!WARNING]
> 警告内容

> [!CAUTION]
> 危险操作
```

### 5.2 GitHub 仓库卡片

```markdown
:::github{repo="saicaca/fuwari"}
:::
```

### 5.3 增强代码块

```markdown
\```js title="示例代码" {1-3} showLineNumbers
function hello() {
  console.log('Hello, World!');
  return true;
}
\```
```

### 5.4 数学公式（KaTeX）

**行内公式：**

```markdown
质能方程：$E = mc^2$
```

**块级公式：**

```markdown
$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

### 5.5 图片灯箱

文章中的图片会自动添加灯箱效果，点击可放大查看。

---

## 6. 部署指南

### 6.1 构建生产版本

```bash
pnpm build
```

构建完成后，`dist/` 目录包含所有静态文件。

### 6.2 ESA Pages 部署

本项目使用 ESA Pages 自动部署：

1. 代码推送到 GitHub `main` 分支
2. ESA Pages 自动构建 `dist/` 目录
3. 自动部署上线

**配置文件：** `esa.jsonc`

```json
{
  "name": "myhron-blog",
  "installCommand": "pnpm install",
  "assets": {
    "directory": "./dist"
  }
}
```

### 6.3 其他部署选项

**Vercel**
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

**Netlify**

创建 `netlify.toml`：

```toml
[build]
  command = "pnpm build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

**Cloudflare Pages**

1. 连接 GitHub 仓库
2. 构建命令：`pnpm build`
3. 输出目录：`dist`

---

## 7. 常见问题 FAQ

### 7.1 常见错误

**Q: pnpm install 报错？**

A: 确保使用 Node.js >= 20：
```bash
node --version
```

**Q: 图片无法显示？**

A: 检查图片路径：
- 网络图片：使用完整 URL
- 本地图片：放在 `public/` 目录或文章同目录

**Q: 构建失败？**

A: 检查 Markdown 语法：
- 确保 frontmatter 格式正确
- 检查代码块是否闭合
- 查看错误日志定位问题

**Q: 搜索功能不工作？**

A: 搜索索引在构建时生成：
```bash
pnpm build  # 重新构建
```

### 7.2 性能优化建议

1. **图片优化**
   - 使用 WebP 格式
   - 压缩图片文件大小
   - 使用 CDN 加速

2. **文章优化**
   - 合理使用标签和分类
   - 添加文章摘要
   - 使用封面图提升视觉效果

3. **SEO 优化**
   - 填写完整的 frontmatter
   - 使用语义化的标题结构
   - 添加 meta 描述

### 7.3 进阶定制

**添加自定义页面**

在 `src/pages/` 创建 `.astro` 文件：

```astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="页面标题">
  <main>
    <h1>页面标题</h1>
    <p>页面内容...</p>
  </main>
</Layout>
```

**修改主题颜色**

编辑 `src/config.ts` 中的 `themeColor.hue` 值（0-360）。

**添加自定义 CSS**

创建 `src/styles/custom.css`：

```css
.my-custom-class {
  /* 自定义样式 */
}
```

然后在需要的组件中导入。

---

## 附录：快速参考

### 常用命令

```bash
pnpm dev          # 开发
pnpm build        # 构建
pnpm preview      # 预览
pnpm new-post     # 新建文章
pnpm format       # 格式化
```

### 配置文件

| 文件 | 用途 |
|------|------|
| `src/config.ts` | 网站配置 |
| `astro.config.mjs` | Astro 框架配置 |
| `src/content/config.ts` | 内容集合配置 |

### 内容目录

| 目录 | 用途 |
|------|------|
| `src/content/posts/` | 博客文章 |
| `src/assets/` | 图片等资源 |
| `public/` | 公共静态文件 |

---

## 获取帮助

- **Fuwari GitHub**: https://github.com/saicaca/fuwari
- **Astro 官方文档**: https://docs.astro.build
- **Astro 中文文档**: https://astro.build/zh-cn

---

**最后更新**: 2025-01-04
**主题版本**: Fuwari (Astro 5.13.10)
