# 业务领域Launcher与独立决策大屏

对应[设计232](../30-design/design_bsmoss_232_business-launcher-board.md)。本批落实入口目录、launcher结构及独立大屏首版，不把资源／核验的规划项标记为完成。

## 实现

- portalNavigation增加独立board；portalBusinessGroups集中定义五类目录，正式页面引用原导航条目，已有演示能力使用有效深链，规划项无href。
- 顶行官方EntryCard只放首页／大屏，Separator分层，下方按业务分栏。配置管理保留独立目录／侧栏／齿轮入口；不新增全局业务侧栏。
- `/board`显式预览开关下才调用boardDemo；关闭时只显示未开放。输入严格限制陕西地市及0—23小时，拒绝重复、未知字段、伪造scope和站址默认参数；错误页不输出模拟数据。
- 服务端复用queryMap及queryOperatorUsage，生成当前地图／指标、全省地市比较、同范围24小时序列及运营商用量。客户端通过服务器导航同步更新快照，回放在新快照返回后才推进，选择地市停止回放。
- 官方MetricListCard／PanelCard／BarChart／Progress／SegmentedControl／NativeSelect／Slider／Button组成页面；独立MapLibre适配读取同一站址与本地边界，脱离工作台全局store，标准矢量地图不请求遥感或在线瓦片。点击站址或业务详情进入既有工作台，携带小时及有效地市。
- 地图聚合状态取成员重点／关注，点位支持状态、流量及电耗专题；主题读取DS的实际语义变量，随主题变化重绘。相机操作不重新统计业务范围。

## 验证与边界

日志tmp/business-domains-{unit,types,build,http}.log，浏览器证据artifacts/business-domains-qa。新增目录归属／规划项无链接、同规则计量对齐／物理电耗／同小时地市与运营商对账、非法输入测试，以及正式关闭预览不泄漏、独立页面／地市深链HTTP检查。无DDL／依赖／正式授权服务变化，不重复PG和worker制品测试。

实际视觉检查发现MapLibre的未分层position规则覆盖Tailwind绝对定位，使容器高度为0；通过局部board-map-canvas样式固定边界解决。Tailwind的颜色别名未作为运行时变量输出，地图改读已发布DS的实际--primary／--background等语义变量，不新增token或硬编码主题色。最终构建、浏览器检查与运行身份以收尾记录为准。

最终5项相关单测、门户类型、生产构建含类型、24HTTP、138篇文档编号检查通过。CUA1440／787／390检查分组、顶行双入口、水平分割、手机内部滚动与无横溢；地市切换西安240站、小时18→17、时序17→18后暂停、报告演示深链、全屏进入／退出均成功。手机专题控件原占标题操作槽会使标题逐字换行，移入内容工具行后标题单行22px，文档宽／scrollWidth均390。浅深主题地图正常，最后恢复浅色、viewport reset，临时tab31关闭；warn／error为空。

全部源文件ASCII与diff检查通过；分组／大屏数据变更没有写入正式计量、修改DDL或放开API。资源台账／核验闭环、正式大屏读模型仍待，不等同真实接入或上线。最终提交／扫描／预览身份以Git和health为准。
