# I12 正式报告异步HTML导出

2026-11-03。[设计211](../30-design/design_bsmoss_211_async-report-exports.md)。接续f6dfcfe报告发布／撤回，本批完成内部持久导出任务、单步执行、授权状态与下载；I12保持in_progress，正式页面／命令和常驻调度未完。

## 实施

新增exports纯规则、ReportExportStore、PgReportExportStore、renderPublishedReport及独立授权组合根。请求只接受reportId／精确publicationRevision／commandId，服务器绑定报告修订／SHA／rendererVersion；租户命令幂等且绑定原请求主体，不保存令牌，不按新发布自动重绑定旧任务。reports.export与reports.export.execute为独立显式本地权限，仅入种子不赋role；owner／view／generate／publish不隐含导出或后台执行权限。

空库新增report_export_job／report_export_artifact／report_export_attempt，共50表；Prisma标量同步，无旧库迁移。任务可更新列只开放state／attempt／数据库时钟退避及制品SHA；身份、发布引用、renderer及请求资料不可由运行角色改写，制品／回执只追加。任务必须精确引用同租户published事件、报告修订及SHA；制品SHA由SQL按实际UTF8内容检查，成功任务／回执引用精确制品。最大2MiB，不截断证据。

report_series新增current_publication_revision，由既有发布触发器在同事务维护，运行角色不能直接更新；精确外键延迟至事务提交。发布／撤回／请求／执行锁同一series。执行较早RR快照若遇随后提交的发布变更，行版本检测回滚，不能用旧事件生成已撤回制品。普通报告和发布读取继续复用事务内核心。

异步任务先持久pending，内部run只接明确jobId，FOR UPDATE SKIP LOCKED锁任务；在同一RR事务内以SAVEPOINT读取可信发布／当前输入、纯HTML渲染、追加制品，随后写成功回执及任务状态并末次再验权。没有事务外IO或外部文件地址，因此进程中断整事务回滚到pending，无悬挂租约；未来改远端渲染需另设计租约。故障先回滚工作，再追加固定分类回执，5／10／20／40秒数据库时间退避，最多5次；过期／撤回／超界明确dead。身份／scope／权限／权益故障、SQL权限拒绝和序列化冲突全回滚，不算普通渲染失败。

HTML自包含中文三类章节，模板显隐可展开、显示单位／精度、超安全整数、比率原分子分母、零分母未知、状态秒／期末单设备分布及原毫秒、温度样本／时长加权口径、极值发生时间、逐日依赖和原计量证据。主日期／水位／生成发布及极值按北京时间显示；原证据保留UTC。转换使用BigInt分数和明确约等显示，原始精确值不丢。所有动态文本HTML转义，证据为文本，没有脚本／外链／网络请求。

公开新增GET /api/report-exports/{id}状态及?format=html下载。请求和执行仍内部服务调用，正式机器身份provider及常驻worker未接入。每次下载独立重新核验实际RP／权益／reports.export、完整原报告scope、精确活跃发布及当前完整新鲜结果，按固定renderer重新渲染并比实际内容SHA。撤回／替换发布／新生成版本或数据过期会拒绝旧制品；保留审计不意味着还能下载。状态可显示历史成功，但downloadable与阻断原因独立。响应no-store／nosniff／Vary Cookie／CSP sandbox／attachment安全文件名，不回退演示样例。

所有读结论为一个RR快照。并发原始事实修订不会混进半份报告，随后下载会发现stale；已经交付离线副本无法回收，不承诺追溯撤销并发中更早的读取快照。

## 验证

460单测（新增7）和233项实际PostgreSQL报告测试（232子项＋父项，新增13）通过。覆盖精确输出／XSS／有界内容、三类真实完成报告、非默认状态单位和0/0、命令／actor幂等、独立权限／owner、全阶段末次scope／权限／主体／权益／有效期撤回、双worker抢占、中断回滚／重启、5次持久退避与dead、制品／回执SQL故障原子、篡改有效数据库摘要仍不能通过重渲染、撤回／重发不复活旧任务、事实与生成版本修订、发布写fence及旧RR、跨租户／完整历史范围、SQL列权限／FK／摘要和原始事实并发修订后的下载过期。

首次单测失败为手写GiB期望小数错误，独立BigInt整除／余数核对后修正夹具为83886080000000010.463006692，原计数90071992547409931234567890仍完整；未放宽产品规则。首轮231PG通过，补并发事实及非默认单位后233通过；浏览器发现主时间UTC后修正北京时间，再执行最终全量检查，结果以收尾日志为准。

桌面及390×844浏览器视口实查标题／隐藏面板展开／长数值／原证据入口，手机实际内容与视窗宽均375，无横向溢出；临时视口已reset，QA页已关闭。只生成合成fixture的artifacts/report-export-qa/report.html，不含真实来源资料，也不替代三类真实客户UAT。未改地图布局，不重复稳定六场景演示验收。

北京时间修正后的最终460单测／233实际PG／双层类型／生产构建／Prisma validate／20HTTP通过，95篇文档／50表镜像／交付／SCA配置守卫及20文件ASCII通过。日志tmp/report-export-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log；密钥／Git／运行SHA见async-report-exports检查点。专用PG只使用随机合同库，无业务库操作，cluster已stop，临时63334 QA服务已核验停止。

## 后续

下一项正式报告页面和生成／发布／导出命令入口，继而登记报告调度、真实机器身份及常驻进程。I11可配置正式面板、I08对象分布／分层规模汇总仍待。真实来源／平台注册／Beta环境、11万站3倍突发、安全恢复、UAT和生产批准未到位；未push／PR／远端CI／外部部署或正式上线。费用仅预留、退服P2、陕西演示边界不变。
