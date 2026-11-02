# 后续代理入口

## 最新地图展示配置（2026-11-02）

已完成顶部三类六指标的选择／排序（1–3 项），以及每专题地图显示、区块显隐／排序、3／4／6 站、指标证据和完整／精简模板。
display-rules 纯规则解析本地偏好；Zustand display 更新规范化，bsmoss.map-display.v1 自动保存／刷新恢复。
map-view.v1 原图层偏好继续保留。偏好只影响显示，不能变成权限、查询过滤或阈值；未知电耗不补零。
地图关注与未知模式在点位入源前过滤平稳站并重聚合，图例为实际显示点数，统计和走势仍按完整筛选范围。
基本计数、规则、模拟标识、未分摊提示不能隐藏；区块和站点证据可配置。按专题隔离，恢复当前专题不影响其他专题或概览。
290 单测、10 HTTP、类型／构建／浏览器／守卫通过，见 40-implementation/170-display-configuration.md。
下一项演示多边形圈选（圆形已完成，见210）；规则阈值管理、账户同步与正式报告尚未完成。无 DDL、迁移、真实接入或部署变更。

## 最新专题分析（2026-11-02）

已完成容量与质量／供电保障／能效观察三个地图专题，沿用 region／city／county／selection／operator／hour。
topic-rules 为纯规则，服务复用演示 map API，topic=capacity|power|efficiency 纳入 contextKey；bbox 只过滤点位。
每小时在同一筛选站群重判；物理站数去重，未知不补零，单运营商电耗未分摊不能计算能效，关注站业务量不是损失流量。
浮窗与单站／区域／对比整块切换，保留几何与清单；专题地图着色临时隐藏热力与对比序号，默认标准地图不变。
支持小时点击、地市分布下钻、单站下钻、加入对比、URL 恢复；规则阈值显式展示，版本 bsmoss-demo-topics-v1。
284 单测、10 项 HTTP、双层类型／构建／浏览器／守卫通过，见 40-implementation/160-topic-analysis.md。
下一批演示专题图层／指标显示配置深化；无 DDL、迁移、正式规则发布或部署，不把演示记为 I11/I12 正式完成。

## 最新站点对比与底图要求（2026-11-02）

新增 2–4 站对比浮窗、基准／差值、三类 8 项指标、多线趋势、地图／检索／详情加入、URL 恢复；演示 API 为 /api/product-preview/compare。
同地域／选区／运营商／小时，候选检索与镜头不改对比口径；无服务／越界占位，不补零。比率差值用百分点，共享电耗不擅自分摊。
用户明确标准地图作为默认以减少数据量：初次不注册卫星图源，仅点击卫星时创建与加载。不要恢复默认遥感影像。
276 单测与 9 项 HTTP 测试通过，最终构建／类型／浏览器／守卫见 40-implementation/150-station-comparison.md。
下一批客户演示推进专题分析；未部署、未改数据库，不迁移。

## 最新地图空间分析（2026-11-02）

矩形框选分析已实现：拖动／两角点／当前视野，370px 浮窗、三类指标、24 小时趋势、运营商构成与重点站点下钻。
selection 与地域／运营商／检索取交集；bbox 只过滤可见点位。比率加权、物理站去重、运营商电耗未分摊保持未知。
切市县清选区，换运营商／小时保留；URL 恢复、取消重画、返回区域保留选区。当前仍仅陕西合成演示。
269 单测通过；最终区域回归、类型／构建／HTTP／浏览器及守卫细节见 40-implementation/140-shaanxi-map-workbench.md。
下一批演示优先站点对比／专题分析，不误报正式 I11 报告、真实接入或部署完成。未改 DDL，不迁移数据库。

## 最新交互修订（2026-11-02）

已补省／市／县级联：省选择仅含陕西，10 地市下区县有父级校验、地图边界与 URL 恢复。
运行检查和经营统计是独立面板，单窗 470px、宽屏双窗 360–440px，可独立关闭／放大与整块切换。
窄屏双窗状态保留但一次聚焦一窗；勿恢复内部双页签或窄详情。
263 项单测已通过；构建、HTTP、浏览器与守卫最终结果见 40-implementation/140-shaanxi-map-workbench.md。


## 陕西客户演示与内部全国架构（2026-11-02，覆盖历史跨省演示要求）

用户确定地图工作台参考 osiris，演示以运行状态/经营分析双主线丰富单站数据，可使用明确标记的模拟场景。
全国仅指内部技术架构可扩展；当前客户产品/演示只展示陕西，不加入其他省份、全国入口或省份切换。
用户已明确撤回第二省演示要求。11 万站址仅为陕西规划输入，当前模拟样本为 1,080 站址。
地域规格见 20-specs/80-national-map-demo.md，已同步产品定义、门户结构与规格索引。
新增省份未来通过地域配置和数据适配扩展，当前不准备其他省份数据或界面。
已实现 MapLibre 地图工作台、场景规则、地图/单站演示 API、双主线分析与 ECharts 趋势。
用户反馈首版过于看板化，已改全幅卫星地图、轻量悬浮图标/可折叠面板、紧凑详情、底部动态滚动条；勿恢复固定占位侧栏或大标题。
见 40-implementation/140-shaanxi-map-workbench.md。259 单测通过，最终类型/构建/HTTP 与浏览器结果见该记录。
演示页面/API 仍由 BSMOSS_PRODUCT_PREVIEW 控制；原指标配置页保留在 /product-preview/metrics。未改 DDL 或部署。

本仓库是 BS-MOSS 初始骨架，参考 yucer 分层。先读产品规格、工作计划与 CLAUDE.md。
不要误认为已复用整套平台接入或已经部署；当前页面仅为受开关控制的样例门户。
优先推进 B1，业务上下文必须来自可信身份。不要引入销售 CRM 或机器人控制业务。


## 当前范围更新 V0.2

只实施周期性用量分析，费用仅预留；先读 20-specs/60-periodic-usage-analysis.md。
不要以早期计价示例或旧设计中的结算章节为依据继续实施费用功能。

## 指标体系 V0.3

