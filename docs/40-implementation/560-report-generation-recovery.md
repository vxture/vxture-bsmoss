# 报告生成任务受审恢复

设计见[220](../30-design/design_bsmoss_220_report-generation-recovery.md)。接续cff5450导出恢复，本包完成生成任务恢复及两类任务统一授权门面；I09／I12总体继续in_progress。

独立reports.jobs.recover仍只入权限种子，不自动分配角色。POST /api/report-jobs/{id}/recover显式区分generation／export；服务、HTTP解析和React表单共用一般恢复契约，删除旧的仅导出内部接口。查看、生成、执行、owner均不隐含恢复授权。

首次恢复在RR事务锁原dead任务和精确连续attempt，完整原登记scope先SQL过滤；共享锁当前登记，必须active、原revision一致、原模板摘要仍有效。另建pending0任务，requested_by保持原登记subject，复核者另入审计；不换登记、不重置原失败、不自动发布。新任务／不可变审计／提交前真实身份、权益、独立权限、有效期和实际scope核验同事务提交。每原job一次恢复，新job终止后可继续形成链；精确command重放按原actor／reason／attempt和历史scope验权，今天登记暂停或换版不改变旧回执，实际执行仍独立拒绝。

空库基线第58表report_generation_recovery，Prisma只做标量镜像，无迁移。generation job新增recovery_of／scan_job_id；普通扫描任务两者为空，原窗口唯一性仅约束普通扫描。恢复任务同租户parent／root自引用，反向延迟FK保证关联已提交审计。invoker固定search_path触发器独立核验旧新任务、原root、原登记／scope／周期／due／worker／精确终态与manifest，捕获DB SHA、session_user及数据库时间，禁止改删清空。

generation-recovery读回完整JOIN旧新任务、root、精确attempt及原登记，核验双SHA和实际列值；不在缺关联列时跳过验证。worker与监控共用provenance校验：原扫描清单必须包含root及精确窗口，恢复记录完整有效；恢复任务仍通过当前登记固定worker及真实generate授权。原扫描清单保持不变，不能仅伪造恢复标记绕过扫描来源。

正式工作台两类任务均支持复核依据和父子恢复链。503／网络结果不确定时保留原命令并锁表单，明确4xx拒绝后清详情要求刷新。无默认选择和正式身份后门，地图展示不变。

最终491单测／302实际PG（301子项＋父项，新增10场景）／双层类型／Prisma／生产构建／20HTTP通过。PG覆盖五次真实失败保留及新任务真正执行、不自动发布、暂停换版后的历史重放、pending／success／CAS／模板漂移拒绝、独立权限／完整scope／固定worker、物理参数开关、各阶段撤权和SQL故障原子回滚、链式root／普通扫描唯一性、孤立与跨租户FK、登记RR fence和同异命令并发、SHA／scope／root／terminal损坏，以及数据库独立防伪和不可变审计。首轮SQL的JSONB包含表达式补明确括号修正运算符优先级；TRUNCATE夹具加CASCADE后实际触发append-only拒绝，产品运行角色仍42501。最终302全过，无产品权限放宽。

独立63334实际React合成QA验证首次已提交但返回503，第二次原kind=generation命令完全一致，仅一个replacement；旧五次失败保留、原登记subject保持、父子双向回溯、409清详情提示刷新。1440与390×844实际client1425／375无横向溢出，无warn／error；证据artifacts/generation-recovery-qa，临时viewport已reset、tab11已close。合成夹具不代表真实平台／来源或客户UAT。

113篇编号／58表／交付／SCA与ASCII／staged密钥扫描、最终SHA及本地63333运行版本见report-generation-recovery检查点。日志tmp/generation-recovery-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,browser}.log；专用PG只运行随机合同库，验收后停止，合成服务收尾停止。

五项1–3本地完成、4–5继续active；历史报告变化传播、I11正式配置、I08分布与规模继续。真实来源协议样例与口径签认、C1/C2/C3注册联调、机器provider及生产宿主契约、Beta／11万站3倍突发／安全恢复／UAT和生产批准仍缺，无push／PR／远端CI／真实接入／外部部署或上线。费用仅预留、退服P2、陕西演示不变。
