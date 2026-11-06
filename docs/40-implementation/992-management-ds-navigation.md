# 配置管理 DS 导航重构

2026-11-06，设计249。用户将配置管理导航与布局设为当前优先事项，原P1接收任务工作台后续保持待办。

ProductChrome 将管理侧栏直接接入官方 ShellViewport / ShellSidebarFrame / ShellSidebarNav，取消 ProductWorkspace 内的重复外壳。业务页面继续原有双层留白。管理桌面侧栏可收起并记忆浏览器偏好；移动端官方 Drawer 使用同一导航，关闭与选中反馈沿 DS。Next Link 与精确当前路由保持，底部返回业务携带全局区域。

management-navigation 集中两组入口、图标与说明，管理首页及管理 launcher 共用。首页分组 EntryCard 与外观 PanelCard 使用官方组件，移除原长串入口；配置二级页面及门槛页面统一官方 ShellPageContainer，不叠加业务页面内距。齿轮入口保留并标识配置域当前位置，Header 尺寸与区域选择保持。

## 验证

最终生产构建含类型检查通过 tmp/management-ds-build-final.log；两项导航规则回归通过 tmp/management-ds-navigation.log；54项 HTTP 回归通过 tmp/management-ds-http-final.log。首轮 HTTP 断言要求返回业务裸路径，因本批改为携带全局地域而失败；更新原断言验证 city=all/county=all后重验通过，未修改权限预期。初次构建后的状态切换与门槛页间距调整均包含在最终构建。

CUA 六个管理页面 × 1280／904／390 共18组最终检查：唯一 H1，文档及正文无横向溢出，桌面当前链接唯一且正确，移动端侧栏隐藏并有抽屉入口。桌面侧栏展开256px／收起64px，切换子页与刷新保持收起；抽屉跳转报告任务后关闭，Escape 稳定后 dialog=0／aria-expanded=false。业务台账齿轮实际进入管理首页，返回业务到运行总览并携带全省参数。浅深主题切换并恢复，warn/error空。

第一次批量 DOM 检查取到了移动端水合前的桌面壳，弃用该轮结果；最终轮等待实际移动导航按钮可见后检查。返回业务首次读取也早于路由完成，等待业务 launcher 可见后才记成功。任务页仅验证真实门槛页，不以无凭据状态声称受保护工作台业务验收完成。

证据 artifacts/management-ds-navigation-qa：desktop.png、mobile.png、mobile-navigation.png、dark.png、checks.json。viewport已恢复，临时验证13和参考12关闭，用户页面未改动。文档编号190通过；ASCII／diff和提交扫描收尾。纯布局不新增镜像测试，不重复数据库验证。

## 边界

本批仅导航与布局，不变更数据库、权限、任务执行、数据来源或生产状态；正式子页仍受真实会话与既有授权约束。未接入的真实任务不作为本地布局验收数据。无依赖新增、不修改平台或 DS 仓库、不 push、不外部部署。
