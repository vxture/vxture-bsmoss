# 周期任务进程交付

适用新产品空库及已受审的后台业务配置。仅实现了可执行交付路径，尚未执行目标Linux／平台／真实来源验收。Docker Compose需2.24或更高版本。

## 准备

1. 平台登记既有产品confidential client、当前工作区C2／C3和aud=bsmoss服务模式换票。不要使用aud=vxture的通道票据代替任务身份，不创建第二套服务账号。
2. 产品DBA受审建立s2s:bsmoss的local_authz授权索引及有效有限scope、所需metering.aggregate／reports.generate／reports.export.execute。生产运行角色无写本地ACL权限；不自动赋权，不给人工发布／恢复／下载权限。
3. 为该主体受审登记周期分区和报告schedule，绑定确切模板版本、范围、日历与subject；宿主只引用已存在ID，不创建或修订登记。
4. 以worker.env.example准备独立私有worker.env：只放bsmoss_svc数据库连接、既有S2S client、issuer／token地址与平台地址。启用BSMOSS_METERING_ENABLED=on，无浏览器RP／Redis／webhook或owner密码依赖。
5. 以两个JSON样例准备aggregate-worker／report-worker配置，替换nil工作区和受审ID；样例默认仅执行已有队列，不能代替周期登记。选择是否执行结果／导出和历史核验，按登记数量配置步数／轮询。healthTimeout涵盖最长周期轮次，部署初次全部lane观察须在240秒健康等待内完成。不能通过隐藏失败lane获取健康状态。

## 配置及部署

使用受保护Environment中的WORKER_ENV_FILE、AGGREGATE_WORKER_CONFIG、REPORT_WORKER_CONFIG三个secret，分别通过env-update的worker／aggregate-worker／report-worker存到固定etc路径。保存不重启、不授予权限。worker.env为0600；JSON无秘密，私有etc目录中的文件0644供非root只读挂载。JSON语义由候选镜像严格校验，保存成功不代表业务验收。

build-image生成同一bsmoss-app不可变digest，包含Next与独立worker.cjs。deploy明确workers=on。脚本读取配置并分别运行候选worker的validate，不连接平台或业务数据库、不执行DDL；已有db-init完成且数据库／Redis正在运行之后，使用--no-deps只重建Web和两个worker，等待Web readiness与worker health，成功才记录state/current-image及current-workers。若失败，保留现场，不能把旧指针当成当前进程实际状态，应检查容器。

两个worker没有HTTP端口。日志只含固定事件／失败类别／配置摘要，容器内health命令读取/tmp健康文件。全部lane首次观察后才running；失败及重试间隔保持degraded；starting、stopping、stopped、过期、配置摘要／SHA错误均不健康。真实来源未就绪时，不要通过扩大ACL或添加合成数据让正式环境变绿。

## 停机及回滚

workers=off显式对两个worker停机，最多120秒，随后仅移除这两个容器，不删卷、不重启数据库。worker在收到SIGTERM后停止新步骤、等待当前事务结束，再关闭pool；最长90秒，超时非零退出，未提交事务由PG回滚，已持久claim等待原租约恢复。不要将Windows强制kill当优雅停机验收。

rollback指定已审核digest与明确worker模式。回滚到没有worker.cjs的旧镜像必须off；否则候选validate会在替换前拒绝。代码回滚不会回滚数据库、既有证据、登记或配置；配置版本单独审阅恢复并显式重新交付。仅有readiness／健康不能替代来源对账、权限撤销、容量、备份恢复及业务UAT。
