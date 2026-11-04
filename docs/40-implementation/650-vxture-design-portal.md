# vxture Design 门户视觉纠正

## 页面外边距统一（2026-11-04）

用户要求页面内容区统一12px。页面容器显式使用product-page-inset，消费DS公开语义量calc(var(--space-lg) / 2)，标准密度实值12px；不覆写DS全局token，不改变组件内距或用户密度。首页、大屏、四专题、核验列表／详情、站址台账／档案、配置总览与错误／未开放状态同步；旧正式分析／报告／模板／任务工作区的外部留白和断点值也改同一DS表达式。报告／任务详情只收敛外部margin，卡片内部padding保留。地图全画布、header及launcher浮层不套页面留白。

构建与类型检查、浏览器桌面／手机实际padding及无横溢检查见本次代理记忆和artifacts/page-inset-qa。纯布局不重复业务／数据库测试，无依赖、权限、数据或部署变化。

对应 [设计229](../30-design/design_bsmoss_229_vxture-design-portal.md)。用户否定上一版首页视觉后，实际接入发布包并重做门户首页与共享导航。

## 实现

- 增加官方主题／字体／品牌／workbench入口、客户端providers与Tailwind PostCSS；仅使用设计系统伞包的公共导出。
- ProductFrame服务器层保留预览开关；ProductChrome客户端组合ShellHeader、ShellViewport、ShellSidebarNav和ShellLauncher。五个正式页面的既有业务容器移到外壳内部，防止旧reports选择器污染导航。
- 首页使用官方指标、面板、图表、进度和表格组件，经营用量三指标可切换；正式关闭预览时保留公开入口和未开放说明。
- 删除旧首页及顶栏CSS；1177行旧全局样式转为独立命名空间，避免 `--accent` 和通用标签规则污染DS。地图工作台布局与默认不选站逻辑不变。
- 将后续门户设计约束写入CLAUDE.md；未改服务、正式鉴权、DDL或Prisma。

## 依赖兼容

DS15／UI12的可伸缩面板范围解析到4.17.0时，引用Activity，当前Next15.5.28内置React canary不导出该符号，首次生产构建失败。应用React19.2.4本身有Activity，故不能靠改应用React版本解决。将该传递依赖固定到设计系统仓库锁定的4.12.3后构建成功；没有修改node_modules、替换React别名或升级业务框架。

## 验证

- 540项既有单测，双层类型检查，Next生产构建及20项HTTP回归通过；最终日志 `tmp/portal-ds-{unit,types,build,http}.log`。
- `pnpm install --frozen-lockfile`通过；`pnpm audit --prod --json`实际在线执行，199项生产依赖报告已知漏洞0。该结果仅表示当时npm审计范围，不冒充完整OSV／远端CI／生产验收。
- CUA检查1280桌面、390手机；官方主题和指标切换、导航弹层、下钻链接与地图返回核对。最终截图与读数位于 `artifacts/portal-design-system-qa/`，最终检查点 `artifacts/formal-checkpoints/vxture-design-portal.json`。
- 编号、静态schema镜像、交付、SCA配置、ASCII及密钥扫描收尾记录在本地日志。无数据库变化，未重复PG及worker制品测试。

## 剩余工作

本次完成P01的视觉纠正。P02站址台账／完整档案为下一业务包；正式页面的复杂表单主体尚未全部转换为DS组件，P03–P07逐页统一。真实来源／平台／环境、容量恢复与UAT等原上线依赖保持；无远端推送、外部部署或正式上线。
