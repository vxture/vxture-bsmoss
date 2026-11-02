# I09 登记输入消费与恢复

2026-11-03。[设计207](../30-design/design_bsmoss_207_registered-input-consumption.md)。内部登记消费出口完成，真实机器身份和常驻执行仍待。

## 实施

抽取pg-registered-partition共享读取器：精确配置修订、原始JSONB SHA核验和规范化，整个事务持有head共享锁；周期扫描沿用同一读取器。pg-registered-input提供只选分区id的发现／单步监督，及必要事件id的直接消费和带依据恢复，不接收调用者policy或scope。

pg-input-refresh抽取事务内消费、发现和恢复核心。外层唯一RR事务同时持有配置锁，内层保留原SAVEPOINT、全部历史范围核验、可信快照、发布失效、全批任务、成功回执和异常退避／隔离逻辑，不自行提交、不伪造pool、不复制消费器。事务前仍先验真实身份；成功、重放、发现、延迟、隔离和恢复均再验当前权益、权限和完整登记scope。父grant未使用范围变化不改变分区进度，注册范围本身失权则回滚。

inputRefreshSubscription可选绑定分区id／精确修订／原始配置摘要／规范语义摘要；不同分区、修订和无登记调用隔离。无登记摘要保持原值。input_refresh_receipt和input_dispatch_event增加成对可空分区指针及同租户FK；登记回执manifest必须匹配配置指针，禁止带登记载荷却留空指针。空库仍41表，Prisma标量同步，无旧库迁移。

配置暂停或新修订等待在途事务释放锁；工作SAVEPOINT回滚不释放外层配置锁。取锁前已变更head的RR快照回滚。历史旧新对象必须全部在登记范围；跨分区纠错需审阅新的完整范围，不能在单分区静默确认一半。恢复配置为新修订保留旧进度与失败历史，并对相关变化重新消费。暂停不取消已排队任务或代替实际撤权。

## 验证

428单测（新增3）、178项实际PostgreSQL报告测试（177子项＋父项，新增11）全部通过。包括原有全部消费／周期回归、登记发现与幂等、无登记兼容、不同分区／修订隔离、暂停所有入口、父grant未使用范围变化、回执写后撤权全回滚、5次隔离／恢复和历史保留、失败记录故障／写后撤权、并发同事件fence、成功及失败SAVEPOINT下配置暂停、取锁前RR竞态、晚提交完成证明、质量和权威变更路径、指针／manifest／租户FK和跨对象修订完整范围。

首次新增178全通过；随后强化登记载荷和配置指针互斥约束，再次全PG通过。双层类型、生产构建、Prisma、20HTTP、87篇文档／41表镜像／交付／SCA配置守卫、ASCII／密钥扫描及Git收尾见tmp/registered-input-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log和artifacts/formal-checkpoints/registered-input-consumption.json。仅专用PG随机合同库，无业务库操作，收尾停止。无依赖或地图变化，不重复六场景UI验收。

## 下一出口

全省自动分区／时间分片、真实机器身份provider和常驻scheduler／worker未完成；1000历史窗口／64任务等边界超限仍隔离不截断。I08跨对象权威去重、I11正式面板、I12持久报告／异步导出继续待办。真实来源／平台注册／Beta环境、11万容量及3倍突发、安全恢复、业务UAT和生产批准仍缺。没有push／PR／远端CI／真实接入／外部部署／上线。