用户指定固定三类：经营服务性、运营状态、运行参数；显示可配置。先读 70-metric-catalog.md，
不可把三类所有值塞入 UsageRecord。当前工作为规划，费用仍仅预留。

## 敏捷推进入口

以 70-workplan/30-product-backlog.md 跟踪状态；下一项 D03 ready。
20-agile-delivery.md 定义阶段与完成条件，40-first-iteration.md 定义 S0/S1。
部署/上线按 50-deployment/20-release-plan.md；不要把规划文件完成写成业务功能已实现。

## 最新事实（2026-10-28，覆盖历史下一步）

I04测量持久化、I10样例门户已完成，见40-implementation/30-measurement-store.md及40-sample-portal.md。
当前单测43项，门户HTTP子测试4项；此前DB23项子检查。I10生产构建及浏览器验收通过，未部署。
样例需BSMOSS_PRODUCT_PREVIEW=on，启动必须显式PORT（本地可0），默认loopback。
6个虚构站址、固定2026-10-25，11项定义，小时/日；其他粒度不虚构数据，短信未接入。
个人配置仅localStorage，正式报告和账户级存储未实现。I08/I09/I11/I12仍未完成。
I05已in_progress：domains/access内部授权编排与测量门面、17项新增测试完成。
见40-implementation/50-trusted-access.md；这些内部端口没有生产provider，禁止当作已验签身份入口。
每次调用重解身份/覆盖/本地权限/有限范围，owner只获得操作基线，不自造物理数据范围。
平台原件链接已实际打开但要求登录，未读正文；后续须先核验原件再实现跨仓wire，不造第二份标准。
下一步C1/C2/C3真实适配与本地授权持久化，实际集成待注册资料，D05仍缺授权来源样例。

## 全面参照 yucer 后的最新入口（2026-10-28，覆盖前述下一步）

已完成本批工程代码适配，先读40-implementation/60-yucer-alignment.md及70-engineering-verification.md。
C1/C2/C3、PgProvisioningStore、Pg本地grant与受保护/api/measurements已接线；不再是只有内部端口。
正式路径参照yucer当前实现：/api/auth/oidc/callback、/api/webhooks/vxture；没有旧路径迁移。
26表空库基线，初始化脚本统一事务；local_usage只预留，禁止把监测站址通话/流量上报为商业用量。
生产本地授权没有内存回退；owner操作基线不扩大对象范围，data_scope需要显式有限列表和有效期。
176单测、28 DB测试、6 HTTP测试、类型/Prisma/构建/本地gitleaks与守卫已通过。
采用yucer依赖修复floors并更新lock；npm audit仍因ECONNRESET未完成，不可宣称扫描通过。
六门禁/CodeQL/镜像/交付文件已创建，未推送、未跑远端CI、未应用ruleset、未部署、未分配端口。
deploy/stack.env.example和根.env.example分别写stack.env/app.env，owner凭据不进app容器。
I05与R01仍in_progress，前者待真实注册联调，后者待远端门禁/扫描证据；D05仍缺授权来源。
后续按50-deployment/30-delivery-runbook.md准备环境，同时推进可独立验证的聚合规则；不要重复制定接入协议。

## I08 规则推进后的最新入口（2026-10-28）

新增domains/aggregation的periods/intervals/gauges/states及22项测试；当前总单测198项，双层类型检查通过。
读40-implementation/80-periodic-aggregation.md。I08已in_progress，仅纯计算核心完成。
规范增量/比率/依赖同窗派生、最新测量与质量修订、适用窗口、水位与输入指纹已实现；
状态TTL/未知区间/转换及瞬时样本均值和时长加权分开处理。
输入计划只能由后续可信服务构造，未接HTTP或数据库结果表，不要让客户端构造来源权威和适用窗口。
累计差分/复位/回绕仍待I07；总分表权威与跨对象去重不能由加法推断。
I09调度与I11/I12正式报告未实现，样例门户保持原样，未部署或新建自动化。

## I07 累计标准化后的最新入口（2026-10-29）

新增domains/normalization/counters.ts及26项行为测试；总单测224项，双层类型检查通过。
读40-implementation/90-counter-normalization.md。I07已in_progress，仅纯规则子任务完成。
累计来源首读baseline；明确复位需终读/初读，回绕需模数与精确圈数或严格物理界限。
窗口缺采、无依据下降、质量撤销、epoch/映射切换、分数规范计数等保持pending，不自动补量。
eligible只是候选，不是verified质量批准；证明引用的真实性须由可信接入服务核验。
读数修订影响前后两个区间；后续I09重算必须覆盖邻接区间。
未改DDL/HTTP/前端/依赖/部署，I06仍待D05正式来源，I08聚合持久化/编排和I09调度未完成。

## I08 区间结果持久化后的最新入口（2026-10-29）

读40-implementation/100-aggregate-persistence.md。aggregation/service、store及PgAggregateStore已实现，
空库基线29表（新增bsmoss_analysis三表），Prisma标量镜像一致；没有旧库迁移。
输入指纹幂等、expectedRevision并发检查、旧重放不回退、结果/指针/outbox原子事务已实测。
显式有限来源/主体/指标三元组；服务检查metering及metering.aggregate/view，actor取ctx.sub。
metering.aggregate只入种子，未自动授权，生产组合根/来源查询和聚合HTTP尚未接线。
保存首次输入清单和证据引用，不代表独立验证来源真实性；瞬时/状态结果尚未进入本存储。
当前229单测、36 DB测试（35子项+父项）、双层类型/Prisma/29表镜像/文档/交付守卫通过，相关本地密钥扫描无发现。
临时PostgreSQL18.4恢复二进制后用aggregate-data新建独立测试集群，测试结束已停止；旧data未动。
I08仍in_progress，I09/outbox消费者/正式汇总面板报告尚未实现；门户保持样例，未推送、未部署。

## I08 可信快照编排后的最新入口（2026-10-29）

