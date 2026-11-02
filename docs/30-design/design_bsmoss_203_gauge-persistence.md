# 设备瞬时值可信周期持久化

2026-11-03。承接 I08 设备状态与 I11 单对象查询。首个字典定义为环境温度 runtime.environment.temperature_c@1，单位 degC、设备物理归属、不可跨对象相加；生命周期仍为 planned，不代表来源已接入。

## 策略与精度

来源能力须为 active、有 validation_ref、覆盖完整目标周期，并提供 rules.gaugeAggregation：version=1、authorityRef、mode、scale。scale 为0–9；sample_mean 禁止 durationRef，time_weighted 必须有明确的 durationRef 说明来源窗口内有效时长语义。策略由可信数据库读取，请求不得传入。

只支持5分钟／15分钟／小时／日固定原生窗口，目标15分钟／小时／日／周／月。每条测量必须恰好覆盖原生网格并属于有效映射，不接受事件采样、自动保持、插值或跨窗口均摊。映射切换须对齐网格；映射、设备、来源和完整scope按已有分层验权。物理设备数据禁止挂到运营商服务／网络对象。

原始定点数以最多30位有符号十进制 unscaled 和整数 scale 表达，禁止浮点计数。结果均值保存分子／分母字符串，实际数值为其比值再除10^scale；极值保留 unscaled 和观测时间。样本均值按合法样本数计算，coveredMilliseconds=null，不宣称有效时长；有审阅依据的时间加权均值按来源窗口毫秒数计算。加权分子可超过30位，以JSON字符串存储，不截断到numeric(30,0)。

## 证据与完整性

先选同事件／分量的最高事实与质量修订，再过滤对象和周期；修订移设备或移日期时旧值撤回，不复活旧版。pending／rejected不参与均值，但进入证据与摘要，缺采保持partial／missing；无合法值为null，不补零。重复权威、错scale、错映射和冲突重放拒绝。

全对象 source_completion_set 绑定所有有效映射窗口及最新事实／质量／能力／策略摘要。只读最高证明，确认与输入相符且采样齐全才complete；撤销或失效不回退旧确认，确认不能补缺数。时间偏移等价表示先规范化，输入顺序不改变摘要。

## 存储和执行

复用 PgAggregateRepository 的期望修订、幂等、指针、追加历史及outbox事务。aggregate_revision 增 gauge_value JSON，并与区间／比率／状态列互斥；DDL检查模式、精度、非零分母、字符串位数、极值和载荷一致。仍36张空库基线表，Prisma仅标量镜像，不做旧库迁移。

授权刷新将可信输入、当前head、结果、outbox和成功回执放在同一REPEATABLE READ事务。并发新事实与新head不能被旧快照覆盖，回执失败整体回滚。事实／质量及完成证明沿既有输入传播机制；当前自动修订订阅仍只支持日／周／月，不能据小时查询能力宣称小时调度已完成。

GET /api/aggregates 沿既有授权一致读取链路支持gauge，原始精度和历史完整性保留；当前输入不同标stale。演示场景不虚构温度，原11项合成样例保留。尚无真实温度连接器、环境参数UI、跨设备权威汇总或上线验收。
