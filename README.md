# zero_k-Spark

个人使用的抖音火花维护工具项目骨架，包含服务端自动化框架与独立的 Tampermonkey 用户脚本。当前油猴脚本版本：`1.0.8`。

> 自动化操作可能违反目标平台规则并导致账号风险。仅用于个人账号的辅助操作；请遵守平台规则和当地法律。

## 目录

- `apps/api/`：FastAPI 管理接口与任务调度入口
- `apps/web/`：管理界面预留目录
- `packages/automation/`：Playwright 浏览器自动化实现
- `packages/core/`：配置、数据库模型与通用领域逻辑
- `tampermonkey/`：独立安装的油猴脚本
- `data/`：运行时 SQLite 数据库、截图和 Trace（不提交）
- `deploy/`：Docker、GitHub Actions 和本地计划任务配置
- `docs/`：使用与部署文档
- `tests/`：自动化测试

## 快速开始（服务端骨架）

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
uvicorn apps.api.main:app --reload
```

## 安装油猴脚本

在 Tampermonkey 中新建脚本，将 `tampermonkey/douyin-spark-helper.user.js` 的内容粘贴保存；然后打开抖音网页版私信页面。脚本默认只做定位验证，不会发消息。
