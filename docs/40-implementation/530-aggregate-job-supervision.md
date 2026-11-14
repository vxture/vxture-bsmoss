# 聚合任务工作台与受审恢复

设计见[217](../30-design/design_bsmoss_217_aggregate-job-supervision.md)。本包完成I09聚合队列的持久可见性与终态恢复，I09／I12总体保持in_progress。

新增supervision规则、授权门面、PgAggregateJobStore及实际RP组合根。显式jobs.view／jobs.recover只入权限种子、不分配角色。列表SQL先按完整对象授权过滤，再六位微秒键集分页；详情验证最多8次连续记录，不公开租约token。新任务／恢复审计／末次身份和范围复查同事务；保留dead原历史，另建相同目标任务，每原任务仅一条恢复。

首次恢复按当前真实policy验证实际依赖与物理站参数开关；精确旧命令重放核验原审计依赖，policy后来失效不改变历史命令含义。新增refresh_recovery及不可变来源捕获、旧终态尝试精确FK，空库共56表；Prisma标量镜像已验证，无旧库迁移。

新增三个正式API和/operations/aggregation页面。未配置RP时明确未开放，匿名API401。宽详情、筛选、历史链和复核依据；网络结果未知保留同命令，明确拒绝后重新核验。合成QA首次实际记录恢复后返回503，UI第二次发送完全相同命令并取得duplicate，只有一个replacement；桌面1440、窄屏390实际clientWidth375均无横溢，浏览器无warn／error。截图及合成记录在artifacts/job-workspace-qa；未向正式路由加入测试身份。

最终483单测／277实际PG（276子项＋父项，新增9）／双层类型通过。PG覆盖分页微秒与可见性、数据库readiness、三类语义、未知不补零、直接和派生依赖、物理电耗、提交末次撤权、CAS／并发恢复唯一性、重复命令、当前policy失效后历史重放、审计篡改及SQL异常。构建／20HTTP／Prisma／107篇编号文档／56表镜像、交付／SCA／ASCII／密钥与最终SHA见aggregate-job-supervision检查点；日志tmp/job-recovery-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,browser}.log。

只使用随机合同库和独立合成UI接口。报告生成／导出队列监控恢复、历史报告传播、机器provider和生产托管仍待实施；真实来源／平台／Beta／容量／安全恢复／UAT及生产批准仍待真实验收。本地实现和演示可用不等于已外部部署或上线。
