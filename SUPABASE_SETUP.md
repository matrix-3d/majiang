# 多人计分 — Supabase 配置说明

网页的多用户计分使用 [Supabase](https://supabase.com) 作为后端，支持**登录（用户名/密码）**、**房间内多用户**、**每人只操作自己的积分**、**点击他人头像转积分**。

## 1. 注册并创建项目

1. 打开 [https://supabase.com](https://supabase.com) 注册/登录。
2. 点击 **New project**，选择组织、填写项目名（如 `majiang`）、设置数据库密码，选择区域（可选离你近的）。
3. 等待项目创建完成（约 1 分钟）。

## 2. 开启邮箱登录

1. 左侧打开 **Authentication** → **Providers**，确保 **Email** 已启用。
2. 若希望注册后无需邮件确认即可登录：在 **Email** 中关闭 **Confirm email**（开发或小范围使用时可选）。

## 3. 执行数据库脚本

1. 在 Supabase 控制台左侧打开 **SQL Editor**。
2. 点击 **New query**，将本项目 **web/supabase/schema.sql** 中的全部内容复制粘贴进去。
3. 点击 **Run** 执行，确认无报错。

（可选）若需**多人实时同步**：在 **Database** → **Replication** 中，为表 `room_balances`、`transfer_log` 开启 Realtime。

## 4. 获取 API 信息

1. 左侧打开 **Project Settings**（齿轮图标）→ **API**。
2. 记下：
   - **Project URL**（例如 `https://xxxx.supabase.co`）
   - **Project API keys** 中的 **anon public**（以 `eyJ...` 开头的长字符串）

## 5. 在网页中配置

1. 编辑本站目录下的 **js/supabase-config.js**，将 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 替换为上一步的 Project URL 与 anon public key。
2. 若部署到 GitHub Pages：可把填好的 `supabase-config.js` 一并提交（anon key 可公开），或使用 CI 注入环境变量生成该文件。

## 6. 使用计分功能

1. 打开网页，点击顶部 **多人计分**。
2. **注册/登录**：使用邮箱 + 密码；注册时可填用户名（显示昵称）。
3. **创建房间**：生成 6 位邀请码，复制发给其他人。
4. **加入房间**：其他人登录后输入同一邀请码进入同一房间。
5. **积分**：每人只能操作自己的积分；点击**他人头像**可给 Ta 转积分（从自己账户扣、对方加）。房间内所有人实时看到最新积分与转积分记录。

---

**安全说明**：本项目使用 Supabase Auth（邮箱+密码），积分变更通过服务端函数 `transfer_points` 校验，仅允许从本人账户转出。
