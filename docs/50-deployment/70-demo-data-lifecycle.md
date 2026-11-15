# 演示数据独立维护

## 边界

`db-init` 工作流仅用于空数据库：业务结构、权限和约束，以及演示存储的空表。它不会装载演示数据，不能用于已上线数据库重置。现有系统字典和规则的发布方式不因本次改变；不伪造平台账号、授权或来源证据。

演示数据使用独立 `bsmoss_demo` schema，不向正式业务证据表写入。数据集由所有准备产物的路径与 SHA-256 摘要确定版本，应用固定读取一个版本。运行角色 `bsmoss_svc` 只有该 schema 的读取权限，维护命令使用单独的 owner 连接 `BSMOSS_DEMO_ADMIN_URL`，不能把 owner 连接交给应用。

## 操作顺序

1. `pnpm db:demo:prepare`：离线生成事实、周期汇总及页面读模型；不连接数据库。当前构建也调用同一准备入口，以保持文件版镜像可部署。
2. 新空库通过既有 `db-init` 工作流建表。已上线库仅在审阅 `deploy/database/ddl/90_demo.sql` 后运行一次 `pnpm db:demo:schema`；该命令使用事务和锁，拒绝重复应用，不运行空库初始化。
3. `pnpm db:demo:seed --bundle tmp/tower-foundation/demo-history`：事务装载版本元数据和逐关系、逐日整数事实。分批插入，核对条数、总量及每个关系逐日的摘要；重复装载同版只校验。
4. `pnpm db:rollup:rebuild --bundle tmp/tower-foundation/demo-history`：从同版事实重新计算周期汇总，与准备包核对，随后核对库内事实，原子发布周期汇总和页面读模型。失败保留旧版及未发布状态；不会部分可见。
5. `pnpm db:demo:verify --bundle tmp/tower-foundation/demo-history`：校验入库事实；该命令不代表浏览器或登录验收。
6. 应用设置 `BSMOSS_DATA_MODE=demo`、`BSMOSS_DEMO_STORAGE=postgres`、`BSMOSS_DEMO_DATASET=<命令返回的64位版本摘要>`。保持原有真实 OIDC。只有 `ready` 数据集可读，每次获取产物核对 SHA-256。应用无建表、装载、发布或重置权限。

`BSMOSS_DEMO_STORAGE` 默认为 `file`，因此本次代码不会自行切换线上存储。正式环境切换需先完成表结构应用、装载、性能验证和版本配置，再重新发布 BS-MOSS。未知存储设置、错误版本或未发布版本明确失败，不降级读取另一版文件。

切换为新数据集后重启应用，清除进程内旧版缓存。回退时恢复旧数据集摘要，或恢复原 `file` 配置及对应镜像。旧数据集在确认不被任何运行实例使用后，才可通过 `pnpm db:demo:reset --dataset <完整摘要>` 删除；该命令级联删除这一版演示数据，不触碰业务 schema。禁止删除正在服务的版本。

## 查询与性能边界

`daily_fact` 主键为数据集／服务关系／日；`period_rollup` 主键为数据集／周期／市／县／运营商；`artifact` 主键为数据集／路径。页面读模型按键读取，不能在每次请求时扫描全部事实。周期汇总保留计量单位、覆盖站址集合和期末站址集合：用量可加，覆盖必须去重，存量不能跨期求和。

当前周期汇总覆盖日、周、月、年。数据库模式下，周期趋势只查询当前时间窗口的汇总行，不读取两年全量汇总压缩包。小时分配仍沿用既有日事实拆分规则，没有新增两年逐小时明细。此变更将历史文件、周期汇总、服务页面模型、报告快照和运行监测模型接入 PostgreSQL 读取；首页及部分旧地图模块仍使用构建期静态摘要。非预生成页面仍有现场计算路径，不应把本次称为全系统 SQL 查询迁移完成。

维护验证必须使用专用本机 PostgreSQL。`pnpm test:demo-db` 创建随机测试库，验证幂等、损坏检测、事务回滚、只读权限和定向重置。设置 `BSMOSS_DEMO_TEST_BUNDLE` 可增加完整样本校验与查询计时；测试只销毁其创建的随机库。CI 的 `db-contract` 同时执行此测试与原业务数据库契约测试。

## 发布状态

worker02 使用 BS-MOSS 自身的 `demo-maintenance` 工作流，固定同一镜像摘要，依次执行 `schema`、`seed`、`rollup`。现有库的 `schema` 阶段只应用演示 schema，不重跑空库初始化；重复执行只核对既有演示表。`rollup` 阶段同时校验事实、读模型摘要和汇总数量。

三项完成后执行 `activate`：再次核验数据，用应用只读账号预检，再更新本产品的 `BSMOSS_DEMO_STORAGE`／`BSMOSS_DEMO_DATASET` 并替换应用容器。失败自动恢复原应用配置和镜像；成功后原配置保存在 worker02 的私有 `etc/app.env.previous-demo`，不回传聊天或 GitHub。后台 workers 必须保持 off，未在此流程启用。

维护容器来自经过扫描的同一应用镜像，不公开端口、不挂载 Docker socket，也不持有平台凭据。数据库 owner 配置仅在 worker02 内通过标准输入传递；应用始终只使用运行账号。平台代码、平台配置和平台部署不在本次范围。