读40-implementation/110-trusted-aggregate-orchestration.md。PgAggregateSnapshotReader+createAuthorizedAggregates完成直接增量/比率内部链路。
resolve增加aggregate操作，owner需显式metering.aggregate权限；runtime.aggregatesForSession复用RP/C2/grant，无新路由。
请求仅选择来源/映射/指标/粒度/时点/expectedRevision，主体与输入由服务端生成。
REPEATABLE READ快照读取有效映射/active能力/最新事实/最新质量；修订移出窗口或对象不会回退旧版。
能力rules.intervalAggregation={version:1,inputMode:'direct',authorityRef:非空审阅引用}，缺配置/能力重叠/同主体映射别名即拒绝。
只接受完整周期映射/能力/服务，跨边界暂拒绝；依赖派生和跨映射规划未接入。
没有来源完成账本，watermark用周期起点且sourceComplete=false，最多preliminary，不能宣称complete。
单次最多100000事实、授权各列表最多10000，省级需后续分片；快照读取与发布为两个事务，新事实传播仍待I09。
236单测、45DB（44子项+父项）、双层类型/29表镜像/文档/交付守卫/相关本地密钥扫描通过；测试集群已停止。
本批无DDL/依赖/迁移/HTTP/前端/部署；I08仍in_progress，D05/I06真实来源与I09/I11/I12未完成。

## I08 来源完成证据后的最新入口（2026-10-29）

读40-implementation/120-source-completion.md。source_completion追加确认/撤销账本，空库30表/Prisma一致，无旧库迁移。
bindSourceCompletion绑定基础快照（sourceComplete=false/watermark周期起点/不含completionEvidence）的inputFingerprint。
最新confirmed匹配+水位覆盖+合法verified窗口齐全才complete；质量/事实/权威变更使确认stale，撤销不回退旧确认。
结果与manifest保留确认修订/原件引用/摘要。规则升为bsmoss-periodic-v2，旧算法重放需旧构建，不自动解释v1指纹。
运行账号只读账本；管理测试录入不代表真实来源核验，无新HTTP或自动确认写入器。
账本与测量同一RR快照，读取后提交的新确认下轮可见；自动重算/撤销传播仍待I09。
243单测/50DB（49子项+父项）、双层类型/Prisma/30表镜像/文档/交付守卫/相关扫描通过；隔离测试集群已停止。
I08仍in_progress，下一批跨映射适用窗口，其后依赖派生/瞬时状态存储/权威汇总；D05/I06/I09/I11/I12未完成，未部署。

## I08 有效窗口规划后的最新入口（2026-10-29）

读40-implementation/130-effective-windows.md。planMappingWindows+PgAggregateSnapshotReader已支持同主体相邻映射和服务启停窗口。
锚点mappingId仅定位已授权稳定主体；同租户/来源/站址/服务/网络对象/设备元组的相邻映射自动规划，不跨主体合并。
mappingWindows逐窗绑定ID/版本；输入校验、结果证据、authority摘要及输入指纹保留切换依据。
映射缺口/重叠/非对齐边界拒绝；服务无交集为not_applicable，激活时段内少采仍partial/missing。
来源能力仍要求唯一完整周期且统一原生频率；跨能力/混合粒度未支持。
多个映射实际参与时不复用单映射completion，最多preliminary；组合证明待补。单映射确认机制仍有效，新清单需新指纹匹配。
251单测/56DB（55子项+父项）、双层类型/30表镜像/文档/交付守卫/相关扫描通过，隔离测试集群已停止。
无DDL/依赖/迁移/HTTP/前端/部署，I08仍in_progress。下一批依赖派生输入与组合证明，随后瞬时状态存储/权威汇总；D05/I06/I09/I11/I12未完成。


## 运营商使用核查与最新优先级（2026-11-02）

用户明确退服影响分析为 P2，暂缓开发，先推进确定性业务。当前范围仍无费用。
读 40-implementation/180-operator-usage.md 及 20-specs/80-national-map-demo.md 最新章节。
新增 operator-rules 与 /api/product-preview/operators：同一地图筛选站群，小时／固定样例日全天、站址去重、
服务关系计数、业务整数守恒、合并分子分母、原始计数和场景版本。仅合成场景核查，不代表真实多源对账。
新增独立悬浮面板、24 小时分运营商结构、证据展开；URL usage=hour|day，与专题／对比／单站面板整块切换。
容量为合成归一化单位；单运营商电耗不分摊。全幅标准地图默认不变，390px 无页面溢出。
298 单测、11 HTTP、双层类型、生产构建与守卫通过。浏览器独立无头 Chrome 验证完成；预览复用 63333。
无依赖／DDL／数据库迁移／外部部署。下一步确定性周期分析与报告，D05/I06/I09/I11/I12 正式状态不变。


## 确定性日报与下载（2026-11-02）

读 40-implementation/190-daily-report.md 与地图规格最新“演示日报与下载”。
新增 report-rules/report-html、/api/product-preview/reports 和独立 report-panel。
固定样例日完整全天三类指标、站群同小时忙时、比率极值、物理温度样本、备用供电观测、重点站址、24 小时明细。
复用运营商日聚合；小时／镜头／专题不改变日报范围和报告引用。温度为样本均值，备用供电为站时观测，不是退服或实际时长。
报告为 demo/draft；SHA-256 前 20 位稳定引用不等于持久化发布编号。HTML 附件离线可读、动态文本转义、CSP/nosniff，下载重新检查演示开关与范围。
URL report=day 优先恢复，面板互斥保留选区与对比清单，打开暂停回放；个人展示偏好不改变报告模板。
306 单测、12 HTTP、双层类型、生产构建、守卫及桌面／窄屏／下载离线浏览器验证通过。预览 63333，独立无头 Chrome 测试未操作用户浏览器。
无费用／退服开发／依赖／DDL／数据库／外部部署；正式 I09/I11/I12 仍未交付，不将演示下载称为正式报告导出。
报告持久化、发布状态机、历史基期和正式周期调度为后续，退服影响分析保持 P2。


## 地图底部布局修订（2026-11-02）

