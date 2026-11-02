# I09 权威变更影响与消费

2026-11-03。[设计205](../30-design/design_bsmoss_205_authority-impact-dispatch.md)。内部传播切片完成，生产调度出口继续待办。

## 实施

authority-impact纯规则、pg-authority-impact持久解析器接入既有input-refresh；能力／映射／服务变更同事务捕获变化，按前后有效期、历史稳定对象、既有事实及发布周期规划。当前权威可用时全批入队，不可用时追加精确旧发布修订失效；消费、失效、任务与回执同事务，失败沿既有退避／隔离／恢复。

三语义快照加入权威generation及精确修订明细，输入manifest和结果均保存，可独立复算；恢复旧配置仍须新证明。新增aggregate_authority_invalidation，38表空库／Prisma同步；稳定身份在UPDATE和删除重建中均不可重分配。保留现有任务／事实映射FK，合法停用以有效期表达。

同步修复区间读取器：服务启停之外的事实不能混入实际适用窗口；完全停用为not_applicable，最新修订优先和粗粒度／跨界拒绝保持。所有成功输入消费在回执前再次核验当前授权和完整scope。

## 验证

422单测（比上包新增6）、160项实际PostgreSQL报告测试（159子项＋父项，比上包新增13）全部通过。覆盖配置恢复不复活complete、三语义权威明细持久化与复算、能力停用／恢复／依赖、映射和服务有效期、删除后历史失效、direct比率无假依赖、失效／任务／回执原子故障、当前完整授权、订阅隔离、晚提交、原事务捕获失败、旧RR遇新head回滚以及稳定对象身份。

日志为tmp/authority-impact-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log；最终检查点artifacts/formal-checkpoints/authority-impact-dispatch.json绑定Git SHA／树／BUILD_ID、日志摘要和本地health。双层类型、生产构建、Prisma、20HTTP、编号／38表镜像／交付／SCA配置守卫、ASCII和staged密钥扫描收尾核验。仅专用PG随机合同库，无业务库操作。无依赖／地图布局变化，不重复六场景UI验收。

## 未完成出口

单次1000映射／事实窗口和64目标是显式边界，超限隔离不截断；未实现登记分区、订阅、全省空周期种子及真实机器身份／常驻worker。I08跨对象权威去重、I11正式面板、I12持久报告／异步导出待补。真实来源、平台注册、Beta环境、11万容量及3倍突发、安全恢复、业务UAT与生产批准仍未到位。未push／PR／远端CI／真实接入／外部部署／上线。
