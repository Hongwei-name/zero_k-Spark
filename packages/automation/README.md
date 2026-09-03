# 自动化适配层

此目录只放目标站点的 Playwright 适配器与页面选择器。业务规则（每日一次、重试上限、审计记录）应放在 `packages/core/`，以便替换页面实现时不影响调度逻辑。

不要将 Cookie、storage state、截图或 Trace 提交到仓库。
