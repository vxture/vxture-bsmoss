# 对象映射有效期变更预检

2026-11-06，设计255，接续对象映射997。

## 交付

/settings/mappings详情增加“变更预检”，官方DS Input／Button／StatusBadge、原标题与留白规范。输入拟有效期、依据引用和原件SHA-256，版本按产品治理策略加1，保留numeric(30)及UTC六位微秒。原关联身份由数据库固定，不暴露重定向来源或目标操作。旧版本／有效期变化409，相同区间拒绝，展示前后区间、授权内重叠、服务期覆盖、扩展／移除时间差分与草案摘要。

本批是映射有效期只读预检，不是完整配置影响评估。来源配置变更、聚合／报告／接收任务实际影响固定not_assessed，未查隐藏任务、不把未知当0。授权内无重叠仍为“仍需复核”，全局未确认；可见重叠或服务期未覆盖显示“发现阻断项”。依据是未验真的用户声明，不记录假审批人。覆盖差分不是版本变化的完整重算范围；旧报告、任务和分析截至均未改变。

新增独立admin.mappings.preflight，查看／来源／ingest和owner无绕过、机器拒绝；仅baseline加permission种子，无角色赋权。全部对象scope复用现有SQL过滤，当前定义与重叠在同只读可重复读事务，末次重验身份／权限／完整范围／有效期，包含missing、stale和SQL失败路径。POST同源、JSON、8192字节限制、无query、no-store／Cookie Vary／nosniff、同步200，不生成任务或配置写入。结果不是未来受审提交凭证，后续写事务需完整authority修订／摘要及关联基线。

输入修改即取消并清旧结果；收起清结果，关闭详情销毁草案；401／403清列表及Drawer，无浏览器持久缓存。67表和Prisma不变，DDL仅在随机专用本机合同库应用，不改业务数据库，不迁移。

## 验证

733项单测通过tmp/mapping-preflight-tests.log，新增8项覆盖严格输入／微秒覆盖差分／大版本／独立权限／末次复核和HTTP边界。双层types通过tmp/mapping-preflight-types-final.log；首轮新增测试夹具空数组被推断never[]，已显式类型修复，生产构建同时复核通过tmp/mapping-preflight-build.log。未把首轮类型失败计为通过。

453项实际PostgreSQL合同通过tmp/mapping-preflight-pg.log，新增6项：权限种子无赋权、半开微秒重叠与无任何配置／输入／任务写入、隐藏对象及未知全局边界、只读事务失败回滚释放、并发定义变化时旧基线与冲突同快照、真实权限在成功／missing／stale后撤销全部拒绝。首次专用cluster未指定端口启动在5432，合同目标58875连接拒绝；停止该专用cluster并以58875重启后全量重跑通过。收尾停止本轮专用cluster，不删目录。

59项HTTP通过tmp/mapping-preflight-http.log，新增预检匿名401与GET／PUT／DELETE405，原只读API保持。构建、文档编号／schema-mirror／SCA／交付守卫及ASCII、staged gitleaks按收尾记录。

独立无头Chrome验证实际映射组件＋应用DS Providers，1280／904／390三宽无文档或Drawer横溢，版本／精确日期、前后对比、阻断重叠、输入修改清结果、409／503、迟到隔离、收起清结果、403清列表与Drawer、关闭销毁草案通过；页面异常与console warning空。截图已复核，证据artifacts/mapping-preflight-qa/checks.json及result截图。首轮与build同时启动，夹具读取构建中被清理的CSS目录退出，未计通过；最终构建完成后重启并以正式Providers复测通过。此为独立合成组件，不注入正式63333，也不是正式身份／真实来源验收。正式页面仍保持真实会话门槛，最终本机版本及健康见formal-checkpoints/mapping-preflight.json。

## 接续

下一批继续来源配置变更预检，随后接入可授权核对的聚合／报告依赖与接收任务重新基准影响。受审写入必须取得可信提交／批准契约、依据原件核验和独立权限，不由代理自签；真实连接核验需适配器／授权凭据。责任组织主档／授权写入、规则发布、其他审计、原P1工作台／分阶段消息／按需接收、P2共同版本和真实来源／平台注册环境／Beta容量恢复／UAT／生产批准仍待。无push／外部部署／上线、新聊天或自动任务。
