# 配置管理 DS 导航与页面框架

2026-11-06，用户要求参考平台控制台重构配置管理，并明确使用 DS 导航组件。线上控制台跳转登录，直接核对本地平台 ConsoleAppShell、ConsoleHeader 及发布版 DS 契约，不绕过登录。

配置管理使用 ShellViewport 的 sidebar 槽位及其 ShellSidebarFrame，直接承载 ShellSidebarNav。取消业务 ProductWorkspace 留白壳与额外圆角、边框容器；侧栏宽度、折叠分组、选中态、提示与滚动交给 DS。业务应用仍保持原无常驻导航的布局。入口保留 Header 右侧齿轮，32px 外框与16px图案不变。

管理导航分配置管理、任务管理两组，底部返回业务应用。导航、管理首页及原管理 launcher 读取同一配置；预览开关只影响原有可见入口，不授予目标页面权限。Next Link 负责客户端跳转，当前页面精确匹配，避免管理首页与子页同时选中。侧栏收起偏好仅保存布尔值，不缓存任务或授权数据。

移动端由 DS Drawer 承载同一个 ShellSidebarNav，Header 左侧提供官方侧栏按钮。选择目的地、关闭按钮、Escape 与切换桌面断点均能关闭；焦点约束、遮罩与键盘交互由 DS 提供。

管理首页用官方 EntryCard 分组展示已有配置和任务入口，外观偏好保留官方 ShellPreferencePanel。全部配置子页及其门槛页统一使用 ShellPageContainer 默认流体留白与底部安全区，页面标题保持已认可 PageHeading。共享 WorkspaceAvailability 新增容器选择，业务门槛页默认布局保持。

全局地域与记忆、品牌及系统名称保留。配置页面不因地域选择伪装任务权限过滤。真实平台授权、模板发布与任务恢复门槛不变；不制造统计、任务、成功接入或上线结果。本批不含后台接收任务新功能。
