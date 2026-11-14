# P1跨页面任务消息

2026-11-06，设计246，接续9df25b8。

## 实现

已有数据更新任务工作台及失败/审阅恢复链路保持。新增浏览器安全UpdateNotification(s)、同事务分页状态投影及GET /api/data-updates/notifications；Header官方消息抽屉改为授权状态列表，任务名称精确跳回原工作台，支持翻页、重查、阶段通知和失败/配置变化说明。

共用list筛选，完整scope先过滤后分页，单一数据库快照重建进度，末次全响应并集再验权。抽屉关闭卸载、隐藏/离页取消请求并清数据，错误清旧消息；跨页重新从服务器读取，不缓存授权任务。无未读/已读/推送投递或完成时间声明，处理完成不发布分析版本。

OIDC未接入保持准确空态和API401；不在正式页面造任务。无DDL/Prisma/依赖或权限分配变化，65表基线保持。未改变上游sourceIntake的内部调用边界，不扩大机器ingest，不改来源完成账本、页面数据截至或原报告。

## 验证

687全量单测、391实际PG（本批新增4项并扩展真实失败/恢复/配置变化断言）、52HTTP、双层types和production build通过。日志tmp/update-messages-{unit,db,http,types,build}.log。PG仅复用专用本机cluster中的随机空合同库，测试finally清理，未应用业务库。消息覆盖微秒分页、实际派发/失败/恢复进度、无原量/错误清单泄漏、完整scope/租户、途中撤权、无查看权限和查询注入拒绝。

浏览器已核对实际Header/抽屉的分页、精确任务链接、跨页重读、重算至完成、失败、配置变化、403清空与503只读提示、空态、关闭后查询次数不增加。390/904/1280布局验证中发现官方sm宽度在手机超出视口，消费侧使用max-w-full约束，修复后390px抽屉完整且无横溢；未改DS全局token。末次构建及单测日志为tmp/update-messages-{unit,types,build}-final.log。

浏览器记录、守卫、最终提交/健康与清理以artifacts/formal-checkpoints/update-messages.json和artifacts/update-messages-qa为准。独立loopback脚本scripts/update-messages-browser.mjs挂载实际Header/消息组件，仅合成HTTP状态，无真实身份/DB/worker，不当正式来源或平台验收。首轮独立打包缺Next环境占位导致组件未挂载，修复仅QA打包配置后重验；不把该失败计成功。

## 接续

P1/B03-04/B03仍in_progress。本批完成已有已接收任务的跨页状态入口；上游接收阶段持久生命周期/失败记录与恢复监管、业务按需接收创建、共同可用版本/报告依赖及B04仍待。下一继续接收监管与可验证编排，不把重算任务等同拉取任务。真实来源授权/字段原件/签认、稳定来源快照/变化流、机器ingest受审许可/凭据、平台环境/Beta容量恢复/UAT和生产批准依赖保持。未push/外部部署或上线，未新建聊天或自动任务。
