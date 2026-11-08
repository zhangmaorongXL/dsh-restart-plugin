# dsh-restart-plugin

![Platform](https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square)
![DSH plugin](https://img.shields.io/badge/DSH-plugin-4d6bfe?style=flat-square)
![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

> 为 DSH（DeepSeek Harness）桌面端提供应用内「强制重启」：确认后强制结束当前应用，并自动重新启动。

简体中文 | [English](README-EN.md)

## 简介

`dsh-restart-plugin` 是一个同时包含 **Host 端**和 **Web 客户端**的 DSH 插件。它在侧边栏底部注册一个重启按钮；用户确认后，插件通过一个脱离 DSH 进程树的 PowerShell 助手结束当前 DSH 主进程，并使用同一可执行文件路径重新启动应用。

适合以下场景：

- 安装、更新或禁用插件后需要完整重启 DSH；
- 修改了只在启动时读取的配置；
- 界面或任务卡住，希望快速重启；
- 不想手动关闭窗口再重新打开应用。

> **警告**
>
> 这是**强制重启**，不会等待会话保存，也不会优雅关闭正在运行的任务。未保存的会话内容、正在执行的 Agent 任务和工具调用都可能被中断。

## 功能特性

- **侧边栏入口**：注册在 `sidebar.footer.action` 插槽，默认 `order: 10`。
- **自适应布局**：侧边栏展开时显示图标和 `Restart` 文案；收起时只显示 `⟳` 图标。
- **二次确认**：点击后弹出确认框，明确提示会中断所有未保存内容和运行中任务。
- **即时反馈**：请求发出后按钮进入禁用状态并显示 `Restarting...`，避免重复点击。
- **快速响应**：Host 先返回 `200`，再异步执行重启，避免前端因连接断开而报错。
- **脱离进程树**：通过 WMI 创建隐藏的 PowerShell 进程，使重启助手在 DSH 被结束后仍能继续工作并拉起新实例。
- **自动清理**：临时 PowerShell 脚本执行完毕后会删除自身。
- **零构建**：源码直接以 ESM 和浏览器模块形式加载，无需编译步骤。

## 工作原理

1. 用户点击侧边栏底部的 `⟳` 按钮并确认。
2. 客户端向 `POST /dsh-restart-plugin/force-restart` 发送请求。
3. Host 端路由立即返回 `200 {"ok":true,"message":"Restarting..."}`。
4. Host 在系统临时目录写入 `dsh-force-restart-<timestamp>.ps1`。
5. Host 通过 WMI `Win32_Process.Create` 以隐藏窗口方式启动 PowerShell 助手；该进程不属于 DSH 的进程树。
6. 助手等待 800 ms，查找主窗口标题包含 `DeepSeek Harness` 的进程。
7. 找到后记录其可执行文件路径，强制结束该进程，等待 1 s，再用原路径启动应用。
8. 助手删除临时脚本；DSH 重新启动。

```text
侧边栏按钮
  │ POST /dsh-restart-plugin/force-restart
  ▼
DSH Host 路由 ── 立即返回 200 ──▶ 客户端进入 Restarting...
  │
  │ WMI（脱离 DSH 进程树）
  ▼
PowerShell 助手
  │ 等待 800 ms → 结束 DSH → 等待 1 s
  ▼
重新启动 DeepSeek Harness.exe
```

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包元数据；声明 ESM 入口、Web 客户端入口，以及 `dsh.bundle.patch` |
| `index.js` | Host 半身：注册强制重启 HTTP 路由，并启动 PowerShell 重启助手 |
| `client.js` | Web 客户端半身：在侧边栏底部注册按钮，负责确认、请求和忙碌状态 |
| `cordis.patch.yml` | Bundle patch：向 DSH 的配置树插入 `dsh-restart-plugin` 条目 |
| `README.md` / `README-EN.md` | 中文 / 英文说明文档 |
| `CHANGELOG.md` | 版本变更记录 |
| `SECURITY.md` | 安全策略与漏洞报告方式 |
| `LICENSE` | MIT 许可证 |
| `.gitignore` / `.gitattributes` | Git 忽略规则与换行规范 |
| `.github/workflows/ci.yml` | GitHub Actions 语法检查与打包校验 |

## 安装

### 环境要求

| 项目 | 要求 |
| --- | --- |
| 操作系统 | Windows（依赖 PowerShell 与 WMI） |
| 应用 | DSH 桌面端（DeepSeek Harness），支持插件 bundle 与 Web 客户端插件 |
| DSH 能力 | `webServer` 服务、`sidebar.footer.action` 插槽 |
| 进程标题 | DSH 主窗口标题需包含 `DeepSeek Harness`，用于定位进程 |
| 参考环境 | Windows + DeepSeek Harness 0.2.2-rc.1 |

### 通过 CLI 安装（推荐）

从 GitHub 安装：

```powershell
dsh plugin --profile desktop add github:zhangmaorongXL/dsh-restart-plugin
```

本地开发时，也可以直接 link 当前目录：

```powershell
dsh plugin --profile desktop add link:E:/path/to/dsh-restart-plugin
```

> `desktop` 是桌面端默认 profile 名称。如果你使用自定义 profile，请替换为实际名称。

然后确认该 profile 的 `package.json` 同时包含依赖和 bundle 条目：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-restart-plugin"
      ]
    }
  },
  "dependencies": {
    "dsh-restart-plugin": "github:zhangmaorongXL/dsh-restart-plugin"
  }
}
```

本地 link 安装时，依赖值应写成 `"link:E:/path/to/dsh-restart-plugin"`。

如果 `dsh.profile.bundles` 中没有 `dsh-restart-plugin`，请手动加入；否则 `cordis.patch.yml` 不会被应用，插件也不会加载。

### 通过插件管理器安装

如果当前 DSH 版本提供本地插件或 bundle 安装入口，也可以直接选择本目录进行安装。安装完成后同样需要确认插件已加入 profile 的 bundle 列表。

### 首次加载

首次安装完成后，请**手动重启一次 DSH**。此时重启按钮尚未加载，因此不能通过按钮完成这一次重启。

安装成功后，侧边栏底部会出现 `⟳` 按钮。

## 使用方法

1. 在 DSH 左侧边栏底部找到 `⟳` 按钮。
2. 点击按钮，在确认框中确认重启。
3. 按钮变为 `Restarting...` 并进入禁用状态。
4. DSH 被强制结束，随后自动重新启动；通常几秒内完成。
5. 如果页面在重启前没有断开，按钮会保持 `Restarting...` 状态，这是预期行为；应用重启后页面会重新加载。

## HTTP 接口

### `POST /dsh-restart-plugin/force-restart`

触发一次强制重启。内置客户端使用 `POST`；路由按精确路径注册，未额外限制 HTTP 方法。

重启流程被接受后，Host 会在结束进程前返回：

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ok":true,"message":"Restarting..."}
```

