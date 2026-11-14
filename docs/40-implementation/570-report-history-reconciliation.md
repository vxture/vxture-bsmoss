# 历史报告周期核验与修订

设计见[221](../30-design/design_bsmoss_221_report-history-reconciliation.md)，接续01ea8ac。完成登记报告在近期日历回看范围之外的已有历史周期核验／修订；不是实时变化投递，也不自动枚举从未生成的无限历史。I09／I12总体继续in_progress。

新增reports/history和pg-history。reconcileRegisteredReport只接受受审登记选择器，复用registeredTransaction：当前登记共享锁、active／固定subject／完整scope／原模板SHA／真实generate权限，以及提交前身份、权益、权限、有效期和全部登记scope复查。选择器仅登记模板版本、粒度、notBefore之后且已到期的已有报告，完整历史scope先SQL过滤再LIMIT，每步一份。

不可变回执按登记修订＋小时＋reportId排除本小时已核验项；从未核验优先，再按最久未核验、周期和ID排序。新增last-check索引，跨小时积压不会每次重扫最早周期而饿死后续，晚提交的更早报告也不被全局游标遗漏。进程重启续查持久回执，同小时完成之后的变化最早下小时可再查；不承诺一小时扫完全部积压。

读取完整原current快照与最新单对象／区域／逐日依赖。current记录unchanged；stale调用已有生成核心，记录inserted或duplicate，精确原修订、结果修订和当时currentRevision分开保存。重复结果可以仍然stale；核验并不等于数据完整或允许发布。旧报告、所有失败证据、原发布及导出绑定保持不变，不自动发布或授予下载。

已知映射／区域绑定缺失、暂停或受审覆盖／比率依据不再可用时记录blocked并保留原报告，其他报告可继续；不补零、不编造来源。权限／范围、SQL／摘要损坏、序列化／死锁和未知异常全部回滚。SAVEPOINT仅隔离工作；报告修订／head／generated outbox／核验回执／末次授权仍同RR原子提交，回执故障不会遗留孤立新报告。

空库第59表report_history_check，Prisma标量镜像，无旧库迁移。原修订／结果修订／SHA和当时head均精确同租户FK。invoker固定search_path触发器核对当前登记主体、报告模板／窗口／head、旧新scope并集、结果类型，捕获DB SHA／session_user／时间，禁止改删清空。应用读回精确历史登记和旧新持久报告，重建manifest并验证双SHA／实际列值；日后head前进不改原回执。

ReportWorkerConfig显式reconcileHistory=true才增加每登记独立历史通道，此时最多32登记＋可选导出，合计最多65通道；未启用时保留原64登记上限。轮转、独立退避、固定机器租户主体、停机和重启沿已有循环，不创建机器身份、不接Next启动生命周期。

本包最终498单测／316实际PG（315子项＋父项，新增14场景）／双层类型／Prisma／生产构建／20HTTP通过。实际PG包含数月外日报修订、原值不变、周月逐日单独变化、同小时去重／下一小时重查、晚提交更早周期、跨小时最久未核验公平性、未接入／缺数／过期重复结果、已知缺失blocked不阻塞后续、完整scope／owner／独立物理参数、写后各类撤权和回执／SQL回滚、并发竞争／旧RR、登记pause共享锁、真实宿主中断恢复、旧指纹不回退head、不可变数据库actor及SHA／scope／result／登记／时间篡改拒绝。没有UI变化，不重复稳定地图视觉验收。

首轮夹具将可信时钟推进到模拟未来而沿用即时到期身份，被正确拒绝；改为明确模拟有效期，不改生产授权。另一次误删已有测量FK引用映射被数据库拦截，改用无测量引用的专用映射并在测试后清理，保持来源历史约束。缺数报告已捕获stale不能断言unchanged，改为断言duplicate及原过期证据；未放宽产品数据或权限。最后补公平性排序后重新运行全PG与构建，最终计数如上。

115篇编号／59表／交付／SCA／ASCII／staged密钥扫描及运行SHA见report-history-reconciliation检查点；日志tmp/report-history-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,preflight}.log。专用PG仅随机合同库，收尾停止。本机与GitHub只读预检仍为prerequisites_missing，不把环境名称读取当作实际联调。

下一项I11正式配置面板与I08对象分布／分层规模；真实机器provider及进程托管仍需平台权威契约。真实来源协议／脱敏样例／口径签认、C1/C2/C3平台注册、私有环境配置、Beta和11万站3倍突发／恢复／UAT／生产批准仍未完成，无push／PR／远端CI／真实接入／外部部署或上线。五项1–3本地完成、4–5active；费用仅预留、退服P2、陕西演示不变。
