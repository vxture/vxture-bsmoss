# 配置管理独立域

对应 [设计231](../30-design/design_bsmoss_231_management-domain.md)。管理业务从门户应用目录中分离，统一从header配置管理icon进入。

## 实现

- portalDomain／portalNavigation明确两个域；业务目录默认只返回业务路由，管理目录显式选择。该目录仍为公开导航，不替代服务端授权。
- 业务launcher仅保留站网监管、分析与报告两栏；管理launcher提供配置管理、任务管理两栏及返回业务。桌面管理侧栏独立，窄屏通过同域launcher导航；状态存储按域区分。
- 管理总览、指标模板、聚合／报告任务均在 `/settings/**`。两个任务目录实际移入settings/operations，修正类型／服务／样式相对引用与登录returnTo。旧任务page只307重定向，无业务逻辑复制。
- 配置管理icon进入 `/settings`；消息抽屉移除任务快捷入口。报告任务打开精确报告版本仍进入业务报告中心，目标按原授权检查。

## 验证与边界

日志使用 tmp/management-domain-{unit,types,build,http,guards,ascii,staged-scan}.log；浏览器证据 artifacts/management-domain-qa，最终提交及运行身份见 artifacts/formal-checkpoints/management-domain.json。

新增导航互斥与路径归属单测、独立路由／旧链接／业务导航HTTP检查。原API授权回归继续执行；没有DDL／Prisma／依赖／服务权限变化，不重复PG与worker制品测试。未新增未实现的管理页面、未接真实来源或执行外部部署。

实际541单测、双层类型、Next生产构建和22HTTP通过。CUA1280×900从业务launcher确认只含业务入口，齿轮进入独立管理侧栏，聚合任务／模板切换成功；390×844管理launcher包含全部管理入口，点击报告任务关闭面板、返回业务应用实际URL为 `/`。390与787文档宽均等于scrollWidth，浏览器warn／error为空，viewport已恢复，临时tab26／27关闭。正式管理页面本地仍按未接平台的状态显示，没有伪造授权数据或真实验收。
