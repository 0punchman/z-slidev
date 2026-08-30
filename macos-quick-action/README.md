# macOS Finder 快速操作：演示模式（Slidev）

这是一套可迁移、可重复安装的 Slidev 快捷启动配置。安装后，在 Finder 中右键 Markdown 文件，可从“快速操作”或“服务”中选择“演示模式(Slidev)”。

## 工作原理

1. `演示模式(Slidev).workflow` 注册 Finder 快速操作，只接收 Markdown/文本文件。
2. 快速操作调用 `~/Library/Application Support/Slidev/bin/slidev-present`。
3. 安装器把官方 `slidev-skill` 复制到 `~/.cursor/skills/slidev`，让 Cursor Agent 自动获得官方指导。
4. 安装器创建终端 `slidev` 命令，指向同一套集中式 CLI，不会重复安装。
5. 启动器使用集中式运行时 `~/Library/Application Support/Slidev/runtime`，无需污染每个 Markdown 文件所在目录。
6. 优先使用 3030 端口；若被占用则自动顺延到 3031–4000（Slidev 本身 `strictPort`，不会自行避让）。同一 Markdown 已在运行则直接打开；不同文件可并行。浏览器页面关闭约 60 秒后自动停服。
7. 首次遇到未安装主题时会自动安装；运行时补丁保证集中式依赖可被 Vite 访问，并保留 Slidev 界面中文化。

## 新 Mac 安装

要求：macOS、Node.js 20.12+、npm。建议先执行：

```bash
brew install node
```

然后进入本目录运行：

```bash
./install.sh
```

安装脚本会按 `runtime-package-lock.json` 固定版本安装运行时。目前固化的 Slidev CLI 是 52.19.1。完成后 Finder 会重启一次。

## 验证

```bash
./verify.sh
```

也可以右键任意 Slidev Markdown 文件，选择“快速操作”→“演示模式(Slidev)”。如果菜单没有立即出现，到“系统设置 → 隐私与安全性 → 扩展 → Finder”确认该快速操作已启用。

## 升级固化版本

先在测试机的运行时目录升级并验证，再把 `package.json`、`package-lock.json` 更新回本目录：

```bash
cd "$HOME/Library/Application Support/Slidev/runtime"
npm install --save-exact @slidev/cli@latest @slidev/theme-default@latest @slidev/theme-seriph@latest @slidev/theme-apple-basic@latest
cp package.json /path/to/macos-quick-action/runtime-package.json
cp package-lock.json /path/to/macos-quick-action/runtime-package-lock.json
```

升级后必须运行 `./verify.sh`，因为 Slidev 内部打包文件名可能变化，运行时补丁需要随版本适配。

## 卸载

```bash
./uninstall.sh
```

卸载脚本会删除 Finder 快速操作、集中式运行时及属于它的命令软链接，不会删除 Markdown 文件或本目录中的备份。

## 文件说明

- `install.sh`：新 Mac 一键安装/重装
- `verify.sh`：检查菜单、运行时、补丁和版本
- `uninstall.sh`：完整卸载
- `slidev-skill/`：随安装包固化的官方 Cursor Agent Skill
- `slidev-present`：Finder 友好的后台启动器
- `slidev-open`：终端前台启动器
- `runtime-package*.json`：可重复安装的依赖清单与锁文件
- `runtime-postinstall.mjs`：集中式运行时的 Vite 路径补丁
- `zh-cn-patch.mjs`：内置界面中文化补丁
- `演示模式(Slidev).workflow`：Finder/Automator 快速操作定义
