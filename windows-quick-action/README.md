# Windows 资源管理器快速操作：演示模式（Slidev）

这是与 `macos-quick-action` **相同模式、相同原理** 的 Windows 版：可迁移、可重复安装。安装后，在资源管理器中右键 Markdown 文件，选择「演示模式(Slidev)」即可启动。

## 工作原理

1. 安装器在当前用户注册表（`HKCU`）写入 `.md` / `.markdown` 的资源管理器右键菜单，无需管理员权限。
2. 右键菜单调用 `%LOCALAPPDATA%\Slidev\bin\slidev-present.cmd`（经 VBS 隐藏窗口后台启动）。
3. 安装器把 `%LOCALAPPDATA%\Slidev\bin` 加入用户 PATH，提供 `slidev` / `slidev-open` / `slidev-present` 命令。
4. 启动器使用集中式运行时 `%LOCALAPPDATA%\Slidev\runtime`，不污染每个 Markdown 所在目录。
5. 优先使用 3030 端口；若被占用则自动顺延到 3031–4000。同一 Markdown 已在运行则直接打开；不同文件可并行。浏览器连接空闲约 60 秒后自动停服。
6. 首次遇到未安装主题时会自动安装；运行时补丁保证集中式依赖可被 Vite 访问，并保留 Slidev 界面中文化。

## 与 macOS 版的对应关系

| macOS | Windows |
| --- | --- |
| `~/Library/Application Support/Slidev` | `%LOCALAPPDATA%\Slidev` |
| Finder Automator 快速操作 `.workflow` | `HKCU` 资源管理器右键菜单 |
| `slidev-present` / `slidev-open`（bash） | `slidev-present.ps1` / `slidev-open.ps1` + `.cmd` |
| `osascript` 通知 | 托盘气泡通知 |
| `lsof` 端口检测 | `netstat` |
| Homebrew 全局软链 | 用户 PATH + `slidev.cmd` |

## 新电脑安装

要求：Windows 10/11、Node.js 20.12+、npm。

在 PowerShell 中进入本目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

安装脚本会按 `runtime-package-lock.json` 固定版本安装运行时（当前固化 Slidev CLI 52.19.1）。

## 验证

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

也可以右键任意 Slidev Markdown 文件，选择「演示模式(Slidev)」。若菜单未出现，可重启 `explorer.exe` 或重新登录。

## 升级固化版本

先在测试机的运行时目录升级并验证，再把锁文件更新回本目录：

```powershell
cd "$env:LOCALAPPDATA\Slidev\runtime"
npm install --save-exact @slidev/cli@latest @slidev/theme-default@latest @slidev/theme-seriph@latest @slidev/theme-apple-basic@latest
Copy-Item package.json <本仓库>\windows-quick-action\runtime-package.json -Force
Copy-Item package-lock.json <本仓库>\windows-quick-action\runtime-package-lock.json -Force
```

升级后必须运行 `verify.ps1`，因为 Slidev 内部打包文件名可能变化，运行时补丁需要随版本适配。

## 卸载

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1
```

会删除右键菜单、集中式运行时与 PATH 条目，不会删除 Markdown 或本目录。

## 文件说明

- `install.ps1` / `verify.ps1` / `uninstall.ps1`：安装、检查、卸载
- `slidev-present.ps1` + `slidev-present.cmd`：资源管理器友好的后台启动器
- `slidev-open.ps1` + `slidev-open.cmd`：终端前台启动器
- `slidev.cmd`：集中式 `slidev` CLI 入口
- `launch-hidden.vbs`：右键菜单无黑窗、立即返回
- `runtime-package*.json`：可重复安装的依赖清单与锁文件
- `runtime-postinstall.mjs`：集中式运行时的 Vite 路径补丁（Windows 使用 `;` 分隔路径）
- `ensure-pnpm-entry.mjs`：创建 `.pnpm\slidev.mjs` 入口（主题解析用）
- `zh-cn-patch.mjs`：内置界面中文化补丁

## 说明

本包在 macOS 上编写，需在真实 Windows + Node.js 环境执行 `install.ps1` 完成安装与验收。原理与 macOS 版对齐；若右键菜单或通知在个别环境表现异常，优先查 `%TEMP%\slidev-present\` 下的日志。