用户要求地图操作右下、图例放大左下、右上定位数据迁移，并追加左／中／右三块底部对齐。
读 40-implementation/200-map-corner-layout.md。新增 mw-map-dock 合并底图／倾斜／全域／缩放和实时地图中心／级别，
图例左下、回放中下统一底边；专题／日报／单站等浮窗留底部空间。窄屏回放紧凑，按钮展开完整滑块。
生产构建、761/1024/1440/390px 浏览器布局、底边相等、互不遮挡、窄屏展开和实际缩放读数更新通过，无页面 JS 错误。
预览仍为 63333，标准底图默认及统计规则不变；无依赖／DDL／DB／外部部署。

## 地图工具紧凑化与品牌更新（2026-11-02）

左下「站点数｜状态」28px 单行（移动26px），渐变透明，无固定大卡片；专题未知仍保留。
右下四图标竖排：复位／放大／缩小／设置；底图与倾斜入弹框，坐标独立最下方。
地理视图提示移到图标左侧，OpenStreetMap 来源链接保留并去除白色框，位于坐标下方。
品牌第一行观澜、第二行 BS-MOSS 与中文名。细节见 40-implementation/200-map-corner-layout.md。

## 版权展示最终决定（2026-11-02，覆盖上文）

用户最终要求主地图去掉署名控件，已不挂载 AttributionControl；来源元数据保留，帮助内入口至 /product-preview/copyright 集中说明来源。
该页受演示开关控制，列明 OSM／ODbL／瓦片政策、Esri 及合成数据；独立声明不代表已确认提供方条款合规，正式授权待确认。

## 品牌与底部信息最终澄清（2026-11-02）

品牌为左右两块：左观澜，右上BS-MOSS／右下中文描述，无竖线；覆盖此前通栏两行描述。
地理视图／主题与经纬度、级别合在 mw-map-footer 单行，底边与图例、桌面时序回放一致。四图标竖排仍在上方。

## 圆形圈选分析（2026-11-02）

圆形已完成本批演示，见40-implementation/210-circle-selection.md与地图规格圆形章节。
Selection为矩形Bounds或{kind:circle,center,radiusMeters}；selection=circle:lng,lat,radius米，旧矩形URL保留。
geometry纯规则按球面距离筛选（R=6371008.8m，边界包含），外接矩形仅用于相机；10m–500km，无极区／跨日期线。轮廓96段仅用于显示，不用其外接矩形取站。
拖动／两点／形状切换、输入公里半径／快捷1/3/5/10km、取消保留旧范围、刷新恢复；改几何清对比，切小时／运营商保留，切市县清除。
地图／专题／单站／对比／运营商核查／日报／HTML下载全部遵循同一圆形交集；物理去重、比率合并和电耗未分摊不变。
圈选与区域面板期间隐藏站点分析入口，修复移动端重画按钮被覆盖。底部布局和品牌保留。
313单测、13HTTP、类型／生产构建／守卫、桌面移动浏览器通过，63333已更新；无DB／DDL／迁移／依赖／外部部署。
下一批多边形圈选；退服P2／费用预留、正式来源与I09/I11/I12待办状态不变。

## 多边形圈选分析（2026-11-02）

读40-implementation/220-polygon-selection.md与地图规格最新章节。多边形本批已实施，覆盖上条待办。
Selection新增{kind:polygon,vertices:[lng,lat][]}；URL/API selection=polygon:lng,lat;...，3–32点／6位精度／2048字符，无孔洞、极区或跨日期线。
纯geometry按经纬度平面线段判断凹／凸与边界，拒绝自交／自接触／重复／相邻共线／坍缩；规范逆时针与最小坐标起点，同环共享上下文和报告ID。
绘制支持逐点、撤销、完成、点首点闭合、Enter／Backspace／Escape，取消保留已提交范围；地图／专题／单站／对比／核查／日报／HTML沿用真实几何交集，相机bbox不影响分析。
西安示例polygon:108.8,34.1;109.1,34.1;108.95,34.5得69个物理站址。圆形半径表单已按kind收窄，矩形／圆形浏览器回归通过。
320单测、14HTTP、双层类型／构建、1440／390px绘制与报告验证通过，JS错误0；截图artifacts/map-workbench/polygon-*.png。63333已更新，无DB／DDL／依赖／迁移／外部部署。
下一批确定性日／周／月周期分析口径与面板；正式来源／调度／持久化发布、11万站容量验证待办，退服P2／费用预留不变。

最终补充：390px真实触屏事件tap绘制与完成通过；50篇文档编号／交付／SCA配置／30表静态镜像／9个源码ASCII守卫通过。未跑DB或在线漏洞扫描。当前63333生产预览exec session为20444。

## 日／周／月周期分析（2026-11-02）

读40-implementation/230-calendar-period-analysis.md与地图规格末章。新增period-rules／period-report-rules／period-report-html及calendar-panel／period-selector。
固定演示周期：日10-25，周10-19至10-26，月10-01至11-01，Asia/Shanghai半开区间；sampleCutoff=11-01。原地图仍10-25，不随报告周期改日期。
calendarSampler按日期／星期／类型／运营商生成差异且保持10-25原值；每请求每站缓存，报告复用核查遍历收集日明细／物理样本／实际同刻峰值／排行。
完整省级月流量17693161582452974字节，超53位：周／月bytes/upBytes/downBytes为十进制string，BigInt累加和核查，图表才Number换算；其他计数安全整数检查。时／日原DTO不改。
新增queryCalendarUsage／queryCalendarReport服务适配器；HTTP operators period=week|month，reports period=day|week|month，原缺省日报兼容。直接旧queryOperatorUsage/queryDailyReport仍只处理原时／日输入。
报告日／周／月与核查时／日／周／月按钮、独立周期状态、URL恢复、逐日柱选择、运营商分项、证据及离线HTML下载完成；day/week/month模板独立，旧结果上下文不匹配即隐藏并禁下载。
原始报告仍demo/draft，complete_synthetic只代表完整样例，不是真实来源完成签认。电耗不分摊，物理站数不乘天数，温度与备用供电按物理站时样本，不推断退服或费用。
333单测、15HTTP、双层类型／构建和初轮桌面／390px浏览器通过，JS错误0；最终手机卡片紧凑化／章节滚动复位及守卫待本轮收尾确认。当前本地63333 exec session96937。
下批可核查的环比基期与日均比较；同比基期、真实来源／调度／持久化发布和11万站容量验证未完成，退服P2／费用预留不变。

