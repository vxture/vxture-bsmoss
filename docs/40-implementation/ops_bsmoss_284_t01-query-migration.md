# T01：迁移基线与统一查询

日期：2026-11-10。属于[塔服研判T01–T08](../70-workplan/70-tower-service-migration-batches.md)的T01，不与旧五阶段或P1–P18混用。**T01本地验收完成，下一批T02尚未开始。**

## 范围与路由基线

复用现有分析工作区、概况、分布、表格、卡片、分页、侧栏、页头、主体及区域控件，不新增CSS、设计系统组件、依赖或业务导航域。主Launcher顺序、原名称和路由保留；业务及配置入口依据统一迁移登记展示待迁移、部分待迁移、保留旧版或基础能力保留。六个原禁用规划项保留且不建设，不创建新空页面。

目标路由登记为下表；除资源切片外均只登记、不创建页面或导航，不代表已完成对应板块。原路由及参数、历史报告、核验、记录和数据全部保留。

| 目标 | 路由 | 本轮状态 |
|---|---|---|
| 经营总览 | /tower-service/overview | T07待实施 |
| 站网全景 | /tower-service/network | T07待实施 |
| 资源底数 | /tower-service/resources | T01统一查询切片，完整三页签在T03 |
| 服务量化 | /tower-service/services | T04待实施 |
| 计量依据 | /tower-service/evidence | T05待实施 |
| 分析研判 | /tower-service/judgment | T06待实施 |
| 数据同步 | /tower-service/sync | T02待实施 |
| 规则配置 | /tower-service/rules | T02待实施 |

来源路径、兼容别名及历史引用按计划70的26组台账保留。代码登记覆盖PortalPage全部入口，并以类型及测试校验不漏项；原导航href不变。旧customer-use服务资源页新增“统一快照查询”链接，选择进入新上下文；新切片可回旧客户使用及单站档案。过渡到旧页时只传其支持的范围，明确旧版，不将snapshotId伪装为旧页已支持条件。

## 快照与查询边界

当前物理资源只有一个可靠的固定合成快照：`demo-resources-20261025-18-v1`，存量时点及数据截至为2026-10-25 18:00:00+08:00，来源和资源模型版本沿用已有证据。此记录为既有演示清单的描述符，不是新生成的正式同步发布版本。同步完成时间、发布时间和业务期间保持空；资源是存量，没有凭空生成月用量、历史租户或第二版本。

新页统一周期（快照版本）、运营商、区域顺序。snapshotId决定资源模型及业务期间元数据，原period/asOf参数在新查询拒绝，不将旧小时日期翻译成同步版本。运营商仍是演示品牌分类，选择关联站址并统计这些站址内去重物理设施，不能称客户独占配置或具体客户实体。月度租户、锚定和确认配置待接入。

统一纯规则由服务端目录及授权范围输入，查询不能携带grants／workspace或自增版本；未知、重复、超范围快照、比较基准及地域拒绝。对比区分同期间修订、月环比、年同比和自定义，规则／映射／数据集／完整性不兼容不输出可比增长；零基准、未知与精确整数分别处理。当前只有一个资源版本，页面仅显示对比入口及“暂无基准版本”提示，不展示伪对比。双版本逻辑使用测试夹具验证，未声称前台已具备真实双版数据。

搜索、入驻家数及分页仅影响清单，省市汇总不随搜索变化；区域和运营商影响全页。URL存储同一查询，图表下钻、分页、重置及侧栏统一引用它；旧页保留原查询语义。预览关闭时新页不返回演示清单和版本，尚不新增正式来源权限适配，不以预览目录当生产授权。

## 实际页面及兼容路径清点

以当前`app/**/page.tsx`清点46条页面路由，其中45条原有路由全部保留，新增仅1条资源切片。下表按原语义登记；同一格列出多个实际路径不表示新增页面。API、报告文件和历史记录仍沿原服务读取，不在本批重编号或重建。

