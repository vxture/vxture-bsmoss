# I12 正式周期报告持久快照

2026-11-03。[设计209](../30-design/design_bsmoss_209_persistent-report-snapshots.md)。I12转in_progress；本批交付生成与授权回看，不把generated称对外发布或已完成异步导出。

## 实施

新增domains/reports规则／store契约／PgReportStore，复用现有report类型模板、单对象区间／状态／温度聚合及受审区域汇总。模板严格schema、日／周／月、最多16面板、合法单位／视图／三类指标和逐面板binding；不接受请求值／scope／actor。显隐不改报告总体，hidden面板仍留原值和缺数，个人偏好不进入发布模板。三类章节保存included或not_configured，明确未接入与实际缺数分开。

周／月同时保存周期结果和每个自然日发布依赖，日结果未发布／不完整不能称完整，单独日修订也使报告stale；不把状态时长或温度错误地相加。所有周期、逐日和区域数据共用同一REPEATABLE READ事务；pg-object-rollup抽取不自建事务的核心，继续复用单对象事务内读取。区域响应增加requiredMetricKeys以保留实际依赖权限；直接比率不引入未使用的次数权限。

空库report_series／report_revision／report_outbox共45表，Prisma标量同步，无旧库迁移。按租户＋模板版本＋自然周期唯一series；追加完整模板／数据／发布修订／原始证据／有限必要scope和规范SHA。结果版本字符串保留超安全整数，不现场发布聚合。CAS与RR防旧输入覆盖新head，指纹重放返回旧版本但不回退head；revision、head和report.generated outbox原子，失败或末次撤权全回滚。只有series.current_revision可由运行角色更新，修订和outbox不可改删。没有report.published事件或发布审批冒充。

reports.generate为现有metering能力下新的本地权限，仅入空库种子不自动授予，owner无生成基线；回看用metering.view。生产组合根提供内部reportsForSession，不新增可公开写入的命令路由。GET /api/reports/{id}?revision=明确修订 读取持久报告；RP cookie／权益／完整历史scope和返回前再验权，no-store／nosniff／Vary Cookie。撤回不相关父grant范围不遮掉仍完整授权的报告；历史报告新模板或区域配置改变不能扩权。

回看另给currentRevision／freshness／reasons，原快照不变。当前事实／质量／完成证明／权威generation或发布变化、模板原文改变、区域配置换版或暂停都可识别；先比较区域配置修订再读成员，避免访问新配置的越界对象。来源权威不可用保留明确状态，不声称没有发布。生成时若稳定映射仍存在，先核对真实站／服务／设备归属和完整scope，再记录authority_unavailable；映射已删除则等待审阅修复，不猜历史归属。周／月主周期不可用时仍逐日实际读取，不把整月各日全虚构成同一种缺数。SQL故障不能吞成missing或伪current。

## 验证

448单测（新增11）、209项实际PG报告测试（208子项＋父项，新增16）全通过。覆盖生成／持久回看／精确大整数、三类与区域单事务、真实完成证明和撤销、隐去未接入面板仍影响完整性、生成权限与owner、完整历史scope及末次撤权、报告修订／CAS／旧重放不回退、outbox和写后身份／权限／范围丢失全回滚、并发首建与旧RR竞态、并发事实发布不混旧新数据、模板／能力／区域配置变化、日依赖单独变化、周期能力边界逐日实读、租户FK／typed generated／权限锁和SQL故障。

首轮206PG通过，补真实完成证明／撤销和并发一致性后208全通过。增加来源不可用生成与周期边界用例后，发现主周期authority_unavailable被某日stale覆盖，修复为保留主不可用状态且capturedFreshness仍标明逐日旧结果；最终全回归见tmp/report-snapshot-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log及artifacts/formal-checkpoints/persistent-report-snapshots.json。最终构建／类型／Prisma／20HTTP、编号／45表镜像／交付／SCA配置守卫、ASCII／密钥／Git与运行SHA以收尾工具为准。

仅专用PG随机合同库，无业务库操作，收尾停止。无依赖和演示布局变化，不重复稳定六场景UI。预览仍是本地，不能叫部署或上线。

## 后续

生成命令的正式入口／后台登记调度、发布与撤回事件、异步HTML导出和正式报告页面仍待；本批有generated outbox，但没有外部消费者投递。周／月逐日链路目前为有限范围真实查询，尚无11万站容量证据。I11正式面板、I08对象分布／分层规模汇总、I09机器身份／常驻scheduler继续推进。

五项1–3本地完成，4仍缺真实来源和平台注册资料，5内部出口持续进展；Beta环境、11万容量3倍突发、安全恢复、业务UAT与生产批准未取得。未push／PR／远端CI／真实接入／外部部署／上线，费用预留／退服P2／陕西演示不变；既有active目标和bs-moss heartbeat复用。
