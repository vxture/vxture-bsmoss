# 领域数据模型 V0.1

> 范围更新 V0.2：本阶段仅周期性用量分析；本文涉及合同、费率、对账、审批和冻结账单的内容
> 均为未来扩展，不属于当前实施范围。粒度、报告和指标口径以
> [周期分析规格](../20-specs/60-periodic-usage-analysis.md) 为准。


此文件是逻辑设计；尚未声明的实体不是已落库表。DDL 为唯一物理结构权威。
初始 0001 仅实现 station 与 usage_record，需通过后续增量演进。

## 实体与归属

| 领域 | 实体 | 核心关系与约束 |
|---|---|---|
| resource | administrative_area、station | 省市县层级，站址有稳定 ID、生命周期与位置来源 |
| resource | operator_entity、station_service | 运营商类别与法人/结算实体分离；服务关系有有效期 |
| resource | network_node、source_mapping | 逻辑基站/小区/设备类型化建模；来源 ID 与有效期映射 |
| integration | source、ingestion_batch、raw_event | 来源事件唯一；原始载荷引用、摘要、修订链与接收时间 |
| integration | mapping_version、quality_decision | 字段与归属映射、质量规则版本和核验记录 |
| metering | usage_record、usage_revision | 服务关系、实体、类型、单位、时间窗与证据引用 |
| metering | usage_aggregate、aggregate_revision | 独立类型的小时/日/月汇总及输入水位、版本 |
| supervision | metric_definition、metric_sample | 单位、采样方式、阈值口径、采样窗与来源 |
| supervision | alert、alert_event | 告警事实与处置事件分离，状态变更追加记录 |
| settlement | contract、contract_version、tariff | 合同主体、适用服务关系、计价依据、有效区间、舍入与税规则 |
| settlement | billing_period、statement、statement_line | 账期与账单版本、输入快照及分类费用明细 |
| settlement | reconciliation、approval、adjustment | 核对、独立审批和冻结后调整证据 |
| analysis | analysis_job、finding、proposal | 可复现输入范围、证据、模型版本、建议与人工决定 |

建议物理 schema：bsmoss_resource / bsmoss_integration / bsmoss_metering /
bsmoss_supervision / bsmoss_settlement / bsmoss_analysis；数量按事务边界复核后落实。
平台 vx_provision、local_authz、local_usage 保留原契约用途。

## 标识与时间

workspace_id 为第一隔离边界；跨领域引用必须包含 workspace_id，禁止跨工作空间外键。
operator_category 表示电信等分类；operator_entity_id 表示具体主体，other 不能充当结算主键。
station_service_id 表达一个实体在一个站址上的服务关系，同站址可有多运营商，
同运营商可有多服务对象，禁止用“站址数量 × 运营商数量”推算真实服务关系。

source_mapping 由 source_id、对象类型、external_id、有效区间确定。映射重叠必须拒绝。
时间采用 timestamptz，区间 [start,end)，账期由 Asia/Shanghai 解释后转统一存储。

## 证据与计量

raw_event 保留原载荷或对象存储引用、内容摘要、来源身份、接收时刻和版本。
规范记录必须携带 raw_event 引用、mapping_version、transform_version、quality_decision。
用量用整数计数；当前 TS bigint 与 numeric(30,0) 存在上限差异，生产适配前须增加同范围检查。
HTTP 边界用十进制字符串传递大整数，禁止转 JavaScript number。

聚合主维度：workspace + 行政区/站址 + 运营商实体 + 服务关系 + 用量类型 + 时间粒度。
指标定义区分 gauge、counter、interval_delta，分别定义聚合方法；百分比不可直接求和。
行政区与服务关系变化按业务时点归属，历史账单读取冻结版本，不能跟随最新档案漂移。

## 结算完整性

合同与计量并非一对一；每条 statement_line 必须声明计价依据和输入范围。
固定费、阶梯价、资源分摊等模型仅在确认合同后实现。共享分摊需有分母、权重、有效期与
余分处理规则，不能直接按流量占比默认分配。金额、税前税后及税率计算均需明确精度和取整顺序。

## 初始骨架的演进缺口

0001 尚缺运营商实体、服务关系、证据链、映射版本和源对象关联；内存 store 不验证真实站址。
现有 tariff 只有运营商类别且逐记录取整，只用于规则验证，不能进入正式结算服务。
B1 优先补齐上述实体、同租户外键、列锁、应用角色授权、Prisma 镜像与数据库契约测试。


## V0.3 指标与展示模型补充（逻辑设计）

metric_definition 为跨领域统一口径目录，由指标注册服务唯一写入；来源映射属于 integration，
事实样本由各所属领域写入，目录主分类不改变事实对象归属。
新增规划实体 metric_definition_version、metric_dependency、source_metric_capability、
measurement、state_event、view_template、view_template_version、user_view_preference。
测量事实需分整数/定点数/状态等受约束值类型，不把所有值转成浮点或任意 JSON。
经营用量沿用整数计量语义，运营状态及物理参数采用合法测量类型，配置只引用版本化指标。
上述未落库，需与权限、外键、单位及模板验证共同设计增量。
