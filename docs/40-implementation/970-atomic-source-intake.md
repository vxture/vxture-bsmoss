# P1持久来源接收

2026-11-06，设计[245](../30-design/design_bsmoss_245_atomic-source-intake.md)，接续bc3ca68。

## 实现

新增内部sourceIntake.receive，读取已审阅binding和最新回执，调用既有prepareSourceUpdate后，以配置共享锁、binding互斥锁和前回执CAS将全部测量、pending质量、input_change与接收回执一起提交。原量写事务复用PgMeasurementStore，独立append行为保持；来源乱序修订先写前驱，受控pending重放保留原主体。相同计划复用回执，过时不同计划拒绝；重开及成功应答丢失从数据库位置恢复，不用前端游标。

注册修订/head与接收回执新增空库三表，Prisma标量同步至65表；仅在本机随机专用合同库应用基线，不迁移、不改已有业务库。运行角色不能改注册、完成账本或接收历史，只追加接收回执；产品机器ingest授权保持拒绝。

## 验证记录

本批实际数据库合同覆盖正常提交、重开、同截至修订、乱序/缺前驱、跨主体重叠重放、映射失败/插回执失败/中途与末次撤权/取消的全账本回滚、拉取期配置变化/提交期真实共享锁阻塞、完整scope/租户、并发重复/过时CAS、空批与未验证声明、运行角色权限及既有登记派发/任务监控链路。首轮计数夹具错误引用input_change不存在的source_id，已改为按measurement外键关联；派发夹具含多个事件占用相同指标/时段，正确触发现有evidence_invalid，成功链路改为独立无冲突来源。TRUNCATE先被外键拒绝，补入该真实拒绝断言。此前失败不计通过。末次通过结果及其余守卫以本批检查点和tmp/source-intake-*日志为准。

网络端口为内存来源夹具，身份端口为合同夹具，PG使用真实运行角色，不能冒充来源签认或平台验收。没有页面/API/正式机器拉取入口或外部来源接通，不重复无变化的浏览器布局验收。

末次686全量单测、387实际PG合同（新增21项）、双层types及production build通过，日志tmp/source-intake-{unit,db-final,types-final,build}.log；Prisma validate、65表静态镜像、182篇编号文档、delivery/SCA、ASCII和diff检查通过。随机合同库由原测试finally清理，专用本机PG实例已停止；没有停止或改动其他数据库。提交密钥扫描及最终预览健康与SHA见artifacts/formal-checkpoints/atomic-source-intake.json。

## 接续

P1/B03-04/B03仍in_progress。接收阶段任务监管/失败记录、业务按需创建与跨页通知、P2共同可用版本/报告依赖和B04继续。真实来源字段、授权/原件/签认、稳定快照和变化游标、机器ingest审阅/凭据/环境依赖保持。本批接收不发布可用版本，不推进页面截至或改原报告，未push/外部部署或上线。
