# D03 首批指标执行字典 V1

日期：2026-10-28。状态：内部设计基线完成，未进行真实来源核验。
对应 D03-1/2/3；所有首批指标定义 version=1、lifecycle=planned。
这是下一步实现的契约，不表示来源已 active。

## 通用约束

业务日期与聚合窗口使用 Asia/Shanghai、[start,end)。grain 为 15m/hour/day/week/month，
仅允许从更细且精确对齐的来源向更粗聚合，不能细化。所有输入携带 workspace、station、
对象、source、证据引用、源窗口、映射版本、字典版本、修订版本与质量结论。
operatorEntity/serviceRelationship 仅在指标适用时必填；共享站址物理量不伪造运营商归属。

计数使用非负整数十进制字符串，经解析为 bigint 计算；持久化上限 10^30-1。
浮点不能用于整数字节与电量。超限或非法语义拒绝，未测量为 null，不用零替代。
本字典的单位仅指规范测量单位；原始单位与转换系数保留在证据中。
同站不同来源、重叠窗口和修订记录须先按权威来源/版本选取，禁止全部相加。

## 指标定义

| metricCode | 名称/类别 | 规范类型/单位 | 对象与必需归属 | 时间聚合 | 跨对象聚合 | 合法展示 |
|---|---|---|---|---|---|---|
| service.voice.connected_seconds | 接通通话时长/经营 | interval_delta / second | 网络统计对象+主体+服务关系 | 不重叠窗口求和 | 同口径互斥统计对象求和 | 秒、分钟、小时 |
| service.voice.attempt_count | 呼叫尝试次数/经营 | interval_delta / count | 同上，统计点固定 | 求和 | 同统计点且可去重对象求和 | 次 |
| service.voice.connected_count | 接通次数/经营 | interval_delta / count | 与尝试次数同对象同口径 | 求和 | 同上 | 次 |
| service.data.uplink_bytes | 上行流量/经营 | interval_delta / byte | 网络统计对象+主体+服务关系+上行 | 求和 | 同层互斥对象求和 | B、MB、GB、GiB |
| service.data.downlink_bytes | 下行流量/经营 | interval_delta / byte | 同上+下行 | 求和 | 同上 | B、MB、GB、GiB |
| service.data.total_bytes | 总流量/经营 | derived / byte | 同主体、对象、层次、窗口 | 从上下行和派生 | 从互斥对象上下行和派生 | B、MB、GB、GiB |
| service.sms.success_count | 短信成功量/经营 | interval_delta / count | 授权统计点+主体+服务关系+MO或MT方向 | 求和 | 同统计点、同方向且去重后求和 | 条 |
| status.voice.connection_rate | 接通率/运营状态 | ratio / ratio | 与呼叫尝试/接通次数一致 | 汇总分子分母后相除 | 同统计点的合法分子分母求和后相除 | % |
| status.radio.prb_utilization | PRB利用率/运营状态 | ratio / ratio | 小区+主体+服务关系+上或下行 | used_prb_time/available_prb_time | 同制式和资源定义先合并分子分母 | % |
| runtime.energy.site_wh | 站址电耗/运行参数 | interval_delta / Wh | 站址+权威总表 | 求和 | 不含上下级重复电表的互斥站址求和 | Wh、kWh |
| runtime.device.state | 设备状态/运行参数 | state / enum | 站址+设备 | 各状态时长、转换次数、最后状态 | 同时点各状态设备数；状态时长仅称设备秒 | 状态、秒、设备数 |

网络统计对象不能预设为站址：来源为小区时先去重及有效映射再汇总到站址。
每项定义的 allowedGrains 均受来源能力约束；设备状态在基础层建立有效区间再汇总。
趋势、卡片、表格均可用；计数可排行；比率排行必须附分母与覆盖率；状态展示用时间带或状态表，
禁止将枚举映射为 0/1 后画平均值趋势。

## 派生与质量契约

