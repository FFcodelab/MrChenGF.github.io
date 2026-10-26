---
title: 文章编辑与发布
description: 在可视化后台修改文章，保存后自动更新网站。
tags:
  - 使用指南
---

[打开文章管理后台](https://app.pagescms.org/FFcodelab/MrChenGF.github.io/main/collection/notes)

## 第一次使用

1. 点击 **Sign in with GitHub**，登录自己的 GitHub 账号。
2. 如果提示安装 Pages CMS 的 GitHub App，选择 **Only select repositories**，只勾选 **MrChenGF.github.io**，完成授权。
3. 返回后台，打开 **FFcodelab / MrChenGF.github.io**，分支选择 **main**。

博客的编辑配置已经准备好，不需要填写代码、令牌或配置文件。若提示找不到仓库，先检查授权时是否勾选了这个仓库。

## 修改已发布的文章

1. 在博客文章底部点击 **编辑这篇文章**，或进入后台的 **学习笔记、技术研究、项目、随记**，选择要修改的文章。
2. 在 **正文** 中直接修改文字。选中文字后使用浮动菜单设置加粗、斜体、链接等；在空白段落输入 `/` 打开标题、列表、代码块、表格和图片的插入菜单。
3. 需要调整文章更新时间时，选择 **更新日期**。保持 **暂不公开** 关闭。
4. 点击 **Save（保存）**。文章会保存到仓库，网站随后自动构建和发布；等待[发布进度](https://github.com/FFcodelab/MrChenGF.github.io/actions/workflows/deploy.yml)显示成功，再刷新文章页面。

修改标题不会改变已有文章的网址。正文默认使用可视化编辑方式，不需要学习 Markdown。

## 新建文章与插入图片

在对应分类中点击 **New（新建）**，填写标题和正文，按需要添加标签，然后保存。文件名会自动生成。

在正文的插入菜单中选择图片，上传本地图片或从已有附件中选择。图片会保存到博客仓库，后台会填写引用地址。

## 历史文章的特殊格式

现有文章已转换为富文本格式，原始 Markdown 已备份，文章地址保持不变。后台直接保存富文本，网站自动处理代码、表格和目录，不需要自己转换格式。

旧笔记的红字等特殊样式可能在编辑后变成普通文字。数学公式目前保留公式文本，适合保留或修改原有公式，不提供 Word 式公式工具栏。保存后可打开文章检查阅读效果。

## 其他维护方式

本机发布助手仍可用于导入新的 Markdown 笔记。已经转为富文本的文章请使用上面的管理后台维护。

官方说明：[Pages CMS 登录与接入](https://pagescms.org/docs/quick-start/)、[可视化编辑器](https://pagescms.org/docs/configuration/fields/rich-text/)。
