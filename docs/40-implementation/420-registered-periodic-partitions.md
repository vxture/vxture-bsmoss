# I09 登记周期分区与扫描回执

2026-11-03。[设计206](../30-design/design_bsmoss_206_registered-periodic-partitions.md)。内部登记扫描切片完成，没有生产登记或常驻进程。

## 实施

refresh_partition_revision追加受审配置，严格修订链、完整JSONB配置SHA和审阅依据；固定触发器原子推进refresh_partition_head。运行角色只读两表，禁止改配置；固定SECURITY DEFINER函数仅提供共享行锁，避免为SELECT FOR SHARE授予head的UPDATE权限。搜索路径固定、表全限定、PUBLIC无执行，唯一开放函数不能写配置。

registered-partitions纯规则规范scope／策略／种子，最多12种子，按实际主体绑定并检查当前grant完整子集。派生总量预验依赖；比率是否使用次数依赖由可信快照按核验模式决定，直接比率不强加次数范围。pg-registered-periodic只接受分区id，服务器时间规划闭合日／周／月，不接受调用者scope或种子。

同RR事务锁head、核验配置、解析可信快照、全批入队和写refresh_scan_receipt。回执绑定配置修订／原始摘要／规范摘要、扫描小时和完整任务清单；同小时重放返回原回执，并重新验权。中途撤权或回执故障全回滚；并发同批返回busy或可重试冲突，不重复提交。配置新修订等待扫描提交后生效；取锁前已更新head使旧快照回滚。

新增三表，共41表空库／Prisma同步，无旧库迁移。没有事实的有效设备种子仍能产生missing结果；暂停配置不自动取消旧任务或等同于撤权，执行仍按当前实际grant核验。

## 验证

425单测（新增3）、167项实际PostgreSQL报告测试（166子项＋父项，新增7）通过。覆盖配置不可变和修订链／运行权限、租户FK、无事实设备种子与missing、同小时回执重放／新小时／配置修订、暂停／主体／完整scope拒绝、排队／回执及最终撤权回滚、同分区并发fence、配置共享锁和取锁前RR竞态。

首轮PG发现FOR SHARE需要更新权限，修复为固定只读锁函数，未扩大runtime DML权限；第二轮全部通过。双层类型、构建、Prisma、20HTTP、85篇编号文档／41表镜像／交付／SCA配置守卫及ASCII／密钥扫描以最终收尾日志为准。日志tmp/registered-periodic-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log；检查点artifacts/formal-checkpoints/registered-periodic-partitions.json绑定SHA／树／BUILD_ID与日志。专用PG只随机合同库，无业务库操作，收尾停止。无依赖或地图UI变化，不重复六场景浏览器验收。

## 下一出口

登记配置与输入变化消费尚需同事务接线，不能把独立两事务包装称为完整登记消费；全省站群自动分区、真实机器身份／常驻scheduler及worker仍待。显式种子不代表11万站已登记或容量已验收。I08跨对象权威去重、I11正式面板、I12持久报告／异步导出及真实来源／平台注册／Beta／安全恢复／业务UAT／生产批准继续待办。未push／PR／远端CI／外部部署／上线。