| 原语义／名称 | 实际路径及参数入口 | 目标／批次 | 权限与保留方式 |
|---|---|---|---|
| 运行总览、综合研判 | `/`、`/board` | 经营总览T07、分析研判T06 | 原预览及正式数据守卫保留，T01不接管 |
| 原站网地图与工具 | `/product-preview`、`/product-preview/metrics`、`/product-preview/copyright` | 地图框架T07；原点位与工具保留旧版 | 原预览开关不变，不转成区域级正式快照 |
| 站址管理、单站档案 | `/sites`、`/sites/[id]` | 资源底数T03 | 站址及设备仍在原范围，单站ID不变 |
| 客户使用三模式 | `/customer-use?section=resources\|performance\|legacy` | 资源T03／计量T05；原分析保留 | 原预览开关；旧`period/asOf`含义不变 |
| 共享、业务用量兼容 | `/sharing`、`/operator-usage` | 可复用部分T03/T04；原通信用量保留 | 原兼容链接和重复参数校验保留 |
| 原运行分析 | `/monitoring`、`/capacity`、`/efficiency` | 前两项保留旧版；可靠计量部分T05 | 原阈值、来源和页面守卫不变，不迁入故障/SLA目标 |
| 原经营分析及报告详情 | `/analysis`、`/analysis/report` | 适用组件T04/T06 | 原预览与正式聚合／报告授权保留；历史选择和报告引用保留 |
| 报告中心、生成、任务 | `/reports`、`/reports/new`、`/reports/tasks` | 分析研判T06 | 原报告查询／生成／导出／任务授权分别执行，历史及文件不变 |
| 报告兼容入口 | `/usage-reports`、`/operations/reports`、`/settings/operations/reports` | 原语义转发保留，T06/T08 | 原`selection/search/report/revision`等选择语义按原解析器处理，不批量指向新研判 |
| 用量核验及记录 | `/usage-review`、`/usage-review/[id]`、`/usage-review/history`、`/review-history`；`view=records` | 保留旧版T06/T08 | 原案件、复核、事件及会话引用保留，不改成新关注事项 |
| 数据更新与归集 | `/operations/data-updates`、`/operations/aggregation` | 数据同步T02 | 原接收／聚合／任务查看与恢复权限保留 |
| 数据操作兼容入口 | `/settings/operations/data-updates`、`/settings/operations/aggregation` | T02/T08 | 沿现有`legacyDestination`语义转发，不增加授权 |
| 管理总览 | `/settings` | 规则配置入口T08 | 原管理入口保留，导航不授予写权限 |
| 总览设置及兼容 | `/settings/overview`、`/preferences/overview` | 总览设置下钻T07 | 原个人／管理员配置边界保留 |
| 运营主体 | `/settings/operators` | 规则配置T02 | 原`admin.operators.view/edit`，Logo及自定义主体不覆盖 |
| 业务字典及兼容 | `/settings/dictionaries`、`/settings/classifications`、`/settings/metrics` | 规则目录T02/T04 | 兼容页仍转原`view=classifications/metrics`，不重解释通信指标 |
| 分析规则、模板 | `/settings/rules`、`/settings/templates` | 适用规则T02/T05/T06，报告模板T06 | 原规则查看／编辑与模板查看／发布／选择权限保留，旧版本不覆盖 |
| 组织权限及兼容 | `/settings/access`、`/settings/members`、`/settings/jurisdiction` | 规则配置T02/T08 | 原成员和管辖权限；兼容页仍转对应`view`，不扩展客户或区域范围 |
| 数据接入及兼容 | `/settings/data-access`、`/settings/sources`、`/settings/mappings` | 数据同步T02 | 原来源、映射、预检及影响查看权限分别保留；不新增凭据 |
| 配置审计 | `/settings/audit` | 基础能力保留T02/T08 | 原`admin.configuration_audit.view`及对象归属不变 |
| 本批唯一新增 | `/tower-service/resources` | T01查询切片；完整资源底数T03 | 仅预览开关内的服务端演示范围；正式适配未接入时不返回演示版本 |

权限基线以现有`domains/access/resolve.ts`、各页面和API的服务端守卫为准。正式服务仍先校验平台身份／产品权益，再校验本地操作权限、工作区及数据范围；上述路由登记不是新权限清单。T01只验证统一查询纯规则对服务端快照／客户／区域范围的求交和拒绝，不宣称总部、省、市生产身份已经接通。

旧链接中的区域、周期、搜索、对比、记录会话及`investigation`链路继续由原解析器处理；`#occupancy/#sharing/#usage`继续打开原分析。穿越新旧上下文时不自动转换快照，旧页的历史、任务、记录和文件引用不重写。来源路径存在已清点；实际HTTP回归覆盖代表性旧入口及兼容校验，不将46条逐页人工操作都宣称完成。

## 验证

- 全量应用单测883项通过（其中本批新增6项）：`tmp/t01-all-tests.log`；最终相关查询、迁移登记、导航及地域回归13项通过：`tmp/t01-release-focused.log`。
- 最终生产构建及类型检查通过：`tmp/t01-release-build.log`；使用最终构建的66项HTTP检查通过：`tmp/t01-release-http.log`，包含正式预览关闭、伪造／重复／越界参数和旧入口兼容。
- 实际浏览器21组记录：旧入口到新切片、全省1,080站／5,400设施、其他120站／600设施、西安其他27站／135设施、实时搜索、零结果筛选与重置、每页数量及前后退、侧栏5项设施及原档案链接、业务与配置Launcher迁移标记；390／475／984／1440宽度、明暗主题、共享卡片均无页面横向溢出，0条本轮控制台错误。证据：[checks.json](../../artifacts/t01-query-qa/checks.json)、[最终页面](../../artifacts/t01-query-qa/final.png)，截图及管理入口记录在同目录。
- 最终构建完成后重启127.0.0.1:63333，进程10924，预览开启、OIDC关闭；页面重载核对数据及版本成功，恢复浅色和默认窗口尺寸。该进程号仅为本地验收当时记录，不是生产托管状态。

本批未新增依赖、CSS／主题覆盖、DDL、生产配置或生产权限，未提交、推送或部署。旧页面、路由、历史及规则没有因T01删除；工作区原有其他变更保留。唯一新路由为资源统一查询切片，T02不自动开工。
