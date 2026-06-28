# GenCPT Workbench

GenCPT 专属可视化工作台 —— 面向安全测试/渗透测试工程师的 AI 容器与 Kubernetes 渗透测试平台。

## 安装

### 前置依赖

```text
Node.js >= 20
pnpm
opencode CLI（已安装并配置 API key）
GenCPT skill（已安装到 opencode skills 目录）
ssh-manager MCP（opencode 配置 ssh 服务器连接）
```

**不需要编译工具**。better-sqlite3 对 Linux/macOS/Windows x64 提供预编译二进制。如遇到编译报错，需安装 build-essential 和 python3（仅 ARM 或小众平台需要）。

GenCPT 仓库地址：https://github.com/Wgen1995/GenCPT  
将 genct 目录安装到 `~/.config/opencode/skills/gencpt/`

ssh-manager 配置参考：在 `~/.config/opencode/opencode.jsonc` 中添加：
```jsonc
{
  "mcp": {
    "ssh-manager": {
      "type": "local",
      "command": ["npx", "-y", "mcp-ssh-manager"]
    }
  }
}
```

### 安装 Workbench

```bash
git clone https://github.com/Wgen1995/GenCPT-UI.git gencpt-workbench
cd gencpt-workbench
pnpm install
```

如果网络封锁 GitHub 导致 better-sqlite3 安装失败，使用仓库内置的预编译二进制：
```bash
pnpm install --ignore-scripts
pnpm run setup
```

### 配置

Workbench 启动时自动识别 GenCPT 路径。如果未识别，可以：

1. 设置环境变量：`export GENCPT_HOME=/path/to/gencpt`
2. 或打开设置页面手动选择 GenCPT 根目录
3. 或在 `config/gencpt-workbench.example.yaml` 中修改 `gencpt.home`

### 启动

```bash
cd gencpt-workbench
pnpm dev
```

后端 7090，前端 5173。浏览器打开 http://localhost:5173

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