最终验收补充：手机三列紧凑卡片、章节／范围滚动复位已完成并构建；390px真实触屏、全省月量长值、1024px布局、延迟旧响应隔离、503禁下载／重试恢复通过，JS错误0。
51篇文档编号／交付／SCA配置／30表静态镜像／16个源码ASCII守卫通过；未跑DB／在线漏洞扫描。预览63333已更新，当前exec session30418，测试脚本tmp/period-browser.cjs及period-touch-retry.cjs。

## 环比基期与日均对比（2026-11-02）

读40-implementation/240-period-over-period-comparison.md及地图规格末章。基期：日10-24、周10-12至19、月9-01至10-01，和本期相邻；9月30天、10月31天。calendarSampler扩到9—10月，原10月数值不改。
新增period-comparison-rules/display/html与前端period-comparison组件；GET /api/product-preview/period-comparison，period=day|week|month。报告service复用已算本期补算基期，comparison纳入摘要；日报／周期模板v2，日历规则v2，比较规则v1。
BigInt保留原始字节／带符号delta，日均按各自天数归一化；基期0分from_zero/both_zero均无变化率；比率先合并再给百分点。scope／精确cohort／规则／窗口／物理和服务样本完整性不匹配或空范围不出变化率。
报告独立环比页签、周月核查页签、全天核查按需details；总量／日均、窗口、原始计数／样本、单运营商电耗null。HTML仍6顶层章节，含同一比较。无同比、不分摊电耗、不推断退服／费用。
346单测、16HTTP、双层类型／构建及初轮桌面／390px比较和离线下载通过，JS错误0；最终手机表列宽与服务样本证据已修正待收尾复测。预览exec session36089，最终重构建session35211待检查。
下批周期站址／区域排行与变化贡献；真实同比／服务变更和缺数界面、真实来源／调度／持久化发布与11万站容量验证待办，退服P2不变。

最终验收补充：390px四列完整可见、总量／日均真实触屏切换、503重试、旧周响应隔离、零基期文案及全省月度390px／1024px布局均通过，JS错误0。346单测、16HTTP、双层类型检查和最终生产构建通过；52篇文档编号／交付／SCA配置／30表静态镜像／18个源码测试ASCII守卫通过。未跑DB或在线漏洞扫描，无迁移／真实接入／外部部署。63333已加载最终构建，当前exec session75822；验收脚本tmp/comparison-period-browser.cjs、comparison-period-touch.cjs、comparison-period-province.cjs，截图artifacts/map-workbench/comparison-*.png。本批已收尾，覆盖上条待检查记录。

## 周期排行与变化贡献（2026-11-02）

读40-implementation/250-period-ranking-contribution.md及地图规格末章。本批已完成相邻周期的市／县／物理站址排行与流量／通话／短信增减贡献；入口“环比分析 → 排行与贡献”，保留总量／日均控制。单站榜可打开原有单站面板，其仍使用地图小时。

新增period-contribution-rules／html／test与前端period-contribution。collector复用报告当前期及比较基期遍历；层级分组计数需先对账，原环比不可比或分项不一致则不给贡献。比较规则v2，日报／周月模板v3，版本与贡献纳入报告摘要，原两期窗口和统计数值不改，无新增API。

TOP 5与其余合计守恒；增量+减量=净变化，增减持平数量等于分项数。拉动百分点用分项变化／范围基期总量，不用整体净变化；零基期为null。日均delta为精确分子c*pDays-p*cDays，分母cDays*pDays，百分点分母pTotal*cDays；月长差异可能改变方向，独立排序。BigInt原始计数／变化／尾项以十进制字符串传输，显示时换单位。固定站址与服务关系合成样例，不推断原因，不拆加比率或分摊电耗。

355单测、17HTTP、双层类型／最终构建，桌面日周月、范围／运营商切换、单站点击、离线报告、390px全省月量真实触屏和1024px布局通过，JS错误0；503重试／旧响应隔离／零基期回归通过。移动贡献控件压缩，首屏显示净增减摘要。切运营商重载会恢复内部环比概览，需重新选择排行与贡献。

53篇文档编号／交付／SCA配置／30表静态镜像／14个本批源码测试ASCII守卫通过；无DB测试／在线漏洞扫描／DDL／迁移／依赖或外部部署。63333当前生产exec session37806，脚本tmp/contribution-browser.cjs，截图artifacts/map-workbench/contribution-*.png及离线contribution-month-report.html。

后续确定性业务：单站周期趋势与异常波动定位。真实同比、服务变更／缺数界面、真实来源／调度／持久化发布、11万站容量验证待办；退服P2、费用预留及正式I09/I11/I12出口状态不变。

## 单站周期趋势与波动定位（2026-11-02）

读40-implementation/260-station-period-wave-analysis.md与地图规格末章。本批完成单站运行／经营面板的时段／日／周／月选择、三业务总量／自然周期环比、月日均环比、逐日与逐小时趋势、所选日的合并接通率／负载和物理电耗。两个面板周期状态独立且为本地状态，刷新恢复时段。

新增station-period-rules／test、station-period-panel／chart及GET /api/product-preview/station/[id]/period（缺省day）。service沿用selectSites交集、白名单、flag关闭404、越界站404、非法400／过长413、成功no-store／nosniff。上下文隔离站址／范围／周期／版本，镜头／地图小时／专题不改变统计；失败重试、取消旧请求。

参考为此前7/14/21/28天同星期同小时四样本中位数，最早10-01取09-03；严格早于当前样本，可包含本期更早日期，与自然周期环比基期独立。逐日参考是逐时中位数合计。四原值／日期／中位数分子／变化分子保留，BigInt门槛比较和排名。15%并且绝对变化达到1GiB/300秒/20条才标记；零参考百分比null、绝对门槛仍适用，不足四参考不判断。未达门槛仍显示最大偏离，前8条保留完整数量／日期／上下偏统计，全部日期小时可查。交通／园区已有样例产生线索，未改动旧合成用量；不推断故障或因果。

