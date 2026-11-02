# 聚合失败回执权限修复

设计见[216](../30-design/design_bsmoss_216_aggregate-failure-authorization.md)，接续f2d03b6。关闭215所列失败回执自身事务末次授权缺口，I09／I12仍in_progress。

recordFailure向PgRefreshJobs.fail传入可信提交复查，低层failed动作在attempt和job更新后、COMMIT前调用。refresh-access抽出原身份／有效期和稳定对象范围公用核验；成功仍核验实际依赖，失败只核验任务生命周期的真实对象和目标指标，不要求已不可用capability。

实际PG先复现旧worker在写后撤权时仍返回无失败分类的failure_recorded，日志tmp/aggregate-failure-regression.log。新增两场景覆盖四种值语义身份／权益／有效期／目标范围撤销、SQL故障和最终dead边界；attempt与状态全回滚，先前claim仍leased及原token，合法同lease可恢复。另验证缺capability、无关scope收缩仍可记录真实终态，不制造依赖／零值。

最终476单测／268实际PG（267子项＋父项，新增2）／双层类型／生产构建／20HTTP通过，105篇编号文档／55表镜像／交付／SCA守卫及4文件ASCII通过。扫描、提交SHA和预览检查点见artifacts/formal-checkpoints/aggregate-failure-authorization.json，日志tmp/aggregate-failure-{unit,db,types,build,http,guards,ascii,staged-scan}.log。无DDL／Prisma／依赖／UI变化，不重复稳定地图验收，只使用随机合同库。

后续真实机器provider／进程托管、持久任务监控与受审恢复、历史报告变化传播、I11配置面板及I08分布／分层规模。真实接入／平台／Beta／容量／安全恢复／UAT／生产批准仍未完成；五项1–3本地完成、4–5继续，未外部部署或上线。
