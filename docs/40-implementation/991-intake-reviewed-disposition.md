# P1接收任务受审终止与授权查看接口

2026-11-06，设计248，接续7fdaea8。实施编号991沿用现有三位编号规范，不改文档守卫。

## 实现

sourceIntakeTasks增加受审terminate与授权list；浏览器安全intake-contracts只包含传输类型。正式sourceIntakeTaskSupervision/session组合仅暴露list/read/terminate，无connector或执行方法。新增三个RP路由：列表、精确详情和精确任务终止；不提供POST创建、run或recover入口。

终止追加terminated事件，保留原租约/尝试/完整历史，无原量或游标变更。有效租约/过期/第五次失败/配置暂停或变更都可由原完整范围的job_recover用户处置；身份、精确版本、命令与依据、事务末次权限重验。与接收成功/复核恢复共用任务锁，旧网络返回不能越过fence提交；终止不保证远端网络请求立即停止。已成功事实不能终止或回滚，新配置原位置仍需独立受审重新基准。

list/read同一PG快照、完整原scope先SQL过滤后分页，微秒/C排序keyset，lookahead并集和空页最终验权。独立来源接收kind与配置变更/暂停提示，为后续工作台/消息对接准备，不混已有重算列表游标。无缓存/匿名回退。HTTP固定RP、origin/JSON/4096字节/精确字段/路径与query边界及private/no-store脱敏响应。

空库DDL追加终止转移约束及列表索引，不增表或标量字段，Prisma仍67表。只在独立本机随机合同库应用，不迁移或改已有业务库。无UI改动，不做重复浏览器验收。

## 验证

针对命令/HTTP/query规则及全量单测、实际PG、类型、构建及守卫结果以本批最终日志和artifacts/formal-checkpoints/intake-disposition.json为准。首轮PG的配置位置用例复用了另一SQL伪造测试故意留下的未完成任务，被intake_task_active正确拒绝；已改为独立binding重新验证，该失败轮不计通过。日志保留tmp/intake-disposition-db.log，末次见tmp/intake-disposition-db-final.log。

实际PG覆盖终止后的新命令、原命令只读重放、同命令异依据/主体冲突、有效/过期执行、第五次失败、成功优先、来源配置新范围不可见但旧任务可处置、旧游标不变、撤权/身份切换回滚、COMMIT成功丢应答重开、恢复竞争及DB非法状态/回执拒绝。列表覆盖完整scope过滤、微秒分页、隐藏新任务不占LIMIT、同快照状态、最终失权/空页与租户隔离。所有故障注入仅随机合同库owner，runtime不获UPDATE或扩权。

最终693全量单测、6针对规则/HTTP回归、426实际PG（新增14项）、54实际HTTP、双层types/production build通过；Prisma validate、67表静态与实际PG镜像、188篇文档编号、交付及SCA一致性守卫、ASCII/diff检查通过。末次收紧任务ID为真实字符串后6项规则及最终types/build/54HTTP再验通过；合法任务路径的PG结果不受影响。日志tmp/intake-disposition-{unit,rules-final,db-final,types-final,build-final,http-final}.log。HTTP首轮过严要求Vary只含Cookie，但Next追加框架字段，修正为包含Cookie后末次54零失败，首轮保留http.log且不计通过。无UI变更，未做或声称浏览器视觉验收。专用合同库清单为空、PG测试进程exit0后服务器已停止。

## 接续

P1/B03-04/B03仍in_progress。本批完成接收任务处置和正式HTTP查询基础；下一复用DS接入数据更新工作台与Header分阶段消息，再受审重新基准及业务按需接收路径，P2共同可用版本/报告依赖和B04继续。真实来源/平台/环境及Beta容量恢复/UAT/生产批准仍待；机器ingest未扩、来源完成未自签、quality未提升、页面数据截至和旧报告未改变。未push/外部部署/上线，无新聊天或自动任务。
