# BS-MOSS 页面切换器 DS 核查清单

核查日期：2026-11-14。范围：本地 BS-MOSS 的全部 54 个 page.tsx 路由及其相对导入依赖。采用源码依赖检查；浏览器访问被已保存的用户权限阻止，未进行逐页视觉验收。共享组件会在多个页面重复列出；条件分支不代表同时显示。动态路由需要实际记录参数。

DS：@vxture/design-system 15.6.1；@vxture/design-ui 12.5.1。ViewModeSwitch 为 DS 整体组件；互斥文字/图标选项使用 SegmentedControl，多选使用 ToggleGroup，独立开关使用 Toggle/Switch。

## 本轮补齐

- 地图工作台：用量/报告周期、合计/日均、概览/贡献、专题、单站周期、绘图形状、底图；倾斜使用 DS Toggle。
- 服务量化板块导航、客户使用内容导航：合并为一个 DS SegmentedControl。
- 旧指标预览：桌面和移动端指标类别。
- 地图侧栏分析主题、日报/周期报告章节、面板开关、显示配置：统一使用 DS SegmentedControl、Toggle、Switch；对比站点勾选使用 DS Checkbox。
- 清除业务自绘滑块、选中态及对 DS radio 的尺寸/字体覆盖。

## 逐页清单

