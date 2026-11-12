# 部署到 GitHub Pages

目标仓库：[Lumner/zhixu](https://github.com/Lumner/zhixu)。网站地址：[知序](https://lumner.github.io/zhixu/)。

仓库保存网站源文件，GitHub Actions 负责生成并发布 `dist/`。本地仍可使用根目录的 `index.html` 或 `npm start` 阅读。`dist/` 是生成目录，不提交、不手改。

## 自动发布

部署配置位于 [deploy-pages.yml](.github/workflows/deploy-pages.yml)。推送到 `main` 后按顺序执行：

1. 使用 Node.js 24 安装锁定的构建依赖。
2. 执行 `npm run build`，生成完整静态网站。
3. 执行 `npm test`，检查内容、链接、搜索与课程进度隔离。
4. 上传 `dist/` 并部署到 GitHub Pages。

构建或检查失败时，不发布该次版本。也可在仓库的 [Actions 页面](https://github.com/Lumner/zhixu/actions/workflows/deploy-pages.yml) 中选择 **Run workflow** 手动部署。

首次启用时，仓库的 **Settings → Pages → Build and deployment → Source** 应选择 **GitHub Actions**。

## 更新内容

先完成同一批课程文件，按协作约定统一构建。以下命令在 PowerShell 的网站根目录 `C:\Users\17597\Desktop\tutorial` 执行：

```powershell
npm run build
npm test
git status
```

检查改动后，提交本次准备发布的文件并推送 `main`。不要把 `.env`、凭据、依赖目录或临时缓存加入仓库。部署结果以 Actions 中该次运行和实际网页为准。

网站资源使用相对路径，页面使用哈希路由，支持 `/zhixu/` 子路径，无需配置服务器重写规则。

## 官方资料

核验日期：2026-11-12。

- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages 发布来源设置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Node.js 环境配置动作](https://github.com/actions/setup-node)
