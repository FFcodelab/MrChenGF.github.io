# MrChenGF 的技术博客

网站地址：https://ffcodelab.github.io/MrChenGF.github.io/

基于 Quartz 4.5.2，保留完整源码与 MIT 许可。上游基线：`d25a6eabf96751ffca56f8a8139272def7a65041`。

## 日常发布（推荐）

双击项目中的 **发布笔记.cmd**，在打开的本机助手中选择导出的文件夹／Markdown，或直接粘贴 Markdown，点击 **发布文章**。

标题、摘要、日期、文章地址、图片和 GitHub 提交会自动处理。支持粘贴截图、更新已有文章、预览和检查上线状态。GitHub 登录由 Git 凭据管理器提供，不需要把令牌填进页面。

助手只监听 `127.0.0.1:4179`，不会作为公开网站后台部署。首次缺少依赖时启动器会安装项目依赖。另一台电脑需先准备 Node.js 22、Git 和仓库写入权限。

完整说明见 `content/guides/publishing.md`。命令行方式保留如下。

## 本地使用

需要 Node.js 22 或更新版本。

```powershell
npm ci
npm run preview
```

## 发布笔记

1. 在语雀或飞书导出 Markdown，保存图片为本地相对引用。
2. 执行导入命令：

```powershell
npm run import-note -- "D:\笔记\文章.md" --slug my-note --title "我的文章" --section notes --tags "嵌入式,学习"
```

3. 本地预览，使用 GitHub Desktop 提交并推送。仓库 Actions 自动构建并发布。

更新同一篇文章时保持 slug 不变，增加 `--update`。导入脚本不会自动抓取私人知识库，默认不接受远程图片。文章文件和本地图片才是发布版本。

完整使用说明在 `content/guides/publishing.md`。技术文章与问题分析模板在 `templates/`，该目录不会作为网页发布。

## 文件位置

| 内容 | 文件 |
| --- | --- |
| 文章 | `content/` |
| 图片与附件 | `content/assets/` |
| 网站名称、域名和主题 | `quartz.config.ts` |
| 页面布局 | `quartz.layout.ts` |
| 首页 | `quartz/components/HomePage.tsx` |
| 导航 | `quartz/components/SiteNavigation.tsx` |
| 视觉样式 | `quartz/styles/custom.scss` |
| 自动发布 | `.github/workflows/deploy.yml` |

## 验证与构建

```powershell
npm run validate-content
npm run typecheck
npm run build
npm run verify-site
```

## 安全与备份

公开仓库中的文章、草稿和历史记录都公开，不要提交密码、访问令牌或私人资料。`draft: true` 只是不生成网页，不会隐藏仓库文件。

文章、图片和配置一起备份。发生发布错误时先查看 Actions 的具体失败步骤；如需回退，在 GitHub Desktop 对目标提交执行 Revert 并推送，让自动部署重新发布。

初始“技术文章排版示例”仅用于验证功能，可以在自己的内容准备好后删除。本站不包含虚构的工作经历或项目成果。
