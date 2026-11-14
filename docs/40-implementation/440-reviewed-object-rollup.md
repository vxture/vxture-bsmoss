# I08 受审跨对象区间汇总

2026-11-03。[设计208](../30-design/design_bsmoss_208_reviewed-object-rollup.md)。正式只读汇总链路新增切片，不代表 I08 全部关闭或已上线。

## 实施

新增 object_rollup_revision 受审有限覆盖配置，空库基线共42表，Prisma标量同步；不迁移旧库。运行角色只有 SELECT，管理追加时触发器按租户／编号串行、强制连续修订、计算JSONB SHA并捕获数据库actor和时间，禁止改删／截断。引用是审阅资料定位，不把数据库actor或SHA称为业务签名。

object-rollup纯规则限制最多256原子／64成员，经营原子为站址＋服务＋小区，站级电耗原子为物理站。总表／分表和跨来源同原子互斥；预期总体明确配置，不按当前有数的对象推导总体。实际PG拓扑逐项验证同租户真实小区和服务归属，总表仅覆盖同站同服务；父对象不能当原子。即使原子清单不同，同来源同稳定对象的新旧映射别名也不能重复贡献。

PRB必须使用可合并的容量×有效时长分母，接通率使用尝试次数；当前能力的intervalAggregation.objectBasis必须匹配配置basis。只合分子分母，不平均百分比；零分母保留0/0证据，输出比率为空。站级电耗不带服务／设备／网络对象，不向运营商分摊。温度和设备状态不进入本区间求和接口，后续独立实现合法分布。

pg-query抽取事务内读取核心，原单对象接口保持原行为。PgObjectRollupReader用一个REPEATABLE READ READ ONLY事务读取最新配置、完整归属、当前可信快照及全部已发布成员，禁止循环开多个快照或临时发布。并发新配置／事实／发布只在下一查询可见，输出绑定精确配置修订、原始／语义摘要、成员seriesId／revision／输入和当前指纹／权威修订依据。calculationFingerprint为计算摘要，外层fingerprint覆盖响应除自身外的所有字段，包括租户、配置指针与归属。

缺覆盖、未发布、来源权威不可用、审阅generation变更和旧发布分别留痕；旧结果不参与可信小计。已确认完整总体才提供value，preliminary／partial仅提供knownValue；完全不适用与缺数／零分开。不适用成员不拖低其他有效成员水位。物理站数去重，serviceCount为配置总体服务数，applicableServiceCount为周期内有服务窗口交集的独立服务数；这些不是运营商加总站数或全省同时峰值。

新 GET /api/aggregates/rollups 仅接受rollupId／grain／at，通过现有RP cookie、权益、metering.view和有限scope，调用前后重新验权；全部预期原子和所有来源均需授权，不裁剪。返回no-store／nosniff／Vary Cookie。演示开关不授予正式访问，也无样例回退。数据库故障不能吞成missing，配置暂停不回退旧active。

## 验证

437单测（新增9）通过。新增15个实际PG场景，当前193项报告测试（192子项＋父项）通过：配置只读／连续修订／实际双连接并发串行／SHA、总分表与跨来源互斥、物理站去重和多运营商归属、完整scope及无来源原子、确认完整值／未发布／缺覆盖、旧发布排除、generation改回不复活、加权比率和0/0、PRB依据不兼容、站级电耗归属、小区与总表别名、服务不适用、故障传播、单RR并发暂停／事实／发布、结果返回前撤权。

初轮新增夹具缺PRB字典记录触发FK；补齐字典后，旧完成证明被错误纳入再次签认的基准指纹导致测试仍preliminary，修正为去掉旧证明后绑定基础快照，未放宽产品完成条件。随后全PG通过。又把配置并发改为实际两个数据库连接并验证advisory等待／连续推进，补有效服务数和可独立校验响应摘要断言后执行最终回归。最终类型／生产构建／Prisma／20HTTP、文档编号／42表镜像／交付／SCA配置守卫、ASCII／密钥、Git及运行SHA，以tmp/object-rollup-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log和artifacts/formal-checkpoints/reviewed-object-rollup.json为准。

专用PG仅创建删除随机合同库，收尾停止；没有业务库操作。无依赖或演示布局变化，不重复已稳定的六场景UI验收。

## 继续推进

当前出口是有限区间汇总，不是11万站全省原始扫描。设备状态分布／温度分布、配置审阅工具和跨分区分层汇总仍需后续设计与容量实测，I08保持in_progress。I11正式面板、I12持久报告／异步导出，I09自动分区／真实机器身份／常驻调度继续待办。

五项1–3已本地完成，4缺真实来源与平台注册资料，5继续内部实质推进。Beta环境、11万容量和3倍突发、安全恢复、业务UAT及生产批准尚未取得。未push／PR／远端CI／真实接入／外部部署／上线；费用预留、退服P2、陕西演示不变。既有active目标和bs-moss heartbeat继续复用。
