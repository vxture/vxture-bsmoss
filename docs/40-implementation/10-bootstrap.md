# 当前代码入口

- shared/model.ts：运营商、站址、计量对象与双门上下文。
- metering/lib/rules.ts：标准化记录校验。
- metering/service.ts：权限、工作空间与采集编排。
- metering/store.ts：端口与测试用内存实现。
- settlement/lib/rules.ts：整数计价与费率时间窗校验。

测试覆盖来源重放、冲突、租户隔离、双门、非法单位和时间窗、未归属用量拒绝结算、
大整数与金额舍入。生产适配器必须另外验证真实数据库并发、唯一约束及事务。


## 指标字典核心 I01

domains/catalog/registry.ts 提供版本化注册、单位/聚合/维度/依赖校验和不可变快照。
first-metrics.ts注册11个planned指标；registry.test.ts验证非法定义与依赖循环。
不承担来源启用、权限适配、实际聚合计算、模板持久化或显示功能。

## 显示配置核心 I02

domains/views/resolve.ts 解析可信服务提供的配置与权限结论。输入模板及角色/页面层应从
同工作空间已验证配置读取，能力矩阵应由当前行范围的来源能力解析器提供，不能接收客户端自报权限。
report模式保留模板版本且忽略个人偏好；发布/退役状态、审核及持久化由后续配置服务负责。
不支持来源粒度时返回not_connected，当前表示此指标粒度组合不可用，不等于全来源离线。
依赖授权采用保守策略：派生指标及其输入都需授权；如未来允许只读派生指标需单独设计受控服务。
状态card/timeline仅接受state单位，状态table可展示时长/设备数。
输出固定要求quality/freshness/revision/definition；具体数值与结果状态由查询服务填充。

## 数据结构I03第一批

新增0002_resource_relationships.sql；不修改0001。Prisma镜像暂覆盖5表，
只镜像标量外键字段，引用约束由DDL执行；未运行Prisma validate/generate。
静态镜像检查不是SQL解析器，不覆盖FK、CHECK、权限、迁移或运行时行为，
当前仅适用本仓库CREATE TABLE基线形态；未来ALTER需升级检查器，不能据此宣称完整架构一致性。
服务关系可有多个独立服务，未设置同主体同站址唯一性；未来来源映射仍需有效期排斥约束。
尚未创建数据库应用角色、授权或部署，不能把新增表直接用于生产。

## 新产品空库基线更新（2026-10-28）

用户明确本产品无需旧库迁移。此前0001/0002未执行草案已合并替换为00_baseline.sql，
不保留旧UsageRecord表；Prisma同步为15表。按00→97→98在空库一次初始化，
不存在升级迁移、旧库兼容或历史数据搬迁任务。之前相关表述为已废止计划。
新增来源证据、映射排斥、能力、类型化测量、质量决定及配置版本存储。
97要求预先提供非owner的bsmoss_svc，98仅允许修改模板当前指针；行范围仍需服务端授权。
当前尚未完成真实PostgreSQL和Prisma CLI验证，I03仍in_progress。

## 最新验证状态：I03完成（2026-10-28）

此前“无PostgreSQL/未实测”的记录已被后续实测覆盖。独立本机PostgreSQL18.4建库、
15个DB子检查及Prisma validate通过，I04 ready。证据见40-implementation/20-database-contract.md。
这不代表业务部署、真实来源接入或页面完成。

## I04当前入口

新的measurements/{store,rules,service,pg-store}.ts负责测量事实持久化；旧MemoryUsageStore
仅为原型测试，不接空库基线。完整限制与验证见30-measurement-store.md。
