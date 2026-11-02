# 文档地图

- 20-specs：产品定义、领域划分、业务规则。
- 30-design：架构与数据设计。
- 40-implementation：代码入口与接入约束。
- 50-deployment：部署准备条件。
- 70-workplan：分批交付与待定项。
- 90-memory：后续代理入口。


## 规划设计 V0.1

- [产品规划](../20-specs/40-product-plan.md)
- [门户信息结构](../20-specs/50-information-architecture.md)
- [业务流程](../30-design/design_bsmoss_110_workflows.md)
- [系统与接入设计](../30-design/design_bsmoss_120_system-design.md)
- [容量与验证](../30-design/design_bsmoss_130_capacity.md)
- [领域数据模型](../30-design/data_bsmoss_200_domain-model.md)
- [实施路线与待确认事项](../70-workplan/10-design-roadmap.md)

## 当前范围 V0.2

[周期性用量分析](../20-specs/60-periodic-usage-analysis.md)：指标分类、15 分钟至月粒度、
日报/周报/月报、质量与修订规则。费用仅预留，覆盖 V0.1 一期费用安排。

## 当前指标体系 V0.3

[三类指标与显示配置](../20-specs/70-metric-catalog.md)：经营服务性、运营状态、运行参数，
完整候选目录、来源能力、聚合与显示模板。覆盖旧版将后两类仅视为用量辅助指标的表述。

## 敏捷交付

[任务入口](../70-workplan/00-index.md) 包含阶段推进、待办台账、首轮迭代以及部署上线计划。

## 首批执行字典

[D03 首批指标](../30-design/design_bsmoss_140_first-metrics.md)：稳定代码、聚合与16个手工验收基准。

- [D04测量契约](../30-design/data_bsmoss_210_measurement-contract.md)
- [D06显示配置契约](../30-design/design_bsmoss_150_view-contract.md)

- [I03空库验证记录](../40-implementation/20-database-contract.md)：PostgreSQL及Prisma实测、重现方法与限制。

- [I04测量适配器验收](../40-implementation/30-measurement-store.md)：事务、重放、范围与真实DB验证。

- [I10样例门户验收](../40-implementation/40-sample-portal.md)：三类入口、配置保存、样例HTTP边界和本地运行。

- [I05内部授权适配](../40-implementation/50-trusted-access.md)：可信上下文、两道门、有限范围、测量门面及未完成通道。

## 持续交付（2026-11-02）

- [单站周期报告](../40-implementation/270-station-period-report.md)
- [演示体验与六场景验收](../40-implementation/280-demo-acceptance.md)
- [回补与修订窗口核心](../40-implementation/290-refresh-window-planning.md)
- [真实接入与上线前置](../50-deployment/40-live-prerequisites.md)

- [可信依赖输入](../40-implementation/300-trusted-derived-inputs.md)：方向总流量、次数接通率的授权快照与原始证据。
- [跨映射组合完成证明](../40-implementation/310-composite-completion.md)：全对象周期确认、最高撤销和不可变证据。
- [持久刷新队列](../40-implementation/320-durable-refresh-queue.md)：租约抢占、失败重试与结果／回执原子提交。
