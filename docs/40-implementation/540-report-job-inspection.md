# 正式报告任务监控与精确结果跳转

设计见[218](../30-design/design_bsmoss_218_report-job-inspection.md)。接续f305382聚合受审恢复包，I09／I12保持in_progress，本包不冒充报告队列恢复或上线。

新增ReportJobStore规则／PgReportJobStore／独立reports.jobs.view门面、真实RP组合根和两个只读API。复用原生成job／scan／schedule与导出job、持久报告校验；原worker仍按固定主体和当前登记执行。SQL先按完整原scope过滤、再六位微秒键集分页，游标绑定队列和状态，lookahead亦末次再验权；原／当前身份、租户、有效期、权益、权限和实际必要范围都不可绕过。

详情最多5次连续attempt，报告成功精确result及执行时currentRevision分别保留；导出结果不捏造当时报告head，currentRevision=null。登记换版旧pending仍可审阅但不称可派发。只读监控不报告不存在的持久“执行中”，不读取或交付HTML，也不宣称报告可下载。

新增/operations/reports的双队列列表、状态筛选、宽详情、时间线、原登记及摘要引用；跨工作区导航在窄屏可用。结果直接跳转明确报告修订，/reports严格解析显式链接并保留登录returnTo；无参数仍无默认报告，非法／重复参数显示无效链接并要求重新选择。

本包最终487单测／284实际PG（283子项＋父项，新增7）与双层类型验证，覆盖两队列微秒分页／完整scope、查看者与worker身份分离、隐藏设备／站级参数、失败历史／原结果和执行时最新修订、并发换版快照、末次撤权／无关范围收缩及损坏／SQL故障。初轮新增导出夹具错误假设已有单上行字节导出，实际没有，改用数据库既有合法服务级导出的真实历史scope作为独立基准，未放宽产品条件；随后284全过，补隐藏设备和旧结果断言再最终回归，结果见检查点。

真实React合成QA验证无默认任务、双队列切换、准确9007199254740993报告链接、执行时9007199254740994单独显示、换版提示和5次存储失败；桌面1440／390窄屏无横向溢出、移动导航可用，浏览器无warn／error。证据artifacts/report-job-monitor-qa，未改正式路由身份或用户主地图。合成记录不是业务签认。

生产构建／20HTTP、109篇编号／56表镜像、交付／SCA／ASCII／密钥、提交SHA和63333运行版本见report-job-inspection检查点，日志tmp/report-job-monitor-{unit,db,types,build,http,guards,ascii,staged-scan,browser}.log。DDL仅权限和历史索引，Prisma56表标量镜像不变、沿用已验证CLI，无迁移。只使用专用PG随机合同库和独立63334合成服务，收尾停止。

原五项1–3本地完成、4–5继续active。报告队列受审恢复、历史报告传播、真实机器provider／进程托管、I11配置与I08分布规模继续待办；真实来源、平台注册、Beta环境、容量、安全恢复、UAT和生产批准未完成。无push／PR／远端CI／真实接入／外部部署或上线。
