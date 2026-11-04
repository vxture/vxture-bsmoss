# 用量核验闭环：交互、契约与隔离

2026-11-04，B01-01。业务权威见[规格90](../20-specs/90-usage-verification.md)。本设计先固定契约与验收，不开空壳路由，不宣称B01-02至05完成。

## 代码调查与复用

现有 `domains/map-demo/station-period-rules.ts` 的evaluateWave、baselineDates与WAVE_POLICY负责同星期基线及双门槛；四样本中位数精确保存为分子／2，零基线不输出变化率。当前代码仅4样本可判定，而规格60要求至少3个；本切片扩展共同实现并更新STATION_PERIOD_VERSION，四样本数据值保持不变。

`business-analysis/model.ts` 提供独立无地图读模型，`business-analysis/links.ts` 处理地域／运营商／周期／选区往返。新核验域只读取这些公开适配接口，不反向将演示记录写入measurements、reports或formal审计。现有测量quality为verified／pending／rejected，有独立来源完成、映射及版本依据；不能仅凭有计数值就当数据已完整。当前无独立异常发现或人工核验事件表／权限码，不能声称已具备正式核验存储。

参考yucer的judgement-workspace（案件边界、可复算证据）、pending-reviews（服务端派生业务状态、原因录入）、interaction-timeline（动作历史）。复用交互原则；新页面消费已发布的@vxture/design-system伞包和本产品header，不复制其销售实体、权限或内部design-ui导入。

## 拟定路由与交互

| 路由 | 职责 | 进入／返回 |
|---|---|---|
| `/usage-review` | 发现列表 | launcher用量核验；地图／站址／用量分析带范围进入 |
| `/usage-review/[id]` | 唯一对象详情与原因／复核 | 列表／记录进入；返回保留源列表筛选页码 |
| `/review-history` | 人工记录列表 | launcher核验记录；详情跳转并带对象过滤 |

历史记录通过`event`定位不可变事件，`evidence`指定历史证据版本；不再建另一份详情。跨页上下文包含city、county、operator、metric、period、search、selection；仅接受目标支持字段。case选择为显式行为，普通进入列表不默认选第一项。返回目的限定固定内部路由，不接受任意returnTo或外域。

筛选枚举：metric=bytes／voiceSeconds／sms／all；period=day／week／month；category=business／quality／insufficient／all；status=open／awaiting_review／closed／all。region、geometry、operator继续使用已有严格解析器，单值参数重复、非法枚举、未知参数、非陕西和错配县拒绝。id、evidence、event应严格校验长度与字符；查不到或范围不包含对象时无详情泄露。

列表20项稳定分页，排序发生时间降序再case ID。服务端或演示读适配在分页之前完成范围筛选，摘要与列表同一个已筛选集合；不能先全省取20行再过滤。界面条件不足数量单列，不并入“异常数量”。持续事件按区间与所选周期相交筛选，详情保留完整事件起止／成员窗口，不把窗口裁切后的时长冒充事件总长。

## 领域模型与不可变依据

新域建议 `domains/usage-verification/`：rules纯判定及状态转移；service编排发现、范围与事件；store端口；demo-adapter提供固定版本证据。页面放`usage-review`、`review-history`及共享workspace模块。rules不能读取环境、时钟、存储或平台；service从适配器获得可信身份与数据，store负责同作用域原子追加。此为实现边界，B01-01不会用文档存在代替已实现。

| 对象 | 关键字段 | 不变量 |
|---|---|---|
| FindingIdentity | workspace、station、serviceRelation／operator、metricRef、window、kind、policyVersion | 发现身份不随列表排序或显示单位变化；全部运营商不是虚拟服务关系 |
| EvidenceRevision | ID、revision、digest、dataset／source版本、原量、4个历史位置、质量、完成依据、映射与规则引用 | 已生成版本只读；整数为十进制字符串，未知为null；不保存虚构0 |
| ZeroRun | memberWindows、start、end、expected／verified覆盖 | 连续真实有效零值，每成员可重算，缺口与无效期断开 |
| CaseProjection | caseID、当前证据引用、headRevision、状态、最新原因、依据是否变化 | 状态从事件折叠，不由浏览器任意传入目标状态 |
| ReviewEvent | commandID、previousRevision、action、reason／note、actor、evidenceRef、recordedAt | 追加不可变，命令身份及内容一致才允许幂等重放 |

病例去重基于规范化身份，而不是URL筛选、查询周期标签或显示文本：同一小时发现从日报／周报进入仍为同一个对象。数据修订保持逻辑对象，追加EvidenceRevision；分类或规则改变不能静默覆盖旧发现，建立supersedes关系并保留历史。历史引用读取精确版本，旧记录不指向“最新值”。

## 写入命令与冲突

命令字段为`commandId, caseId, expectedRevision, evidenceRef, action, reasonCode?, note`。不接收workspace、actor、permissions、targetStatus、recordedAt或原始测量替换。正式actor与workspace由可信身份构造，记录时间为提交成功的服务端时间；演示actor固定demo-visitor，时间表示本机演示操作时间，与数据截至严格分开。

