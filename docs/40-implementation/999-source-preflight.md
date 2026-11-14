# 来源配置变更预检

2026-11-06，设计256，接续对象映射有效期预检998。

## 交付

当前/settings/sources详情加入“变更预检”，可拟调整登记状态、适配／转换版本、UTC整点覆盖起点及站址／服务／设备／指标范围、物理参数标志。配置ID／来源身份／租户由服务端当前定义固定，不接收用户替换；历史审计详情不提供预检。复用官方DS Input／NativeSelect／Textarea／Button／StatusBadge，原全局标题／留白／Header规范保持。范围在折叠区按每行一标识输入，结果展示前后配置及新增／移除清单、资源问题、草案摘要和准确待复核项。

expected固定原revision与binding SHA，拟revision为numeric(30)字符串加1；严格字段白名单／真实canonical UTC整点／重复清单拒绝／非空站址指标／规范排序，实质无变化拒绝。旧基线409；用户依据引用及原件SHA-256仅声明未验真，不填假审批主体，不访问外部URL。草案不保存、不审批、不写库或推进截至。

来源完整新修订改变binding摘要，包括仅改登记状态。预检明确旧接收位置不可直接沿用，需受审重新基准；不假设已有回执或任务，其existingReceipts／existingTasks均未评估。拟暂停不宣称远端停止，拟启用不代表连接正常或可恢复接收。适配兼容未验证、来源指标能力／聚合／报告影响未评估，不把目录登记等同来源支持、不把未知计0。

## 权限和读取

独立admin.sources.preflight，来源查看／审计／映射预检／ingest及owner无绕过，机器拒绝。复用sourceScopeWhere在SQL内完整过滤原head范围；拟范围五维和物理参数在任何资源查询前完全验权。来源身份固定，所有资源查询按workspace及已提交ID；服务／设备额外限定拟站址，不泄露错误关联的实际父站址，仅指出用户提交ID未满足条件。指标code@version精确查全局已登记目录，不改目录或激活来源能力。

只读可重复读事务中核对当前配置摘要、旧基线、新范围和资源关联。资源引用问题显示“发现阻断项”，全部已登记仍为“仍需复核”。末次重验主体／工作空间／权限／完整scope／有效期，成功、missing、stale、SQL错误均复核，撤权优先屏蔽错误和存在性。无配置／位置／输入／任务写入。

POST /api/management/source-configurations/[id]/preflight，真实RP门槛、严格同源、JSON、无query、64KiB流式字节上限，客户端同限明确提示；共享HTTP边界保留映射原8192字节限制，来源400／409／404／403／503独立稳定语义。同步200、不造后台任务，GET／PUT／DELETE405，no-store／Cookie Vary／nosniff。修改任一输入取消请求并清旧结果、收起清结果、关闭详情销毁草案、401／403清列表和Drawer，禁用自动填充，不写localStorage／URL。

空库baseline仅增加1permission种子，无角色赋权，67表／Prisma不变；DDL仅应用随机专用本机合同库，未改业务库，无旧库迁移和新依赖。

## 验证

742项全量单测通过tmp/source-preflight-tests.log；新增9项覆盖注入与严格输入、canonical起点、大revision／旧基线、完整原新范围、精确差分、状态变化仍需重新基准、独立权限／机器拒绝、末次验权／错误路径和HTTP64KiB边界。针对17项（含映射原预检）通过；双层types最终通过tmp/source-preflight-types-final.log。首轮提取共享SQL后旧select标识残留被types捕获，已修复并重跑。

460项实际PostgreSQL合同通过tmp/source-preflight-pg-final.log，新增7项：独立permission种子无赋权；真实资源引用／差分及无配置／回执／任务／输入写入；未知资源／目录／错误父关联不泄露真实站址；完整原新scope在任何资源lookup前校验；并发head变更时定义与资源同只读快照，后续旧基线409；SQL失败回滚释放、损坏摘要拒绝；真实权限撤销后成功／missing／stale均拒绝。首轮资源问题列表按规范化ID排序，测试预期仍按输入顺序而失败，已修断言全量重跑，不把首轮算通过。专用本机cluster正确58875启动，收尾停止，不删除目录。

60项HTTP通过tmp/source-preflight-http.log，含新增正式预检门槛及POST-only；最终可访问标签修复后的build与HTTP复测以tmp/source-preflight-build-final.log和tmp/source-preflight-http-final.log为准。原来源只读、审计和映射接口保持。

独立无头Chrome＋实际SourceWorkspace＋应用DS Providers，1280／904／390三宽无文档和Drawer横溢；状态前后对比、站址新增／移除、资源阻断、修改输入清结果、400错误日期、64KiB本地限制、409／503、迟到隔离、收起清结果、403清整页／Drawer、关闭销毁草案，以及审计无预检入口均通过。首轮下拉名称包含选项、后续Textarea名称混入初值导致精确可访问定位失败，已补明确aria-label并全部重跑，非放宽断言。截图已复核，证据artifacts/source-preflight-qa/checks.json及result截图。正式门槛三页三宽另验收，最终SHA和健康见formal-checkpoints/source-preflight.json。独立合成组件不注入正式63333，不当正式身份／真实来源验收，未操作用户标签页。

文档编号／schema-mirror／SCA／交付守卫、ASCII／diff／staged gitleaks通过记录见收尾日志。无push／外部部署／上线、新聊天或自动任务；本机预览保留。

## 接续

下一批核对实际授权聚合／报告依赖及接收任务重新基准影响；再可信业务提交／批准契约下受审写入、原件验证及真实连接核验。当前只读预检不是完整配置治理，不可用草案摘要替代批准或未来写事务的完整并发校验。责任组织主档／授权写入、规则发布、其他配置审计，原P1工作台／分阶段消息／受审重新基准／按需接收、P2共同可用版本及真实来源／平台注册环境／Beta容量恢复／UAT／生产批准依赖保持。
