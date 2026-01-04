# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Astro 的静态网站模板,使用 TypeScript 和 Tailwind CSS 构建。项目配置为静态站点输出 (`output: 'static'`)。

## 常用命令

### 开发
- `npm run dev` - 启动开发服务器 (访问 http://localhost:4321)
- `npm run build` - 构建生产版本 (包含 `astro check` 类型检查)
- `npm run preview` - 预览构建后的站点
- `npm run check` - 单独运行 Astro 类型检查

### 包管理
- `npm install` - 安装依赖
- `npm add <package>` - 添加依赖

## 项目架构

### 目录结构
- `src/components/` - Astro 组件 (Header, Hero, Features, Footer, CTA, Testimonials)
- `src/layouts/` - 页面布局 (BaseLayout.astro)
- `src/pages/` - 路由页面 (index.astro, about.astro)
- `src/styles/` - 全局样式
- `public/` - 静态资源
- `dist/` - 构建输出目录

### TypeScript 路径别名
项目配置了以下路径别名 (在 `tsconfig.json` 中定义):
- `@/*` -> `./src/*`
- `@/components/*` -> `./src/components/*`
- `@/layouts/*` -> `./src/layouts/*`
- `@/pages/*` -> `./src/pages/*`
- `@/styles/*` -> `./src/styles/*`

### 样式系统
- 使用 Tailwind CSS + Tailwind Typography 插件
- 自定义主题色 `primary` (蓝色系) 和 `gray` 色阶
- 预定义动画: `fade-in`, `slide-up`, `bounce-slow`
- 字体: Inter (sans-serif), JetBrains Mono (mono)

### Astro 集成
- `@astrojs/tailwind` - Tailwind CSS 集成
- `@astrojs/check` - Astro 类型检查工具

### 构建配置
- 输出模式: 静态站点 (`output: 'static'`)
- 构建资源目录: `assets` (在 `astro.config.mjs` 中配置)

### ESA Pages 部署
项目包含 `esa.jsonc` 配置文件,用于 ESA Pages 部署:
- 构建命令: `npm run build`
- 部署目录: `./dist`
