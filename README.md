# GenCPT Workbench

GenCPT 专属可视化工作台 —— 面向安全测试/渗透测试工程师的 AI 容器与 Kubernetes 渗透测试平台。

## 安装

### 前置依赖

- Node.js >= 20
- pnpm
- opencode CLI
- GenCPT skill 仓库

### 安装 Workbench

git clone 本仓库后：

  cd gencpt-workbench
  pnpm install

### 配置

默认配置在 `config/gencpt-workbench.example.yaml`。Workbench 会自动查找配置文件（从当前目录向上搜索）。

如果 GenCPT 不在自动识别的路径上，可以：

1. 设置环境变量 `GENCPT_HOME=/path/to/gencpt`
2. 或在配置文件中填写 `gencpt.home`
3. 或在设置页面手动选择 GenCPT 目录

### 启动

  cd gencpt-workbench
  pnpm dev

后端默认监听 7090，前端通过 Vite 代理。

## 使用方式

### 启动新 GenCPT 评估

1. 打开 Workbench
2. 进入"启动 / 导入"页面
3. 填写 server、mode（fast/full/custom）、scope、approval
4. 可选填写 source-path 和 baseline
5. 点击启动，跳转到实时执行控制台

### 导入已有 GenCPT session

1. 在 opencode 中运行 GenCPT，生成 /tmp/gencpt-xxx
2. 打开 Workbench
3. 进入"启动 / 导入"页面
4. 在导入 Tab 填写 session 目录路径
5. 点击导入，Workbench 自动归档、解析、展示

### 无目标环境开发

当没有可测试的目标环境时：

- 首页仍然展示 GenCPT 能力资产（skill 数、规则数、攻击模式数、Harness 机制等）
- 工具资产全景页可以查看完整 GenCPT 能力
- 设置页可以检查 GenCPT 完整性
- 可以导入历史 session 进行复盘

## 技术栈

- 前端：Vue 3 + TypeScript + Pinia + ECharts + D3 + xterm.js
- 后端：Node.js + Hono + SQLite + Zod
- 执行：opencode CLI + SSE
- 测试：Vitest + @vue/test-utils