# Antigravity 简体中文汉化

为 Antigravity 桌面应用补充简体中文界面的非官方补丁。当前补丁 **v2.1.0**，内置 **1,236 条词库**，已在 **Windows / Antigravity 2.26.0** 上安装并验证。

[下载补丁](https://github.com/norman8335/antigravity-chinese-localization/releases/latest) · [完整汉化说明](docs/汉化说明.md) · [更新记录](CHANGELOG.md) · [参与翻译](CONTRIBUTING.md)

## 快速安装

1. 安装 Node.js 18 或更新版本，确认终端执行 `node --version` 能显示版本号。
2. 在 Releases 下载 `Antigravity-Chinese-Localization-v2.1.0.zip`，解压到普通文件夹。
3. 保存工作并完全退出 Antigravity，包括系统托盘中的后台进程。
4. 双击 `install_chinese.bat`，看到“汉化已安装”后重新打开 Antigravity。

安装过程使用 Node.js 内置模块，无需执行 `npm install`，补丁自身不下载依赖。请保留解压后的完整文件夹。

| 文件 | 用途 |
| --- | --- |
| `install_chinese.bat` | 安装、更新词库或在应用升级后重新安装 |
| `check_chinese.bat` | 查看应用版本、汉化状态和词库条数 |
| `uninstall_chinese.bat` | 还原当前应用版本的原版归档 |
| `start_chinese.bat` | 默认路径下，应用未运行时先安装再启动；已运行时直接打开 |

非默认路径请在补丁文件夹打开 PowerShell，指定包含 `app.asar` 的 `resources` 目录：

```powershell
node patch.mjs install --resources "D:\Antigravity\resources"
node patch.mjs status --resources "D:\Antigravity\resources"
node patch.mjs restore --resources "D:\Antigravity\resources"
```

## 汉化范围

- 主导航、应用菜单、托盘菜单、设置及说明、权限预设。
- 项目、工作树、对话管理、技能、插件、自动化及文件审查等常用界面。
- 动态加载的界面文字、部分计数标签、占位提示、悬浮提示和无障碍标签。
- 按界面区域保护用户输入、对话正文、Markdown、代码、终端输出、项目名、对话名、文件名和模型名。

这是基于词库和界面结构的补丁，仍可能有未收录的英文。应用改版后也可能需要适配。模型生成内容、第三方网页及嵌入预览不属于翻译范围。仅验证了上述 Windows 版本，其他版本或系统的兼容性尚未验证。

## 备份、升级与还原

安装前会在应用 `resources` 目录创建带版本及摘要的原版备份，并保存 `antigravity-zh-backup.json`。请保留这些文件。重复安装不会重复叠加注入，也不会覆盖同版本的原版备份。

应用自动更新后，先退出应用，再运行一次安装脚本建立新版本备份并恢复汉化。还原时会核对版本与备份校验值，拒绝用旧版备份覆盖新版应用。安装和还原脚本要求应用已退出，不会强制结束进程。

详细操作、常见问题、校验方法见 [汉化说明](docs/汉化说明.md)。

## 源码与验证

核心为 `patch.mjs`、`asar.mjs`、`localization.js` 和 `translations.txt`。仓库与下载包仅包含补丁源码、词库和说明，不包含 Antigravity 程序、原版归档、用户配置或对话数据。

开发验证和打包命令请在仓库源码目录执行；Release 的运行版 ZIP 不包含 `tests/` 和 `scripts/`。

```powershell
# 无第三方依赖：合成归档测试、安装/重复安装/还原/升级测试
node --test tests/archive.test.mjs
node tests/verify-install.mjs

# 界面翻译及内容保护测试：需安装 Playwright，并已安装 Microsoft Edge
npm install --no-save --package-lock=false playwright
node tests/verify.mjs

# 生成可下载的补丁 ZIP 和 SHA-256 校验文件
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1
```

测试只使用本地合成页面和隔离的归档副本，输出保存在被 Git 忽略的 `.test-output/`。也可在测试命令末尾提供自己的原版 `app.asar` 路径进行兼容性验证，详见 [贡献说明](CONTRIBUTING.md)。
