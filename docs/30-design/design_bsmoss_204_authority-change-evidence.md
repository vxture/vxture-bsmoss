# 能力与主数据变更持久证据

2026-11-03。I09 历史影响传播的前置切片。测量／质量／来源完成已有追加变化记录，但能力策略与映射／服务有效期可由审阅管理路径更新；只读当前行无法重建旧范围，本批先保留真实前后证据。

## 捕获范围

source_mapping、source_capability、station_service 的INSERT／UPDATE／DELETE在原事务内追加 authority_change。捕获完整旧／新行，包含来源、设备／服务／站址归属、指标版本、有效期、能力状态、核验引用和策略；无变化UPDATE不制造事件。禁止原位改变workspace或实体id；同一身份删除再新增继续历史修订，不将新对象冒充旧id的第一版。

账本自身不引用可删除的当前行，保留删除前证据。每个workspace／实体种类／实体id以事务advisory lock串行产生正十进制修订，唯一约束兜底；回滚不留下虚假变化或修订。记录时间由数据库产生，但不当作跨事务已消费高水位；未来发现器仍须逐事件回执发现，避免晚提交丢失。

数据库触发器只认固定schema／源表，SECURITY DEFINER固定pg_catalog搜索路径及UTC时间区，目标表全限定，PUBLIC无执行权限。运行账号只有账本读取权限，不可修改主数据、伪造／改删账本、直接执行捕获函数。跟踪的三类源表禁止TRUNCATE，避免绕过逐行删除证据。捕获失败必须使原写入及同事务业务修改整体回滚。

## 表达与完整性

before_snapshot／after_snapshot为JSON对象或SQL NULL，按insert／update／delete互斥；workspace／id与账本锚点一致。mapping.version和capability.metric_version转换为十进制字符串，避免JavaScript读取30位数时丢精度；时间统一UTC，策略JSON按数据库原值保留。

evidence_sha256对PostgreSQL jsonb_build_object('before',before_snapshot,'after',after_snapshot)::text的UTF8字节计算SHA256。它用于校验所保留载荷，不是业务批准、来源完成签认或防数据库owner篡改的签名。database_actor记录实际数据库session_user，不能当作业务审批人；正式审阅身份与依据入口仍待管理流程。

## 后续消费边界

本批只完成追加证据，不把authority_change接入既有input_change发现／消费。下一批须从旧／新快照解析全部历史对象、依赖指标和有效期影响，结合已发布周期及登记种子有界规划，变更旧新范围都须授权；当前行删除或失效时不能静默跳过历史输出或制造正常值。

消费需有独立事件／订阅回执、原子批量入队、失败退避／隔离及恢复，并与真实机器身份／常驻worker接线。能力或映射失效时既有单对象查询仍按当前可信核验拒绝／标stale，不允许以本账本冒充已完成自动重算。空库基线37表，无旧库迁移。
