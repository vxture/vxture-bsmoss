# 登记报告周期生成

设计见[213](../30-design/design_bsmoss_213_registered-report-calendar.md)。I09／I12继续in_progress。

## 实施

新增reports/schedule纯规则及pg-schedule内部服务。登记绑定固定subject、有限scope和精确模板SHA；日／周／月按北京时间自然周期及延迟规划。小时扫描保存不可变作业清单，回看内重复扫描通过报告指纹幂等；缺数保留为缺数，生成与发布独立。

新增5张表：report_schedule_revision／head、report_schedule_scan、report_generation_job／attempt；空库共55表，Prisma仅标量镜像。登记触发器捕获真实数据库actor／JSON摘要、串行连续追加；共享锁函数固定schema及search_path、PUBLIC无执行权。运行账号不能修改配置、绑定、清单或回执，只可推进作业状态列。成功作业通过延迟精确复合FK引用成功回执，回执绑定报告修订及SHA。

抽取既有PgReportStore生成事务核心，不改变交互生成的授权／CAS／指纹行为。执行器与生成共用单RR，SKIP LOCKED避免重复工作，SAVEPOINT分类失败，5次有限退避，无事务外IO或悬挂租约。生成报告／outbox／回执／作业与末次全登记验权原子；暂停与换版由head共享锁串行，旧RR失败要求新事务。

## 验证

纯规则验证日08点／周一09点／次月2日10点、闰月、notBefore、未闭合周期、有限范围及固定退避。真实PG验证受审配置／SQL摘要／actor、三类周期／小时幂等／72小时回补、未接入与不自动发布、数据修订新快照、每阶段完整授权再验、暂停／新版本隔离、模板漂移、旧指纹历史修订与当前修订分离、证据损坏、双worker／scanner、事务中断、失败回执、5次dead、序列化及权限故障、共享锁及旧RR、不可变证据与精确成功FK。

首轮旧239合同场景已执行，新增55表使旧50表计数断言失败，更新为实际55表；其他既有场景通过。新增测试首轮2项owner TRUNCATE断言先被外键检查拦截，改用同事务失败的TRUNCATE CASCADE，验证实际append-only触发器，未放宽运行权限。最终测试计数、类型／构建、Prisma／HTTP、文档／镜像／交付／SCA及ASCII／密钥扫描，以日志和`artifacts/formal-checkpoints/registered-report-calendar.json`为准。

日志`tmp/report-schedule-{unit,db,types,prisma,build,http,guards,ascii,staged-scan}.log`。只使用专用本地随机合同库，收尾停止cluster；无业务数据库操作。没有UI变化，不重复稳定地图六场景或正式报告合成视觉验收。

## 后续与上线边界

接真实机器身份与常驻worker、监控／受审dead恢复和历史报告修订传播；I11正式配置面板、I08对象分布及分层规模仍待。D05真实来源、平台注册、Beta环境、11万站／3倍突发、安全恢复、UAT和生产批准尚未齐备。无push／PR／远端CI／外部部署／正式上线；五项任务1–3本地完成，4–5继续推进，费用预留、退服P2、陕西演示不变。
