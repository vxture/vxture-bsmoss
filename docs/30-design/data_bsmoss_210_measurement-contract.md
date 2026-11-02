# D04 主数据与测量契约 V1

状态：内部逻辑设计完成；未新增DDL，真实来源核验归D05。

## 主数据

operator_entity：workspace、id、category、name；category不是主体主键。
station_service：workspace、id、stationId、operatorEntityId、validFrom、validTo。
device：workspace、id、stationId、type、ownership；共享设备可无运营商归属。
network_object：workspace、id、stationId、serviceId、kind（基站/小区/统计点）。
source_mapping：workspace、source、externalType、externalId、validFrom、validTo、target、version。
同来源外部标识的有效区间不可重叠，所有跨对象引用带workspace，禁止跨租户外键。
对象变更追加版本，分析按事实发生时点选择映射，不能用当前归属回写历史。
服务关系不硬删除，终止有效期；测量引用历史版本。

## 指标与来源

metric_definition_version 唯一键(code,version)，发布后不可变，依赖固定到明确版本。
source_metric_capability 绑定workspace/source/metric版本/对象范围/原生粒度/语义/转换版本/有效期。
active需样例验证记录；目录planned不代表接入active。状态TTL、计数回绕位数由能力声明。

## 证据与事实

raw_event唯一键(workspace,source,eventId,revision)，载荷摘要与对象存储引用不可变。
相同键相同摘要幂等，不同摘要隔离；修订引用前版，保留接收时间、来源发生时间及原始单位。
measurement唯一键(workspace,source,eventId,revision,metricCode,metricVersion,componentKey)。
componentKey包含类型化对象与方向等规范维度，不能依赖不稳定JSON字段顺序。
每条事实绑定映射/转换/字典版本、证据与质量决定；有效窗口[start,end)。

值使用互斥结构：integerDelta(value numeric(30,0))、ratioParts(numerator,denominator)、
fixedPoint(unscaled,scale)、stateEvent(state,occurredAt,validUntil,sequence)。
物理存储采用类型列及CHECK互斥或分表，I03评审后决定；禁止所有值无约束塞进JSON。
缺失值是质量记录，不伪造数值0。质量决定独立追加版本，事实不覆盖。
ratioParts保留资源时间单位与统计点；计数型分子不得大于分母，零分母可入库但结果为null。
状态事实独立于区间数值；unknown与offline含义不同，过期区间为unknown。

## 聚合与事务

aggregate_revision固定workspace、metric版本、对象集合摘要、规范维度、grain、窗口、revision，
记录输入水位、输入版本摘要、聚合规则版本、质量及结果类型，结果可追溯至输入集合。
重算发布新版本，事务中切换current指针并写outbox；并发按版本条件更新，失败重试不重复发布。
跨来源权威选择、窗口重叠、设备总分关系先解析再聚合。历史报告引用固定版本。

## 数据库落地验收

I03同时交付DDL、Prisma、角色授权、列锁和新库/升级演练；包括跨租户引用拒绝、
映射区间冲突拒绝、并发事件幂等、修订不可覆盖、类型互斥及numeric边界的真实DB测试。
现有0001保持原样，以增量补充或迁移字段；旧UsageRecord不是完整测量模型。


## 新产品空库基线更新（2026-10-28）

用户明确本产品无需旧库迁移。此前0001/0002未执行草案已合并替换为00_baseline.sql，
不保留旧UsageRecord表；Prisma同步为15表。按00→97→98在空库一次初始化，
不存在升级迁移、旧库兼容或历史数据搬迁任务。之前相关表述为已废止计划。
新增来源证据、映射排斥、能力、类型化测量、质量决定及配置版本存储。
97要求预先提供非owner的bsmoss_svc，98仅允许修改模板当前指针；行范围仍需服务端授权。
当前尚未完成真实PostgreSQL和Prisma CLI验证，I03仍in_progress。