该接口没有请求体、查询参数或额外返回值。`200` 只表示重启流程已被接受，**不代表**进程一定被成功结束或应用一定被重新拉起。

> 该接口没有独立的鉴权机制，依赖 DSH Web 服务的访问边界。不要把 DSH 的 Web 服务暴露到不可信网络。

## 重要说明与限制

- **会丢失未保存内容**：强制结束进程不会执行正常的退出流程，正在运行的任务会被中断。
- **依赖窗口标题匹配**：助手只处理主窗口标题包含 `DeepSeek Harness` 的进程。若标题不匹配，脚本不会重启应用。
- **只处理一个进程**：匹配到多个候选进程时，只选择第一个。
- **面向桌面端**：在纯命令行 `dsh web` + 浏览器场景中，通常不存在标题为 `DeepSeek Harness` 的桌面窗口，因此不适合依赖此插件重启。
- **权限限制**：如果当前用户权限不足以结束目标进程，`Stop-Process` 可能失败。
- **安全软件拦截**：部分安全软件可能拦截 WMI 创建进程或 PowerShell 脚本，导致重启失败。
- **无配置项**：当前版本不提供超时、标题匹配规则、按钮位置等配置。
- **临时脚本残留**：助手会在执行结束后删除自身；若脚本启动失败，临时目录中可能残留 `dsh-force-restart-*.ps1`。

安全策略与漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 故障排查

| 现象 | 可能原因 | 处理方式 |
| --- | --- | --- |
| 侧边栏没有按钮 | 插件未加载、bundle 未启用、Web 客户端未注册 | 检查 `dsh.profile.bundles` 与依赖，手动重启 DSH，查看 Host 日志 |
| 点击后没有任何反应 | 没有匹配到窗口标题；WMI 或 PowerShell 被拦截 | 确认使用桌面端且窗口标题包含 `DeepSeek Harness`；检查安全软件与 WMI 状态 |
| 应用退出后没有重新出现 | 可执行文件路径失效、权限不足、启动被拦截 | 查看临时脚本与 Host 日志，手动启动 DSH |
| 按钮一直显示 `Restarting...` | 应用没有真正退出，页面连接仍然存在 | 手动关闭并重新打开 DSH；检查是否有权限或安全软件阻止结束进程 |
| 重启后插件仍不可用 | bundle 未加载或插件加载报错 | 查看启动日志，检查 profile 配置与插件依赖 |

Host 端的错误会以 `[dsh-restart-plugin]` 前缀输出到控制台。

## 开发说明

### Host 半身（`index.js`）

- 使用 Cordis 插件结构，导出 `name` 与 `inject: ['webServer']`。
- 在 `apply(ctx)` 内通过 `ctx.inject(['webServer'], ...)` 获取 Web 服务。
- 使用 `webServer.register({ kind: 'exact', path, handler })` 注册精确路由。
- 使用 `wctx.effect(() => dispose, ...)` 在插件卸载时注销路由。
- 通过 `execFile` 启动外层 PowerShell，再由 WMI 创建脱离进程树的隐藏助手。

### 客户端半身（`client.js`）

- 通过 `window.__ModuleLoader__.load` 注册浏览器模块。
- 使用 Host 提供的 `react` 和 `slots` 能力，无需单独打包 React。
- 在 `sidebar.footer.action` 插槽注册按钮，并根据 `wide` 参数切换紧凑/展开样式。
- 请求失败被视为应用即将终止的正常现象，不会重置忙碌状态。

### 可调整点

- 路由路径：`index.js` 中的 `/dsh-restart-plugin/force-restart`
- 进程匹配规则：PowerShell 脚本中的 `*DeepSeek Harness*`
- 重启延迟：脚本中的 `800` 和 `1000` 毫秒
- 按钮位置与顺序：`client.js` 中的插槽名称和 `order`
- 提示文案：`client.js` 中的确认框与按钮文字

修改后无需构建，重新加载插件或重启 DSH 即可生效。

## 版本

- 当前版本：`0.1.0`
- 参考环境：Windows + DeepSeek Harness 桌面端 `0.2.2-rc.1`

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
