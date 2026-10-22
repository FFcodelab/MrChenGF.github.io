---
title: 从语雀、飞书发布文章
description: 保持原来的写作习惯，把选好的笔记发布到自己的博客。
tags:
  - 使用指南
---

日常继续在语雀或飞书写作，网站保存准备公开的发布版本。当前流程是**导出、整理、预览、提交**，不会自动读取你的私人知识库。

## 第一步：导出 Markdown

飞书云文档目前支持在文档菜单中选择“下载为 → Markdown”。选择“所有内容”时，图片和附件可能以链接形式保留，需要额外下载到本地。账户或组织权限可能限制导出，以实际菜单为准。

语雀请在文章菜单中检查可用的导出格式，选择 Markdown。本站不要求购买语雀 API 权限，也不依赖付费同步服务。

官方依据：[飞书 Markdown 导出说明](https://www.feishu.cn/content/article/7644456827538820052)。

## 第二步：整理图片和附件

把导出的 `.md` 文件和图片放在同一个目录，或者保留导出时的相对目录结构。正文中的图片应指向本地文件，例如：

```markdown
![实验截图](images/result.png)
```

如果图片仍指向飞书或语雀的下载链接，先下载图片，再把正文中的地址改成本地相对路径。导入脚本默认会拒绝远程图片，避免上线后出现登录要求或链接失效。

## 第三步：导入博客

在博客项目根目录打开终端，执行下面的示例命令。将文件路径、标题和 slug 替换成自己的内容：

```powershell
npm run import-note -- "D:\笔记\我的文章.md" --slug my-first-note --title "我的第一篇技术笔记" --section notes --tags "嵌入式,学习"
```

- `slug` 是稳定的文件名和访问路径，后续改标题时尽量保留它。
- `section` 可以是 `notes`、`research`、`projects` 或 `journal`。
- 脚本会复制本地图片、补充文章属性，并把 `kind` 设为 `article`，使文章进入首页。
- 更新同一篇文章时，使用相同 slug 并增加 `--update`。

## 第四步：预览并发布

```powershell
npm run preview
```

打开终端显示的本地地址，确认图片、代码、表格和链接。

随后在 GitHub Desktop 中确认改动文件，填写提交说明，点击 **Commit**，再点击 **Push origin**。仓库中配置的 GitHub Actions 将检查文章、构建网站并发布。

也可以直接在 GitHub 网页编辑 `content/` 中的文章并提交。图片要一起上传，并保持正文中的相对路径正确。

## 更新与撤下

更新文章时，在原来的语雀或飞书笔记里修改，再导出、导入同一 slug。

给文章增加 `draft: true` 后，网站不会生成这篇文章页面。但公开仓库里的文件和历史记录仍然可见，所以私人草稿与敏感附件不要提交到仓库。

## 自定义网站

| 想改什么 | 对应文件 |
| --- | --- |
| 网站名称、域名、主题颜色 | `quartz.config.ts` |
| 首页文字和栏目卡片 | `quartz/components/HomePage.tsx` |
| 导航入口 | `quartz/components/SiteNavigation.tsx` |
| 样式与手机布局 | `quartz/styles/custom.scss` |
| 个人介绍 | `content/about.md` |
| 自动发布步骤 | `.github/workflows/deploy.yml` |

文章是 Markdown，图片是独立文件；保留整个项目副本即可在本地继续维护。部署失败时可在仓库的 Actions 页面查看失败步骤，不要把失败构建当作发布成功。