历史选择只在面板内定位；仅10-25提供显式同步地图小时。线索点击滚回日内定位，运行／经营可以独立选择周期。运营商电耗继续null，周期用量与报告一致。无单站离线导出，本批只完成交互分析。

365单测、18HTTP、最终双层类型／构建、54篇文档编号／交付／SCA配置／30表静态镜像／9个本批源码测试ASCII守卫通过；未跑DB／在线漏洞扫描。桌面三周期／三指标／参考曲线／线索定位／原始证据／地图隔离和同步／双面板，390px真实触屏／1024px、503重试与旧响应隔离通过，JS错误0。63333最终生产exec session4681；脚本tmp/station-period-browser.cjs及station-period-retry.cjs，截图artifacts/map-workbench/station-period-*.png。

下一批确定性业务：单站周期分析离线报告与波动证据导出。无DDL／迁移／依赖／真实接入／外部部署。真实同比、服务变更／缺数界面、正式来源／调度／持久化发布和11万站容量验证待办；退服P2、费用预留和正式I09/I11/I12出口状态不变。

## 首页默认不选站址（2026-11-02）

用户要求页面打开不默认选中站址。workbench-store初始selectedId改为null，URL无有效site时明确清空选择，服务端初始页面不再生成／传递SX-DEMO-001详情。首页只展示区域态势，不自动请求单站数据或回写site参数；显式site链接与手动选点／场景仍保留定位能力。已有带site的旧链接仍恢复该站，查看默认入口应使用/product-preview?hour=18。

双层类型检查、生产构建、9项现有store测试通过；无site／指定城市／非法site均无单站请求或面板，显式链接及手动场景选择通过，JS错误0。63333已加载最新生产构建，exec session88149。无DB／DDL／依赖或外部部署变更。

## 进展检查与下一阶段排序（2026-11-02）

用户本轮要求检查工作进展与下一步规划，未要求开始新功能。核对backlog／实施记录／部署准备及测试日志，本地health=ok、默认preview HTTP200。最近完整回归365单测／18HTTP，首页默认不选站随后通过9项store／类型／构建／浏览器；本轮只做状态核验，不称重跑完整测试。

修正30-product-backlog顶部过时的多边形待办和仅日报状态，新增当前汇总与后续工作包：1单站周期HTML报告／波动证据导出，2地图到报告的演示体验实查收尾，3六场景验收与可追踪版本固化，4授权来源／平台注册／首连接器真实闭环，5正式调度发布／Beta／容量安全恢复／生产试点。更新50-deployment/20-release-plan开头旧状态，保留历史阶段记录。

真实D05/I06、I05联调、I07/I08完整出口、I09/I11/I12及R/V正式条件仍未完成；演示1080站不代表11万容量验证。费用预留／退服P2／不加外省演示继续有效。本轮不启动新功能、不部署、不迁移、不自动提交仓库。

## 五项持续交付第一轮（2026-11-02）

用户授权持续完成五项任务，休息期间只在实际上线或必要阻塞通知。已create_goal（active，无token预算）并建立当前线程每小时heartbeat automationId=bs-moss，勿重复创建。Prompt读backlog／memory继续独立工作，无变化保持安静。

第1项完成：单站日／周／月HTML报告与全部波动证据，270-station-period-report.md。station-report-rules/html/display及period/report API；引用绑定范围／模板／分析，面板和JSON／HTML一致。全线索不受前8条限制，全部小时三指标参考日期／四原值／精确分子，offline无脚本网络、证据默认展开可打印，demo/draft不变。

第2项完成本轮实查：report排行pick继承同周期进入business，returnToReport返回同范围同周期（章节回概览）；stationPeriods为store内双面板独立状态，换站回snapshot，改范围清旧返回。单站503重试原请求，不跳样板站／重置地域运营商。新增detailRevision。无默认站址保持。内部日期／指标焦点仍本地，站址重载会重置，未承诺URL恢复。

第3项完成本轮本地验收：scripts/demo-acceptance.mjs六场景×日周月18报告和1440／390真实触屏配置／1024×6场景，默认不选站／下载／无水平溢出／零JS错误通过。屏蔽HTTPS地图请求，非在线瓦片网络验收。额外station-report-browser／station-period-browser／retry确认offline／print／双面板／旧响应与失败恢复。证据artifacts/demo-acceptance。scripts/demo-release.mjs依据源码哈希、Next BUILD_ID和回归证据固化可恢复本地source快照；最终manifest为artifacts/demo-release/manifest.json。无Git提交，gitSha=null，不冒充镜像digest。

第4项未真实接入：gh只读核验vxture/vxture-bsmoss公开且size=0，仓库变量／密钥和environments均0；本地只有示例，无实际app／stack文件或授权来源协议／样例。已通过异步问题请求真实来源协议字段／映射和部署目标域名平台注册路径，未收到答复；不要重复追问或索要聊天明文密钥。最小输入及前置见50-deployment/40-live-prerequisites.md。D05/I06与I05真实联调未完成。

第5项部分独立进展：release-preflight.mjs只读检查本机／GitHub，实际结果prerequisites_missing；无本机LinuxDocker仅advisory，不妨碍未来GitHub／远端构建。I09新增refresh-planning纯核心，72h闭合自然窗口、旧新历史修订／累计相邻区间、半开边界、10000上限及先归并去重；设计170／实施290。无任务表／租约／worker／outbox消费者，不计I09完成。需继续I08可信依赖派生／组合完成证明／瞬时状态存储，随后持久调度与I11/I12；外部资料缺少不妨碍内部设计／纯规则推进。

本轮374单测／19HTTP、双层类型／最终production build通过；59篇文档编号／交付／SCA配置／30表静态镜像通过。源码ASCII／最终快照密钥扫描结果以本轮收尾输出为准。未重跑DB／在线漏洞扫描，无DDL／依赖／迁移／真实接入／Beta／生产部署。发现tmp和根客户PDF未排除，Git和Docker ignore已补，delivery守卫检查；本机原文件保留，无代码推送。

