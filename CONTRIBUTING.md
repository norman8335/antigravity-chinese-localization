# 参与翻译与验证

以下操作在克隆或下载的仓库源码中进行。Release 的运行版 ZIP 仅用于安装补丁。

## 补充词库

在 `translations.txt` 中添加 `英文|中文`。优先复制实际界面显示的完整英文，保持术语一致，避免用宽泛替换处理正文。不要翻译模型品牌、项目名、文件路径、代码标识或用户自定义内容。

修改后运行以下验证；不要仅为了覆盖更多英文而取消内容保护规则。

## 无依赖验证

需要 Node.js 18 或更新版本。下列命令只在 `.test-output/` 内生成合成归档和备份，不会安装到本机应用：

```powershell
node --check patch.mjs
node --check localization.js
node --test tests/archive.test.mjs
node tests/verify-install.mjs
```

归档测试检查未修改文件、链接、unpacked / executable 标记、SHA-256 完整性信息、重复构建和旧注入迁移。生命周期测试检查重复安装、原版逐字节还原、备份损坏拒绝、跨版本还原拒绝和升级后独立备份。

## 界面验证

需要 Playwright 与本机 Microsoft Edge。Playwright 是开发测试依赖，普通用户安装汉化不需要它。

```powershell
npm install --no-save --package-lock=false playwright
node tests/verify.mjs
```

如果已有 Playwright 模块，可用 `PLAYWRIGHT_PATH` 指向其文件夹。浏览器测试打开临时本地 HTTP 页面，检查动态文案、输入区、正文、代码、终端、名称、图标、iframe 保护和重复注入。截图及报告输出到 `.test-output/`。

可选：在命令末尾传入自己本机的、未经汉化的 `app.asar` 完整路径，验证该版本的归档兼容性。测试会先复制归档或写入独立输出，保留原文件：

```powershell
node tests/verify-install.mjs "D:\Antigravity\resources\app.asar"
node tests/verify.mjs "D:\Antigravity\resources\app.asar"
```

这些副本属于本地测试输出，请勿提交或上传应用归档、备份、配置、真实对话、账号截图或测试日志。

## 打包发布

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1
```

打包脚本采用固定文件清单，在 `dist/` 下生成 ZIP 和 `SHA256SUMS.txt`。ZIP 包含源码、词库、BAT 启动器及中文文档，排除应用文件、开发依赖和测试输出。

提交修改时请说明应用版本、具体界面、原文及译文。涉及保护规则的修改，请补充能复现问题的合成页面用例。