命令及对象ID上限128字符，仅允许ASCII字母数字及短横／下划线；note去除首尾空白后1–2000字符，原因只接受规格定义的枚举；expectedRevision为非负安全整数，事件revision严格递增；evidenceRef包含已知版本与64位十六进制摘要，不接受客户端提供原量或自行声明依据有效。写入前重新从可信适配器读取并核对引用。

首次核验headRevision=0，事件从1递增。confirm只能从open进入awaiting_review；approve只能从awaiting_review进入closed；return只能从awaiting_review回到open；reopen只能从awaiting_review或closed回到open。reasonCode仅confirm使用；其他动作须说明。确认与通过要求提交依据等于当前可信证据，旧依据只能查看或退回／重开，不能携旧结论直接通过新依据。

顺序为：校验严格字段→解析作用域与权限→读取可信对象／证据→检查既有commandID回执→比较命令摘要→CAS检查headRevision→校验状态及证据→追加事件并更新投影→提交前复验正式授权／依据→事务提交。相同命令ID不同内容报冲突；客户端不能在结果未知时换ID重发。相同旧命令在后来事件之后重放仍返回原回执，不能倒退投影。

拟定错误含义：400参数／动作非法；404对象不存在或超范围；409记录版本冲突／命令重用／依据变化；503来源或存储暂不可用；正式401／403沿用现有响应。具体正式HTTP接入和权限码在B06登记前不开放。演示使用相同领域错误语义，不开放匿名服务端写入API。

## 本机演示记录存储

采用IndexedDB事务而非localStorage读改写，实现同浏览器多标签CAS及原子追加。数据库独立名`bsmoss-demo-review-v1`；键以datasetVersion＋sessionID＋caseID隔离；events含唯一commandID，projection与event在一个readwrite事务写入。只存本机演示事件与精确证据快照，不读正式cookie、不用真实tenant ID、不写正式PG；无法取得存储时只读并明确提示。

读取未知schema／损坏事件时不默默丢失或重建“成功记录”，隔离并给出恢复／新会话入口。成功提示必须在transaction.complete之后；abort、配额不足或浏览器限制时不更新投影。跨标签通过BroadcastChannel通知重新读取，channel不可用时在窗口获得焦点后重读；通知只是刷新提示，不能当权威记录。

重置是新建session并切换活动指针，旧session与事件保留可回看；不提供删除正式资料的动作。演示证据集稳定、版本明确，场景样例与原地图来源不同则标明，不把新增质量场景写回地图合成数据。正式实现替换为PG store及授权service，不能把浏览器事件作为正式审计导入。

## 权限与正式接续

拟定view／confirm／review三类能力动作，只是待登记契约，不在本切片插入权限或赋权；view不隐含写。正式查询和每次写入均重读平台身份、产品权益、显式本地权限和完整对象／来源范围。历史记录也按其历史完整范围验权，不能只按当前站址或URL筛选判断。后台机器身份仅可生成发现，不允许confirm、approve、return或reopen。

与测量质量决定、来源补传和服务关系维护分离：原因确认不能把pending改verified；来源补齐才产生新证据，再人工核验。不新增告警派单、自动运维控制、退役推演或费用流程。

## 切片与验收出口

| 切片 | 交付 | 必要验证 | 入口状态 |
|---|---|---|---|
| B01-01 | 规格90、设计235、样例U01–12、共用3／4基线修正 | 中位数精度、双门槛、3／4有效样本及零基线、单站历史兼容 | 继续规划中 |
| B01-02 | 有实际发现／证据的列表与详情，隔离演示适配 | 严格范围／查询、分类与成员窗口、空态／未开放、无地图DOM | 完整读路径通过后可开放用量核验 |
| B01-03 | 全部原量、质量／基线及版本证据展示 | 缺数不补零、零量连续性、大整数、3／4有效参考与相同规则对账 | 与B01-02一起验收 |
| B01-04 | IndexedDB演示事件、确认／复核／退回／重开及记录列表 | 幂等、CAS、多标签、刷新保留、旧证据阻断、写失败／归档会话 | 写闭环通过后开放核验记录 |
| B01-05 | 地图／档案／运营商分析与核验双向链接 | 对象明确、范围周期选区保留、不同证据源不假等价、桌面／390截图 | B01整体演示验收 |

B01-02至05完成后再标B01演示闭环完成；正式存储、真实来源与平台注册属于B06，Beta／生产属于B07。

## 只读实现接续（2026-11-04）

实施720完成B01-02及B01-03：rules纯发现规则、query严格服务端参数解析、links客户端安全链接、demo显式版本场景适配；usage-review列表／详情复用已发布DS与现有ProductFrame。为避免客户端带入node:crypto，链接序列化与server查询解析分文件。每个发现由公开逐窗样例重新计算，SHA256绑定身份、窗口及基线版本，查询变化不改发现身份。

完整读路径验收后用量核验入口已开放；核验记录继续禁用。B01-04存储事务与人工状态、B01-05跨模块完整返回上下文仍待；当前不把本机事件契约当作已实现。列表允许按状态过滤，但未产生的待复核／已复核如实为空。