总流量：仅当同窗上下行都有效时输出完整结果；缺一方向则 total=null，可单独展示已有方向及缺失提示。
已接入但尚未验证是否双向互斥时，不自动注册总流量已支持。
接通率：connected/attempt；attempt=0 时 null，原因 zero_denominator；connected>attempt 拒绝。
该比率仅在来源定义为同统计点同队列事件时成立，跨窗呼叫若源口径不满足此关系，需另立指标版本。
PRB：分子分母为一致资源单位乘时间，先源适配统一；0≤used≤available，available=0 时 null。
不以“每15分钟利用率”的算术平均代替合并资源时间。上下行分别处理。

电耗：来源为累计表计时先差分；首读仅作基线；下降时须有明确复位/回绕依据，否则 pending。
站址总表与分表是总分关系，不把分表再加进总表；没有主体归属不显示主体电耗。

设备状态枚举：running、standby、fault、offline、maintenance、unknown。
厂商状态无法可靠映射时 unknown；offline 是来源明确离线，缺心跳只产生 unknown。
每条事件带 occurredAt、validUntil、来源序列/修订。validUntil 必须由来源能力声明的 TTL 得到，
在有效期内保持状态；被新事件截断，超时不沿用。初始无事件区间为 unknown。
同设备同刻冲突无明确序列时 pending，不任意选最后接收者。
转换次数只计已知状态之间实际变化，unknown 边界单列为质量缺口转换，不作故障恢复次数。

各指标输出同时附 expectedWindows、validWindows、quality、watermark、revision。
partial 不等于 complete；可展示有效数据之和，但必须注明部分值且不可直接用于跨覆盖率排行或环比。
费用字段不进入本字典，显示精度不得改变存储或计算精度。

## 手工验收样例（技术基准，非真实来源）

均为同日相邻 15 分钟、同主体、同对象、证据有效；比率写分数避免中间舍入。

| 样例 | 输入 | 预期 |
|---|---|---|
| A01 通话 | 120秒、180秒 | 小时已知部分=300秒，显示5分钟；其余窗口缺失则 partial |
| A02 双向 | 每窗 UL=100/200 B，DL=300/400 B | UL=300，DL=700，总量=1000 B |
| A03 缺方向 | UL=100，DL=null | UL=100，total=null，missing_dependency |
| A04 接通率 | 第1窗 90/100，第2窗 1/10 | 91/110≈82.7273%，不是50% |
| A05 PRB | 第1窗 50/100，第2窗 9/10 | 59/110≈53.6364%，不是70% |
| A06 零分母 | 尝试0，接通0 | null，zero_denominator，不输出0%或100% |
| A07 非法计数 | 接通11、尝试10；或字节-1 | 拒绝，不入verified |
| A08 累计电表 | 10000Wh→10300Wh→10500Wh | 首读基线，增量300+200=500Wh=0.5kWh |
| A09 表计下降 | 10500Wh→100Wh，无复位证据 | pending，不输出负电耗或假定100Wh |
| A10 设备状态 | 00:00 running有效至00:10；00:05 fault有效至00:12 | [00:00,00:15) running300秒、fault420秒、unknown180秒；已知转换1次，窗末unknown |
| A11 合法换算 | 1073741824B | 1GiB 或1.073741824GB；保留原值 |
| A12 事件重放 | 同事件同修订重复2次 | 计一次；冲突载荷进入隔离 |
| A13 原生小时 | 1小时600秒通话 | 可日聚合，不生成4条虚构15分钟记录 |
| A14 时间边界 | 周日23:45及周一00:00窗口 | 分属不同自然周，无边界重复 |
| A15 权威重叠 | 总表500Wh、分表200Wh | 站址总量500Wh，不是700Wh |
| A16 上限 | 10^30整数 | 拒绝超出numeric(30,0)边界；10^30-1有效 |

## 内部设计检查与后续

D03-1：11个稳定代码，三类覆盖；D03-2：时间与对象聚合、分母、状态和原生粒度分别说明；
D03-3：16个手工样例含非法、缺失、重放与边界。内部一致性检查完成，真实字段核验仍归D05。
下一步 I01 以此实现字典注册与验证；D04据此细化物理模型，D06细化配置契约。

