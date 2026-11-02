# 聚合后台循环与提交权限复查

接续214。把登记周期扫描、输入变化消费和聚合结果执行组成内部worker核心。真实机器身份provider和生产宿主依然独立验收。

## 提交权限边界

旧executeRefreshLease仅开始时解析授权，事务内沿用静态context。实际PG回归复现：写入成功回执后撤销aggregate权限仍会COMMIT。现在于同一RR事务COMMIT前再次解析真实身份、平台权益、本地显式metering.aggregate权限和有限scope，要求原租户与主体一致，原授权和当前授权都未过期。

必要范围取可信snapshot的规范mapped-object-v1元组：来源、站址、非空服务／设备、目标指标；无服务且无设备要求独立allowSiteParameters。interval按实际inputMode核验依赖：direct接通率不强加未使用次数指标，dependencies比率及派生总量要求真正输入。状态与温度只要求自身指标。移除无关scope仍可提交，不强求整个旧grant不变。

失败时aggregate revision、head、outbox、成功attempt和job成功状态一起回滚。claim是先前独立提交的事务，原租约仍leased，不能声称claim也回滚。已识别授权错误向上抛出，supervisor不将它转成执行失败回执或缩scope消耗任务。恢复遵循原租约到期和有限尝试，不自动解锁或清零。

复查是提交前最后应用层步骤，不提供跨平台／数据库的分布式授权锁，之后的新撤权不能追溯取消已提交结果。

## 有限通道

createAggregateWorker由可信宿主静态配置固定workspaceId／subject、最多32个唯一partitionIds、executeResults开关、每轮1–25步骤及1–60秒间隔。不接受scope、token或任意回调。每登记独立建立周期和变化通道，另有一个结果队列通道，最多65条，复用214公平轮转、独立封顶退避、互斥运行和停止机制。

周期沿用登记head锁、小时receipt和有限种子／目标；变化沿用同事务登记、变化读取、SAVEPOINT、排队、成功receipt或退避／quarantine。结果沿用真实grant过滤的有限候选和租约fence，调用三语义原子执行，不制造对象授权。

登记暂停分别隔离两个通道，已排队结果仍按当前真实grant执行。暂停不是撤权，不取消已确认排队任务。变化failure_recorded按持久状态映射retry／dead，quarantined和deferred映射dead／delayed。结果failure_recorded保留中性状态，不能凭attempt猜测自定义max_attempts；持久终态以数据库为准。

## 停机恢复

停止后不派新通道。结果在claim前后检查信号；claim已提交则保留租约待过期恢复，不启动结果事务。正在执行的事务等待实际完成或回滚，run再返回，宿主await后才能关闭Pool。周期和变化各自完整事务，不撕开内部原子边界。新实例从持久receipt／队列恢复，不靠内存游标，不清空尝试或退避。

## 验收和出口

实际PG覆盖写后撤权和完整回滚、三语义／直接比率各授权维度、原授权过期／身份和租户变化、无关scope收缩、实际依赖与独立站参数开关。组合循环覆盖暂停隔离、周期／变化／结果闭环、新实例恢复、固定身份、扫描后及claim后停机、到期重领、在途事务停机与撤权无虚假失败回执。单测覆盖32登记上限、未知字段拒绝和固定分类，沿用214生命周期测试。

无DDL／Prisma／依赖／UI变化，仍55表空库，无迁移。仍待真实机器provider、生产进程托管、持久监控／受审恢复、规模分片、历史报告变化传播；失败回执自身事务的末次授权边界也需继续审计。真实来源／平台注册、Beta、11万3倍突发、恢复／安全、UAT和生产批准仍缺，不能宣称上线。
