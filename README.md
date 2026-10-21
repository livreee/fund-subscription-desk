# 申购额度测算台

用于查询公募基金当日申购上限，并按组合配置测算可申购金额的轻量工具。

## 功能

- 输入 6 位基金代码，读取基金当日公开申购状态：正常开放、限大额、暂停申购。
- 按模板导入组合明细（Excel/CSV/TXT）：主选基金、主选占比、备选基金、备选占比。
- 计算逻辑：行限额贡献 = 主选最高申购额 ÷ 主选占比 + 备选最高申购额 ÷ 备选占比；组合上限取所有行限额贡献的最大值。
- 数据来自东方财富基金详情页公开内容，仅供交易前核对，实际以销售页面为准。

## 在线访问

- **GitHub Pages 版（纯前端）**：https://livreee.github.io/fund-subscription-desk/
  界面、模板下载、导入与测算均可用；东方财富页面不允许浏览器跨域访问，因此实时额度查询在纯静态托管下不可用。
- **Render 部署版（含实时查询）**：Render 等支持 Python 常驻服务的平台可运行本仓库自带的 `server.py`，由服务端转发东方财富数据，实时额度查询可用。

## Render 一键部署

本仓库已包含 `render.yaml` 蓝图，无需第三方依赖：

1. 打开一键部署链接：https://render.com/deploy?repo=https://github.com/livreee/fund-subscription-desk
2. 登录/注册 Render（免费账号即可），确认创建 Web Service。
3. 运行环境 Python，启动命令 `python server.py`，平台自动注入 `PORT`，无需其他配置。
4. 部署完成后得到形如 `https://<你的服务名>.onrender.com` 的地址，打开即可实时查询。

也可在 Render 面板手动 New → Web Service：Build Command 留空，Start Command 填 `python server.py`。

> 免费档 Web Service 约 15 分钟无访问后休眠，首次访问需等待约 30-60 秒冷启动；数据通过海外服务器访问东方财富，速度可能略慢。

## 本地运行

需要 Python 3.9 及以上（仅使用标准库）：

```bash
python server.py
```

然后访问 http://127.0.0.1:8000 ；Windows 用户也可直接双击 `启动网站.bat`。

## 文件说明

- `index.html`、`styles.css`、`app.js`：页面与前端逻辑（Excel 解析使用 SheetJS CDN）。
- `server.py`：静态服务与东方财富公开数据转发接口 `/api/fund/{6位基金代码}`；读取 `PORT` 环境变量，未设置时本地监听 127.0.0.1:8000，设置时监听 0.0.0.0。
- `render.yaml`：Render 蓝图配置。
- `requirements.txt`：仅使用标准库，无第三方依赖。
- `组合导入模板.csv`：CSV 导入模板，字段为主选基金代码、主选占比、备选基金代码、备选占比；Excel 模板可在页面内一键下载。
- `.github/workflows/pages.yml`：GitHub Pages 自动部署流水线。

数据仅供交易前核对，基金公告和销售机构规则可能实时变化，请以实际下单页面为准。
