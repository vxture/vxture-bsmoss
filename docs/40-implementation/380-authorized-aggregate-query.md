# I11 授权周期结果查询入口

2026-11-03。[查询设计](../30-design/design_bsmoss_202_authorized-aggregate-query.md)。首个单对象正式读取切片，未上线。

## 实施

query 提供严格请求选择器与周期规范化，pg-query在只读一致事务内绑定当前范围、可信快照、发布指针及选定修订；区间／依赖／比率和设备状态复用已有存储。读取结果与当前可信计算摘要比较，分别显示历史指针或来源变更造成的stale。读取不会入队、发布、确认消费或签认来源。

access/aggregate-query按view权限创建独立有限reader，读取后重查身份／权益／本地授权与scope；runtime从实际RP会话构造。新增GET /api/aggregates，无演示回退，匿名或preview开启均不能越过权限；JSON含精确计数、发布修订及水位／完整性／证据。错误统一受限代码和no-store／nosniff／Vary: Cookie。

## 验证

新增4项单元测试验证view权限、无权零数据库访问、读取期间撤权／过期／范围改变、工作空间错配、非法及注入参数。新增7项实际PostgreSQL子检查验证未发布与缺修订、53位以上精确值、输入／能力／完成撤销后的stale、历史版本、状态质量／未知、各范围与依赖隔离、并发发布一致读、只读无副作用及错主体结果拒绝。

409单测、133项实际PG报告测试和双层类型已通过；最终生产构建、20项HTTP（包括preview不能解锁正式查询）、守卫／密钥／提交及运行检查点以agent收尾和artifacts/formal-checkpoints/authorized-aggregate-query.json为准。只操作专用cluster随机合同库，无DDL／Prisma／依赖或演示UI变更，不重复不变的六场景浏览器验收。

## 未完成出口

I11已从backlog进入in_progress，尚缺真实查询面板、正式显隐／排序、跨对象权威汇总及真实用户来源验收；I12持久报告及异步导出仍未完成。I08瞬时值／对象汇总和I09能力／映射／服务变化、登记订阅／种子／真实机器身份及常驻调度继续待办。没有真实来源／平台注册／Beta／容量安全恢复／UAT或生产上线证据。
