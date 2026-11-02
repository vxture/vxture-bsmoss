# 报告导出任务受审恢复

设计见[219](../30-design/design_bsmoss_219_report-export-recovery.md)。接续48d63b2任务监控包，本包完成导出受审恢复，生成任务恢复仍需独立保留扫描来源和唯一性。I09／I12总体继续in_progress。

独立reports.jobs.recover只入权限种子，不自动分配角色；查看、导出、执行及owner均不隐含。独立授权门面沿真实RP组合根接入POST /api/report-jobs/{id}/recover，严格kind=export／原任务ID／expectedAttempt／commandId／reasonRef，配置origin、实际流16KiB、路径一致、no-store／nosniff，未知数据库或网络错误不冒充成功。

PgReportJobStore恢复先按完整历史scope过滤并锁原任务，核验持久报告／摘要和连续尝试，首次恢复须dead且attempt CAS一致。锁报告系列沿用发布写fence，精确原发布须仍活跃、报告完整新鲜、渲染器仍为当前受支持版本；撤回、重发、过期、旧渲染器均不改绑。新pending任务／审计／末次真实身份、租户、权益、显式权限、原与当前有效期和实际范围核验同RR事务提交。保留原dead和全部attempt，不重置失败记录。

每个原任务一次恢复，新任务再次dead可形成后续恢复链。精确command重放须原actor／reason／attempt／任务一致，并核验历史完整scope和当前真实授权；返回原回执，不重新要求今天原发布仍活跃，不声称今天可下载。新任务requested_by取复核者，执行回执仍取实际worker，恢复不隐含执行、报告发布或下载权限。

空库基线新增第57表report_export_recovery和精确终态attempt同租户外键，Prisma仅标量镜像，无迁移。invoker／固定search_path触发器校验旧新精确报告绑定、确定性命令、原scope、终态记录及复核主体，捕获数据库SHA／session_user／数据库时间，禁止改删清空。读回JOIN原新任务／精确终态／持久报告，校验应用SHA、数据库SHA、真实列值、命令和原scope，首次插入后也完整读回校验。

正式工作台增加复核依据、父子任务导航、恢复状态；网络或503不确定时保留原命令并锁表单，明确4xx拒绝后清旧详情要求刷新。无默认选中、无正式身份后门，不改变地图展示。

最终490单测／292实际PG（291子项＋父项，新增8）／双层类型／Prisma／生产构建／20HTTP通过。PG覆盖五次真实失败保留、新任务执行下载、撤回后幂等重放、不改绑新发布、独立权限和所有scope、物理站参数开关的选择／提交／重放、恢复链、不同及相同命令并发、真实发布RR fence、末次各类撤权及SQL回滚、无关scope收缩、不可变审计、同租户FK与摘要／scope／绑定／terminal／command篡改。新增物理站夹具首轮错误使用原无站级参数权限publisher读发布，准确被拒；改由DBA夹具读既有真实发布编号，再通过站级完整授权门面运行，未放宽产品代码。最终292全过。

独立63334实际React合成QA验证“已提交但503”后原command完全一致重试，仅一个replacement；旧新任务双向回溯、五次失败、原准确报告修订保留。1440及390×844实际client1425／375无横向溢出，浏览器无warn／error；证据artifacts/export-recovery-qa，viewport已reset、临时tab10已关闭。合成数据不代表真实平台／来源／客户UAT。

111篇编号／57表／交付／SCA与ASCII／staged密钥扫描、最终SHA及本地63333运行版本见report-export-recovery检查点。日志tmp/export-recovery-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,browser}.log；专用PG仅随机合同库，验收后停止，独立合成服务收尾停止。

五项1–3本地完成、4–5继续active；生成受审恢复、历史报告变化传播、真实机器provider／生产托管、I11配置、I08分布与规模仍待。真实来源、平台注册、Beta环境、11万3倍突发、安全恢复、UAT及生产批准未完成，无push／PR／远端CI／真实接入／外部部署或上线。费用仅预留、退服P2、陕西演示不变。
