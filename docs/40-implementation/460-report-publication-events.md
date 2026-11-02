# I12 周期报告发布与撤回

2026-11-03。[设计210](../30-design/design_bsmoss_210_report-publication-events.md)。接续f27d9a1持久快照，本批补齐内部发布状态链；I12保持in_progress。

## 实施结果

新增publication纯规则、ReportPublicationStore、PgReportPublicationStore及独立授权服务。发布命令绑定明确reportRevision与manifestSha256、expectedEventRevision、commandId、action及reasonRef；请求不能指定租户／actor／scope。reports.publish显式本地权限加入种子，不赋给任何role，owner的view／ingest基线不自动扩大到发布或撤回。

抽取现有报告事务内持久读取和新鲜度读取器，普通回看沿用同一逻辑。发布事务先锁报告series，在一个REPEATABLE READ快照内核验最新生成修订、完整数据和当前输入／来源／质量／完成／模板／区域配置，再追加事件和outbox。缺数、未接入、旧生成修订、撤销完成证明或旧发布依赖不能通过。发布是报告版本选择，不创建来源完成证明，不审批费用。

撤回必须精确匹配当前活跃发布的原修订与摘要；即使新数据已令原报告过期或生成了新版本，仍可按原完整范围撤回。重复新命令发布同一活跃修订拒绝，撤回后可重新检查并发布相同生成修订。生成新版本不自动替换发布。成功重放重新验身份／权益／显式权限与原报告全部必要范围；命令载荷或actor改变拒绝，旧命令重放不回退当前事件。命令回执也返回currentEventRevision及isActive，避免把历史published动作误当作当前活跃状态。

空库baseline新增report_publication_event／report_publication_outbox，共47表；Prisma只镜像标量，无旧库迁移。事件连续版本链、同租户报告修订及SHA外键、撤回目标、不可变事件和outbox动作精确FK由DDL约束。触发器固定schema与pg_catalog搜索路径，PUBLIC无执行，数据库时钟写事件时间；运行角色不能改删历史。SQL不替代应用层来源业务校验或逐用户授权。事件、outbox及末次再验权同事务，失败全回滚。

生产组合根接实际RP／平台权益／本地grant。公开新增GET /api/reports/{id}/publication，可选eventRevision；当前事件指针、所选历史事件、isActive、原报告及其当前新鲜度独立返回。读后再验完整历史scope，no-store／nosniff／Vary Cookie。匿名或演示不能取得正式结果，不回退样例。命令仍内部调用，未开放HTTP变更入口。

## 验证

453项单测（新增5）和220项实际PostgreSQL报告测试（219子项＋父项，新增11）全过。加强旧命令回执和outbox动作FK断言后再次全PG，仍220全过。双层类型／生产构建／Prisma validate／20HTTP及93篇文档／47表镜像／交付／SCA配置守卫通过；16个源码／SQL／测试／根文件ASCII通过。覆盖完整与新鲜度独立门槛、权限／owner、精确SHA／版本、幂等与主体绑定、撤回／重发、历史指针、旧命令不复活、数据修订后过期仍可撤回、并发只能保留一条连续事件和outbox、旧RR不能采用新head、同RR发布及随后修订可见、完整历史范围／跨租户、读后撤权和数据库故障不吞错。

包含写后权限／scope／主体／权益／有效期变化、回执故障全回滚、重放仍验权，SQL链／追加／外键／触发器及运行权限检查。专用本地PostgreSQL只使用随机合同库，不修改业务库，cluster已stop。日志tmp/report-publication-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log；最终扫描／Git与预览SHA见report-publication-events检查点。未改变地图布局，无需重复稳定六场景UI验收。

## 后续出口

下一项异步HTML导出及下载时重新核验当前发布、完整范围和权限；随后正式报告页面、生成／发布命令与登记调度。尚无外部outbox投递、真实机器身份或常驻worker；本地发布事件不代表对外报告已送达。I11正式面板、I08对象分布／分层规模汇总、I09机器身份与常驻调度，以及真实来源／平台注册／Beta环境／11万站3倍突发／安全恢复／UAT和生产批准继续待办。未push／PR／远端CI／外部部署或正式上线。

## 发布替换范围补充（2026-11-03）

正式页面c840089收尾后继续核验授权，实际PG回归复现：原发布含流量和接通率，审阅模板缩减到仅流量并生成新修订后，仅有流量scope的发布者可以凭已知CAS替换旧较宽发布。旧实现只核验新报告，漏掉被撤下原快照。新增commandScope在同一锁／RR事务读取被替换报告，校验摘要与完整原scope并合并新scope；追加前和末次再验权均覆盖两者。

重复命令沿原event.previousEventRevision恢复原作用范围，不读今天的无关head；故写后失去旧范围和事后重放均拒绝，且事件／outbox不增加。已明确撤回后，用新命令发布较窄报告不再隐含撤下旧宽范围；后来的宽发布也不会阻断只涉及旧窄范围的命令重放。原始报告和事件保持不变，没有DDL／API／UI变动。

新增1实际PG场景覆盖前置范围拒绝、写后范围撤回全回滚、完整权限替换成功、原作用范围重放、撤回后新命令、无关后续head及旧回执不复活。首次新夹具按对象引用选择单位而误用count，已显式设置接通率%；随后修复前回归得到预期的Missing expected rejection，确认漏洞。修复后239PG全过，扩展无关head断言后最终结果以日志为准。465单测及类型／生产构建／20HTTP、守卫／扫描／运行SHA见publication-replacement-scope检查点；本包不重复未变化地图／报告页面视觉验收或Prisma CLI／联网扫描。专用PG仍仅随机合同库，收尾停cluster。未真实接入、外部部署或上线。