63333最终build预览当前session26177（收尾会按manifest版本重启，取后续session），最终health版本与manifest引用见执行输出。后续先看必要资料回复，再推进上述I08/I09内部代码，不重复1—3功能。不以演示上线替代正式生产上线，不自动代签业务或生产审批；费用预留／退服P2／陕西范围不变。

## I08可信依赖输入第二轮（2026-11-02）

上一goal turn分类为progress（1—3交付、回补纯核心与实际前置核验），本轮继续推进内部真实聚合入口，没有用户资料回复，勿重复追问。release-preflight再次只读检查为prerequisites_missing；真实来源／环境／平台注册及人工验收未到位，但内部工作仍可推进，不满足blocked条件。

新增aggregation/input-policy纯规则与3项测试，PgAggregateSnapshotReader支持字典依赖的总流量和次数接通率。由已核验目标能力策略选择direct/dependencies，请求不能指定；目标和两个依赖同时验权。依赖均唯一active、核验引用／direct策略／相同原生粒度，DB定义与字典一致。同一REPEATABLE READ读取，原始metric版本保留为number（PG numeric读回string需转换），总输入上限100000。依赖能力ID／策略／有效期／核验引用参与权威摘要。直接模式旧权威字段保持，目标完整快照确认可绑定两依赖，多映射仍不能用单段确认。

新增6项实际DB子项：>53位方向总量／持久复算与重放、依赖授权／能力拒绝、完成确认因依赖权威／质量改变失效、修订移窗撤回旧值／历史保留、直接比率与依赖次数互斥／分子分母合并、跨依赖一致快照与并发修订。377单测、62项PostgreSQL报告测试（61子项＋父项）、双层类型／production build通过；最终HTTP19与文档／交付／SCA配置／镜像／源码扫描见本轮收尾输出。设计180／实施300，spec和README／workplan入口已更新。无DDL／依赖或业务页面变化。

本机PG二进制在LOCALAPPDATA/Temp/bsmoss-pg-contract/package/native/bin；aggregate-data专用cluster端口58874、127.0.0.1，trust本机postgres。运行TEST_DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:58874/postgres执行pnpm test:db；每次只建删随机bsmoss_contract_*库，适配器SET ROLE为bsmoss_svc。cluster本轮已用pg_ctl stop停止，无现存业务库操作。日志tmp/dependency-{unit,db,types,build,http,preflight}.log均忽略。

本轮固化本地初始feature分支代码基线，含既有产品代码与本次依赖入口；先按受控路径暂存并密钥扫描，提交状态／SHA以git log为准。仅本机Git，没有push／PR／远端CI或部署，公开远端仍空。根客户PDF、tmp、私有env、artifacts保持排除。旧artifacts/demo-release/bsmoss-demo-f606ca9cd299646f仍是此前可恢复演示快照，新内部代码不能冒充那个快照。

下一工作包：I08组合完成证明（需明确证据集合与撤销，不滥用单映射账本）、瞬时／状态结果持久化与跨对象权威汇总；I09持久任务／租约／outbox与修订传播，之后I11/I12正式授权查询与发布。用户真实资料到位后按第4项接入，不继续扩展退服／费用或外省演示；不把单测或本地构建称上线。

收尾补充：本地初始提交ff2d30f（feat: establish bsmoss product baseline and trusted derived inputs）成功，330文件，工作区当时clean，Git hook staged gitleaks扫描3.31MB无泄漏；61篇文档编号／30表静态镜像／交付／SCA配置通过，最终19HTTP通过。本轮377单测／62DB／类型／构建通过，不重跑无改动的六场景浏览器。外部状态仍无来源与环境资料；本地commit不能计为远端提交／CI／上线。预览将以最后文档提交SHA作为运行health的gitSha，当前会话句柄以工具输出为准。

## I08组合完成证明第三轮（2026-11-02）

本轮继续五项任务，外部输入仍未回复，未重复追问；预检仍prerequisites_missing（app／stack配置、远端提交、build／beta／prod环境缺少）。本轮有内部实质进展，不标blocked。

设计190／实施310：新增source_completion_set全对象周期账本，workspace／source／station／service／network_object／device／metric／grain／period最高修订流；NULLS NOT DISTINCT防空分量重复，31表空库baseline／Prisma镜像一致，运行角色只读。完成证明绑定完整输入指纹与按窗映射清单摘要，多映射纯核心也不能用没有mappingSet的单段证明。Pg读取先取最高对象记录再比摘要，失效／撤销不回退旧组合或单段；仅无对象记录时兼容单映射旧账本。组合证明覆盖依赖目标两个原值；缺数／待核验即使有匹配确认仍partial，质量／事实／映射修订使旧确认失效。无自动签认API和来源证明写权。

新增3纯规则测试，并更新旧映射规则测试为显式组合证据；新增6项真实PG子测试：快照中并发确认、组合持久复算、最高撤销／失效、事实质量权威变化、对象时间来源等隔离、NULL唯一及并发、只读权限和跨映射双依赖。380单测／68项PG报告测试（67子项＋父项）、双层类型／生产构建／Prisma validate通过；63篇文档编号／31表静态镜像／交付／SCA配置通过。HTTP／最终密钥与ASCII扫描以本轮收尾记录为准。日志tmp/composite-{unit,db,types,build,prisma,preflight}.log。

没有新UI，不重跑无变更的六场景浏览器；无依赖／旧库迁移／真实来源／远端推送／Beta／生产部署。组合证明内部完成，I08仍缺瞬时状态持久化和跨对象权威汇总。I09窗口核心之后下一包为持久队列／租约／重试／worker与修订传播（尚未实现）；I11/I12正式查询发布待办。最终本地提交／检查点／预览句柄见工具与后续记录，旧演示快照不代表当前全部源码。

本包收尾：组合证明提交fae1e04，最终19HTTP、9文件ASCII和staged gitleaks扫描28.93KB无泄漏；没有重做不变的演示浏览器验收。

