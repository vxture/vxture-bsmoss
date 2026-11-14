# 独立分析业务页实施

2026-11-04，配套[设计234](../30-design/design_bsmoss_234_standalone-business-analysis.md)。

新增 `/capacity`、`/efficiency`、`/operator-usage`、`/usage-reports` 四个全宽无地图业务路由，复用 `business-analysis/model` 的严格查询／合成读适配、`links` 的上下文链接和官方DS工作区。launcher与首页四个业务入口归位，地图保持空间调查和既有全部面板。运行能效分能效观察和供电保障，用量支持时日周月，报告支持日周月和HTML下载及既有环比证据。

地图专题、运营商用量、日报／周报／月报增加独立页返回链接。显式传入search在URL初始化与服务查询中保留，普通从地图重新打开面板仍清除旧检索；地域、运营商、选区、时段和周期保持，普通页面跳转不选站。状态率使用Progress及淡化百分比，行操作使用官方ActionMenu；分页兼容发布版DS已知数字按钮尺寸，使用语义token并在消费含新槽的版本后移除。

预览开关在模型加载前校验，未开放不展示样例数字；查询错误不加载演示，正式 `/analysis`、`/reports` 和API原权限边界未改。站址旧HTTP用例原先仍断言页面读取时间增长，改为唯一源时间在同数据版本重复读取保持不变，兼容time上的class属性；不复活已经删除的刷新时间。

验证结果与截图在本轮完成后记录于[代理记忆](../90-memory/10-agent.md)，日志 `tmp/business-analysis-{unit,types,build,http,guards}.log`，截图 `artifacts/business-analysis-qa/`。本地演示实施不表示真实接入、外部部署或生产上线。
