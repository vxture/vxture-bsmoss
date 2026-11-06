# 配置管理职责重组首批

2026-11-06，设计250。用户授权推进，导航尽量四字。

已将数据更新、聚合处理、报告任务工作台迁回业务路径；原配置深链固定307兼容，保留任务与重复query交由原验证。报告中心／数据更新提供相关二级任务入口，Header消息链接与登录returnTo同步。业务任务采用原业务留白框架，API及权限未变。

管理官方DS侧栏现为管理总览、指标字典、模板配置。管理总览展示可用参数入口与五组建设范围，未具备功能不放空链接。指标字典直接读取12项注册定义，分类／名称编码搜索及完整统计口径详情，状态待接入不冒充已启用。模板配置沿用受审版本工作台。总览偏好移用户面板与/preferences/overview，仅本机浏览器生效；原开放条件保持。地域在非分析页只记忆并刷新，不改任务身份。

## 验证

双层type-check通过tmp/configuration-types-final.log；最终production build含类型通过tmp/configuration-build-verified.log。13项导航／地域／深链／原任务查询规则通过tmp/configuration-unit.log；54项HTTP通过tmp/configuration-http-final.log，含旧路由多值query重定向、目录与业务分离、预览开关和正式API拒绝匿名。192项文档编号通过。ASCII／diff／提交扫描收尾。

首次新深链测试误将URLSearchParams传给既有string接口、随后误预期重复task返回null，修正为URL字符串及既有invalid_task_link拒绝后通过；未改目的页校验。首轮HTTP的字典data属性未被DS容器透传，以及已移除的任务侧栏旧入口断言失败，改为验证实际字典内容、聚合二级入口与配置链接缺席后全过，权限断言保持。

CUA七页在1280／904／390共21组检查唯一H1及文档／正文无横溢。指标分类＋编码检索、无匹配、总量上／下行依赖详情；手机官方导航选择后关闭；用户面板总览偏好、业务launcher数据更新、更新与聚合往返；桌面侧栏收起刷新记忆并恢复；深浅主题切换并恢复均通过。正式任务／模板仅验证无会话门槛，不能声称真实任务执行或生产业务验收完成。

手机实测发现DS字典详情Drawer的lg宽超屏，补max-w-full后在最终构建复测可读并保存mobile-detail.png；次／条单位也按指标分别显示。最终字典桌面列表、详情和管理首页重新截图，warn/error空。证据artifacts/configuration-boundaries-qa含management.png、metrics.png、metric-detail.png、mobile-detail.png、business-launcher.png、dark.png与checks.json；viewport恢复、临时15关闭，用户页保留。63333最终SHA与健康见artifacts/formal-checkpoints/configuration-boundaries.json。

## 后续与边界

组织管辖、成员权限、站址分类与分析规则、授权来源配置、配置审计和连接诊断仍需逐批实现。本批没有新来源或权限分配、无DDL／Prisma／依赖改动、无push或外部部署。原P1接收任务工作台、受审重新基准及真实来源／平台环境／UAT依赖继续保留。
