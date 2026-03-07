# 部署到 GitHub Pages

## 1. 推送到 GitHub（在本地执行）

网页已在本机 `web` 目录初始化为 Git 仓库并完成首次提交，你只需在有 **matrix-3d/majiang 写权限** 的账号下执行推送：

```bash
cd /Users/jiaqichen/Documents/majiang/web
git remote -v   # 确认 origin 为 https://github.com/matrix-3d/majiang.git
git push -u origin main
```

若尚未添加远程：

```bash
git remote add origin https://github.com/matrix-3d/majiang.git
git push -u origin main
```

若推送时要求登录，请使用对 **matrix-3d** 有推送权限的 GitHub 账号（或配置 SSH / Personal Access Token）。

---

## 2. 开启 GitHub Pages

1. 打开 **https://github.com/matrix-3d/majiang**
2. 点击 **Settings** → 左侧 **Pages**
3. 在 **Build and deployment** 中：
   - **Source** 选 **Deploy from a branch**
   - **Branch** 选 **main**，文件夹选 **/ (root)**
4. 点击 **Save**

几分钟后访问：**https://matrix-3d.github.io/majiang/**

---

## 3. 之后更新网站

改完网页后在同一目录执行：

```bash
cd /Users/jiaqichen/Documents/majiang/web
git add .
git commit -m "更新说明"
git push
```

Pages 会自动用最新 `main` 分支重新部署。