## I09持久队列与原子单步执行（2026-11-02，覆盖上条队列待办）

继续完成内部任务，没有等待外部回复停工。新增refresh-jobs纯身份／边界、pg-refresh-jobs有界三元组队列、refresh-execution授权单步执行；设计195／实施320。入队键按租户／来源／稳定对象／指标／自然窗口／triggerRef，映射anchor不影响同对象重放。任务与attempt回执两表，当前33表空库基线／Prisma镜像；仅状态／租约列可变，身份／目标／上限不可变，回执追加。

SKIP LOCKED并发抢占，新token＋attempt，数据库clock_timestamp在锁后验有效期；5—900秒租约、默认5最多8次、指数延后与dead，过期接管留expired回执，旧token拒绝。每次execute重新解析data面平台／产品权限与有限范围，再读可信快照及当前head。PgAggregateStore可选绑定租约，结果修订／head／outbox／成功回执／任务succeeded同事务；重复结果也原子ack。回执失败整体回滚，失去租约和expected-head冲突不确认任务；下一次执行重新读最新事实。没有自动来源完成签认。

384单测（新增4项纯规则）、78项真实PG报告测试（77子项＋父项，新增10个队列／执行子项）、19HTTP、双层类型／最终生产构建／Prisma validate通过；65篇编号文档／33表静态镜像／交付／SCA配置守卫通过。包括并发去重抢占、作用域隔离、延后／dead、适配器重建接管、锁等待后过期、原子结果回执、失败回滚和并发修订CAS不覆盖新结果。日志tmp/queue-{unit,db,types,build,http,prisma,guards}.log。PG专用cluster已stop，下一次测试前按前文启动；没有业务数据库操作。

I09仍in_progress：没有生产机器身份、授权队列枚举入队服务、常驻循环／续租协调、日历扫描游标、输入事务outbox／消费确认、旧新作用域与依赖修订端到端传播。计划窗口与队列尚未由上述可信协调层连接；不能称正式scheduler完成。下一步可先补授权任务协调及持久修订传播，或回到I08瞬时／状态持久化；之后I11/I12。实际来源／平台注册／环境／容量安全恢复／UAT与生产批准继续缺少，用户未回复，不重复追问、不标blocked（仍有内部工作）。

本包无UI变化，不重跑六场景；无依赖／旧库迁移／真实接入／远端push／部署。stage限定本批源码与编号文档，最终提交／ASCII／密钥扫描／检查点与63333生产预览句柄以工具及后续记录为准。小时heartbeat automationId=bs-moss继续使用，勿重复创建；目标仍active，只实际生产试点可用才通知上线。

上一包收尾：614569c提交成功，10个文件ASCII与staged gitleaks扫描50.43KB无泄漏。检查点artifacts/formal-checkpoints/durable-refresh-jobs.json绑定Git树、BUILD_ID、日志摘要与health；当时63333为bsmoss-local-614569c，exec session72489，后续新构建以工具结果为准。

## I09授权协调与快照一致性（2026-11-02）

上一goal turn为progress（组合证明及持久队列实际交付并提交），本轮仍有内部实质进展，不标blocked。没有真实资料回复，未重复追问。只读preflight 2026-11-02T14:42:29Z仍prerequisites_missing：app_env／stack_env、remote_commits、build／beta／prod环境。实际来源／平台注册资料、真实部署／人工验收未到位，目标保持active。

新增refresh-coordination纯批次规则、refresh-enqueue授权全批入队、refresh-supervision当前授权候选领取／单步失败分类、subjects稳定对象编码，见设计196／实施330。批次最多64目标，服务器可信时钟按小时产生可重放闭合自然周期扫描引用；内部可信旧／新impact保留历史窗口，不限72小时。所有目标先按当前data面平台／产品权限读取可信快照，单REPEATABLE READ事务入队，第二项写入失败／授权过期全批回滚；同对象不同anchor解析后合并，批次重放ID／摘要一致。尚无登记种子／分区枚举、持久scan消费进度或常驻进程。

BUG-001 P1内部缺陷已实证修复：旧代码先读事实后单独读到新head，会将新结果110覆盖为旧100；新PG回归先失败，日志tmp/refresh-race-before.log保留。PgSnapshot和PgStore现支持外层绑定事务，execute的事实／能力／质量／完成证明／head／结果／outbox／回执在同一RR事务；并发更新head触发40001／冲突整体回滚，任务不确认，重试复用110。手工内部expected-head门面不因本次变化声称成为正式scheduler。

领取、执行、失败登记分别重查当前权限。就绪候选SQL按workspace／source／metric／station／service／device限定，再比较实际映射主体，队列抢占同时限定这次核验的ID与三元组；防同tuple另一条任务借用未核验anchor。失败仅存受限分类代码，退避／dead沿已有队列；撤权后不写结果或失败回执，租约等待合法接管。没有伪造机器身份或新增来源完成签认。

388单测（新增4项）、87项实际PG报告测试（86子项＋父项，新增9项）、19HTTP、双层类型／最终生产构建通过；67篇文档编号／33表静态镜像／交付／SCA配置守卫通过。PG适配器仍SET ROLE bsmoss_svc，随机bsmoss_contract库已删除，专用cluster已stop。日志tmp/coordinator-{unit,db,types,build,http,guards,preflight}.log。无DDL／依赖／UI变动，未重跑不变六场景浏览器／Prisma CLI／在线漏洞扫描。最终密钥／ASCII／Git提交及63333预览句柄以工具及后续记录为准。

下一步：I09输入事务outbox、从持久证据解析旧／新对象与依赖影响及消费进度；或先补I08状态／瞬时结果持久化与跨对象权威汇总以支撑I11/I12。当前impact调用者输入仅内部可信契约，不等于自动修订传播完成。真实机器身份、常驻scheduler／worker和环境仍未启用。五项1—3本地完成，4仍缺真实来源／平台注册，5仍缺上述内部出口、正式查询发布、Beta、11万容量／3倍突发、安全恢复／UAT和生产批准。未push、没有PR／远端CI／Beta／生产上线，不重复创建自动化。
