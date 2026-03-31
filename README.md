# ST-World-Book-Assistant

世界书助手插件（SillyTavern 宿主插件）。

---

## 1. 开发与构建

在 `ST-World-Book-Assistant/` 目录执行：

```bash
npm install
```

### 常用命令

```bash
# 生产构建（webpack 单 chunk）
npm run build

# 开发构建
npm run build:dev

# 监听构建
npm run watch

# 类型检查（vue-tsc 专用配置）
npm run typecheck

# Phase 5 自动化烟测
npm run smoke:phase5

# 一键检查：typecheck + build + smoke
npm run check:full
```

---

## 2. 运行时宿主依赖

本项目运行在 SillyTavern 宿主环境，依赖以下能力：

- `window.SillyTavern.getContext()`
- 全局 `toastr`
- 世界书相关宿主 API（读取/替换/导入等）
- `diffUtils.ts` 依赖宿主侧加载的 `diffLines`（CDN 脚本）

> 脱离宿主直接在普通浏览器页面运行时，部分能力不可用（预期行为）。

---

## 3. 架构分层（当前约定）

- `src/store/*`
  - 会话态、持久态、共享状态容器。
- `src/composables/*`
  - 功能域逻辑：世界书切换/文件操作/模式编排/跨书复制/UI 行为等。
- `src/components/*`
  - 展示与交互组件（桌面/移动端面板、弹窗等）。
- `src/App.vue`
  - 宿主生命周期与跨模块编排（保留必要 glue）。

---
