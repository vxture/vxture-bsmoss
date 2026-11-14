# 正式周期报告持久快照

本批推进I12生成与回看出口。保存的是generated数据版本，不代表对外发布、审批或异步文件已完成。后续发布／撤回事件、异步导出和常驻调度继续沿完整目标推进。

## 模板和输入

复用bsmoss_views.template_version，要求template_kind=report、definition.schema=periodic-report-template-v1。定义包含title、grain（日／周／月）、现有合法panels和逐面板bindings：单对象聚合、受审区域汇总、明确未接入。面板按现有指标／单位／语义校验，报告不受个人显示偏好影响；三类章节均留配置状态，已配置面板即使visible=false也保留数据与缺数状态，隐藏不能改变完整性。首版最多16个面板、同一周期；模板版本暂遵循现有展示引擎的正安全整数限制，测量和结果修订仍为十进制字符串。

请求仅模板code／version、at和expectedRevision。指标／来源／映射／区域汇总编号来自已存模板；值、租户、actor和scope不得从请求进入。已发布区间、状态和温度聚合以及受审区域汇总均可作为数据源。报告不现场发布聚合，不通过合成数据补缺口。未接入、未发布、missing／partial／preliminary／not_applicable、已失效分别留痕；不能把设备时长、温度或比率当普通计数相加。

周／月保留周期结果，同时强制绑定周期内每个自然日的发布修订；所有读取在同一事务，日结果缺数／未发布不能称完整，日结果单独改版也使报告stale。日状态／温度不直接跨对象相加，周期合法值由已有语义计算器产生；逐日记录承担可追溯与修订依赖。报告实际scope合并周期和逐日读取所需权限，直接比率不擅自增加未使用的次数权限，依赖模式则保留真实所需依赖权限。

## 原子生成

新增report_series／report_revision／report_outbox，共45表空库基线，无旧库迁移。series按租户＋模板版本＋grain＋自然周期唯一；revision追加保存完整规范模板、原数据结果与版本证据、必要有限scope、类别状态、周期和SHA。outbox仅report.generated，不伪装为已发布或已导出。运行角色只能追加修订和outbox，series仅开放current_revision列；模板原文仍需管理发布路径，现有运行角色拥有模板INSERT但无HTTP模板写入口，模板不能授予数据权限或改变来源权威。

整个生成用一个REPEATABLE READ事务读取模板、全部单对象／区域数据和report head；区域汇总复用事务内核心，不嵌套BEGIN／COMMIT。保存修订、推进head、outbox及成功前再验权原子提交。指纹重放返回旧版本但不回退head；expectedRevision保护并发，旧RR快照不能借用新head覆盖已生成的新报告。没有数据的面板也可生成明确缺数的版本。

新本地权限reports.generate属于已有metering能力；不新增平台套餐或自动赋权，workspace owner也不自动获得生成权限。回看使用metering.view。组合根提供实际RP／权益／本地grant，数据层以后复用可信机器身份。每次调用前后均验同主体、同租户、有效期、权限和报告实际使用的全部scope；撤回不相关的父grant范围不应误删报告可见性。

## 回看和新鲜度

GET /api/reports/{id}可选明确revision，只返回当前租户且当前仍授权完整历史scope的快照。原模板与数据保持不可变，单独返回currentRevision和freshness。读后再验权，no-store／nosniff／Vary Cookie，演示不授予正式访问。

当前模板原文改变、成员发布修订改变、输入／质量／完成／权威变化、来源不可用、区域配置更新或暂停都使旧报告stale；不能修改原快照或回退旧确认。区域配置先比较精确修订，若当前已换版，只报告配置变化，不读取新配置中的越界成员。授权／SQL故障不能吞成missing或伪current。返回的freshness是一次RR快照结论，不承诺返回后不发生变化。

## 验证和后续

纯规则验证模板／三类语义、周期和未接入、精确整数、未知字段与伪授权拒绝。实际PG验证三类／区域同快照、不可变与租户FK、生成／重放／旧重放不回退、CAS与旧RR竞态、outbox故障和末次撤权全回滚、完整历史scope、已失效报告及原证据保留、模板和区域配置变更、匿名HTTP无样例回退。

这是持久报告链路的第一部分；发布／撤回、异步HTML导出、后台周期报告任务、正式页面、真实来源与业务签认仍为后续，不能把generated称上线或完整I12交付。
