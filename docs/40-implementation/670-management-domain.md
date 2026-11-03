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

后续用户要求业务页面不用统一导航：业务域ShellViewport固定sidebarMode=hidden且sidebar=null，不挂载侧栏或保留空白占位；全局板块全部由launcher提供。管理域仍保留原专属侧栏，地图独立布局保持。此项为布局调整，不重复业务单测／PG；构建与HTTP日志为tmp/business-launcher-{build,http}.log，实际页面证据位于artifacts/business-launcher-qa。

launcher间距优化：复用官方EntryCard，统一两域入口的图标底块、用途说明、当前状态和更舒适的条目间距；配置入口改用faders／stack／database／calendar区分含义。弹层打开时通过官方onOpenAutoFocus槽聚焦首个入口，修正原焦点停在顶栏、Tab直接离开面板的问题；原生href保留新窗口与键盘导航能力，点击后关闭。无路由、业务权限或依赖变化。

生产构建含类型检查、22HTTP与136篇文档编号检查通过，源码ASCII及diff检查通过。CUA1280／787／390核验宽度边界、两栏转单栏、管理及业务跳转；Tab进入下个入口、Enter进入模板和Escape关闭通过，浏览器warn／error为空。Escape需等退场动画后核对隐藏，避免把动画中的DOM节点误判为未关闭。证据artifacts/launcher-layout-qa，日志tmp/launcher-layout-{build,http,docs}.log；仅UI调整不重复业务单测与PG。无外部部署。