| 页面路由 | 源码核查结果 | 控件来源（文件:行） |
|---|---|---|
| `/` | 使用 DS 控件 | `portal/home.tsx` SegmentedControl:82<br>`portal/overview-panels.tsx` SegmentedControl:53、SegmentedControl:85、SegmentedControl:158<br>`portal/overview-metrics.tsx` SegmentedControl:63 |
| `/analysis` | 使用 DS 控件 | `analysis/workspace.tsx` Checkbox:89<br>`analysis/history-workspace.tsx` SegmentedControl:86、SegmentedControl:87<br>`analysis/history-cohorts.tsx` SegmentedControl:15<br>`analysis/history-station.tsx` SegmentedControl:22 |
| `/analysis/report` | 包含重定向；无上述切换器 | — |
| `/board` | 使用 DS 控件 | `board/view.tsx` SegmentedControl:87 |
| `/capacity` | 使用 DS 控件 | `business-analysis/workspace.tsx` SegmentedControl:55、SegmentedControl:56、SegmentedControl:99<br>`business-analysis/capacity-panel.tsx` SegmentedControl:56、SegmentedControl:69<br>`business-analysis/runtime-panel.tsx` SegmentedControl:61<br>`site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`capacity/overview.tsx` SegmentedControl:27、SegmentedControl:32<br>`capacity/detail.tsx` SegmentedControl:16 |
| `/customer-use` | 使用 DS 控件 | `site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`operator-usage/detail.tsx` SegmentedControl:18<br>`customer-use/sections.tsx` SegmentedControl:51<br>`customer-use/mode-nav.tsx` SegmentedControl:12 |
| `/efficiency` | 使用 DS 控件 | `business-analysis/workspace.tsx` SegmentedControl:55、SegmentedControl:56、SegmentedControl:99<br>`business-analysis/capacity-panel.tsx` SegmentedControl:56、SegmentedControl:69<br>`business-analysis/runtime-panel.tsx` SegmentedControl:61<br>`site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`efficiency/overview.tsx` SegmentedControl:25、SegmentedControl:29<br>`efficiency/detail.tsx` SegmentedControl:14 |
| `/monitoring` | 使用 DS 控件 | `site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15 |
| `/operations/aggregation` | 包含重定向；无上述切换器 | — |
| `/operations/data-updates` | 使用 DS 控件 | `operations/data-updates/task-list.tsx` SegmentedControl:35 |
| `/operations/reports` | 包含重定向；无上述切换器 | — |
| `/operator-usage` | 包含重定向；使用 DS 控件 | `business-analysis/workspace.tsx` SegmentedControl:55、SegmentedControl:56、SegmentedControl:99<br>`business-analysis/capacity-panel.tsx` SegmentedControl:56、SegmentedControl:69<br>`business-analysis/runtime-panel.tsx` SegmentedControl:61 |
| `/preferences/overview` | 包含重定向；无上述切换器 | — |
| `/product-preview` | 使用 DS 控件 | `product-preview/workbench/workbench.tsx` Toggle:128、Toggle:128、Toggle:128、Toggle:128、Toggle:128、Toggle:128、Toggle:128、Toggle:128、Toggle:128、Toggle:128、SegmentedControl:138、Toggle:145、Toggle:145、Switch:159<br>`product-preview/workbench/station-panel.tsx` SegmentedControl:46<br>`product-preview/workbench/calendar-panel.tsx` SegmentedControl:53<br>`product-preview/workbench/period-selector.tsx` SegmentedControl:8<br>`product-preview/workbench/period-comparison.tsx` SegmentedControl:17、SegmentedControl:18<br>`product-preview/workbench/report-panel.tsx` SegmentedControl:53<br>`product-preview/workbench/comparison-panel.tsx` Checkbox:47<br>`product-preview/workbench/topic-panel.tsx` SegmentedControl:30<br>`product-preview/workbench/display-controls.tsx` Switch:21、Switch:34、Switch:37<br>`product-preview/workbench/map-canvas.tsx` SegmentedControl:277、SegmentedControl:282、Toggle:282 |
| `/product-preview/copyright` | 无上述切换器 | — |
| `/product-preview/metrics` | 使用 DS 控件 | `product-preview/preview.tsx` SegmentedControl:337、SegmentedControl:384、Switch:762 |
| `/reports` | 使用 DS 控件 | `reports/local-workspace.tsx` ViewModeSwitch:59、SegmentedControl:59<br>`reports/centre-switch.tsx` SegmentedControl:7<br>`reports/file-view.tsx` SegmentedControl:23<br>`reports/tasks/workspace.tsx` SegmentedControl:29<br>`settings/configuration-layout.tsx` SegmentedControl:20<br>`site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`tower-service/history-controls.tsx` SegmentedControl:20 |
| `/reports/new` | 使用 DS 控件 | `reports/new/workspace.tsx` SegmentedControl:41<br>`reports/file-view.tsx` SegmentedControl:23 |
| `/reports/tasks` | 包含重定向；无上述切换器 | — |
| `/review-history` | 包含重定向；无上述切换器 | — |
| `/settings` | 无上述切换器 | — |
| `/settings/access` | 使用 DS 控件 | `settings/configuration-layout.tsx` SegmentedControl:20 |
| `/settings/audit` | 包含重定向；无上述切换器 | — |
| `/settings/classifications` | 包含重定向；无上述切换器 | — |
| `/settings/data-access` | 使用 DS 控件 | `settings/configuration-layout.tsx` SegmentedControl:20 |
| `/settings/dictionaries` | 使用 DS 控件 | `settings/dictionaries/workspace.tsx` SegmentedControl:32 |
| `/settings/jurisdiction` | 包含重定向；无上述切换器 | — |
| `/settings/mappings` | 包含重定向；无上述切换器 | — |
| `/settings/members` | 包含重定向；无上述切换器 | — |
| `/settings/metrics` | 包含重定向；无上述切换器 | — |
| `/settings/operations/aggregation` | 包含重定向；无上述切换器 | — |
| `/settings/operations/data-updates` | 包含重定向；无上述切换器 | — |
| `/settings/operations/reports` | 包含重定向；无上述切换器 | — |
| `/settings/operators` | 无上述切换器 | — |
| `/settings/overview` | 使用 DS 控件 | `settings/overview/editor.tsx` SegmentedControl:29、Checkbox:35 |
| `/settings/rules` | 使用 DS 控件 | `settings/rules/workspace.tsx` SegmentedControl:22<br>`settings/parameters/monitoring.tsx` Switch:18 |
| `/settings/sources` | 包含重定向；无上述切换器 | — |
| `/settings/templates` | 使用 DS 控件 | `settings/templates/editor.tsx` Checkbox:42 |
| `/sharing` | 包含重定向；无上述切换器 | — |
| `/sites` | 包含重定向；使用 DS 控件 | `sites/registry.tsx` ViewModeSwitch:69 |
| `/sites/[id]` | 无上述切换器 | — |
| `/tower-service/evidence` | 包含重定向；无上述切换器 | — |
| `/tower-service/judgment` | 包含重定向；使用 DS 控件 | `settings/configuration-layout.tsx` SegmentedControl:20<br>`site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`tower-service/history-controls.tsx` SegmentedControl:20<br>`tower-service/judgment/contribution-board.tsx` SegmentedControl:61<br>`tower-service/services/chart.tsx` ToggleGroup:44<br>`tower-service/judgment/sharing-workspace.tsx` SegmentedControl:59<br>`tower-service/judgment/analysis-period-controls.tsx` SegmentedControl:18<br>`tower-service/judgment/occupancy-workspace.tsx` SegmentedControl:60 |
| `/tower-service/network` | 使用 DS 控件 | `site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`tower-service/history-controls.tsx` SegmentedControl:20<br>`settings/configuration-layout.tsx` SegmentedControl:20<br>`tower-service/dashboard/network.tsx` SegmentedControl:37 |
| `/tower-service/overview` | 使用 DS 控件 | `site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`tower-service/history-controls.tsx` SegmentedControl:20<br>`settings/configuration-layout.tsx` SegmentedControl:20<br>`tower-service/dashboard/network.tsx` SegmentedControl:37 |
| `/tower-service/resources` | 包含重定向；使用 DS 控件 | `site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`tower-service/resources/regions.tsx` SegmentedControl:29、SegmentedControl:30、ToggleGroup:32<br>`tower-service/history-controls.tsx` SegmentedControl:20 |
| `/tower-service/resources/[id]` | 无上述切换器 | — |
| `/tower-service/rules` | 使用 DS 控件 | `tower-service/admin.tsx` SegmentedControl:39<br>`settings/configuration-layout.tsx` SegmentedControl:20 |
| `/tower-service/services` | 使用 DS 控件 | `tower-service/service-view-navigation.tsx` SegmentedControl:7<br>`settings/configuration-layout.tsx` SegmentedControl:20<br>`site-analysis/workspace.tsx` ViewModeSwitch:82、SegmentedControl:82<br>`site-analysis/period-controls.tsx` SegmentedControl:15<br>`tower-service/history-controls.tsx` SegmentedControl:20<br>`tower-service/services/chart.tsx` ToggleGroup:44<br>`tower-service/services/matrix.tsx` ViewModeSwitch:30<br>`tower-service/evidence/workspace.tsx` ViewModeSwitch:78 |
| `/tower-service/sync` | 使用 DS 控件 | `tower-service/admin.tsx` SegmentedControl:39<br>`settings/configuration-layout.tsx` SegmentedControl:20 |
| `/usage-reports` | 包含重定向；使用 DS 控件 | `business-analysis/workspace.tsx` SegmentedControl:55、SegmentedControl:56、SegmentedControl:99<br>`business-analysis/capacity-panel.tsx` SegmentedControl:56、SegmentedControl:69<br>`business-analysis/runtime-panel.tsx` SegmentedControl:61 |
| `/usage-review` | 使用 DS 控件 | `usage-review/workspace.tsx` SegmentedControl:61、SegmentedControl:65、SegmentedControl:66 |
| `/usage-review/[id]` | 无上述切换器 | — |
| `/usage-review/history` | 无上述切换器 | — |

## 保留的数据交互

地图 area-panel/topic-panel 的小时柱形、station-period-panel 的逐日定位、旧指标卡片和报告记录选择属于数据点/记录选择；未改成模式切换器。board 城市列表和业务分析逐小时表格同样属于下钻/数据选择。跨页操作链接、菜单和地图显示预设命令保留动作语义。

## 验证结果

- 类型检查通过：tmp/ds-view-mode/audit-types-final.log。
- 生产构建通过：tmp/ds-view-mode/audit-build.log。
- 51 个非动态页面路由 + 5 个服务量化视图请求全部返回 200，自动跟随重定向；响应与最终 URL 记录于 tmp/ds-view-mode/page-http-audit.json。
- 3 个动态路由（/sites/[id]、/tower-service/resources/[id]、/usage-review/[id]）完成源码检查，未以实际记录请求，不算 HTTP 验收通过。
- 服务量化与研判 HTTP 回归 21/21 通过：tmp/ds-view-mode/audit-http-tests.log（node --import tsx --test）。
- 本地服务已重启：http://127.0.0.1:63333，预览开启、OIDC 关闭。
- 浏览器访问权限限制尚在，未进行逐页视觉、窄屏和键盘实际操作验收；HTTP 可访问性不等同于视觉验收。
- 清单由相对静态/动态导入依赖生成；列出组件源位置和条件分支，未声称每个分支均在运行时显示。
