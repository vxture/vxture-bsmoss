# T03：资源底数迁移

日期：2026-11-10。依据[PRD120](../20-specs/120-tower-service-page-prd.md)及[八批计划70](../70-workplan/70-tower-service-migration-batches.md)。状态：本地验收完成（3/8）；本批为T03，不启动T04，不延续旧阶段4或历史P批次。

## 页面与交互

`/tower-service/resources`改为站址设施、租户共享、区域分布三个页签。使用原DS15及通用分析布局、操作行、搜索、选择器、进度条、表格、卡片、侧栏和分页；无新增CSS、tokens、组件原语或依赖。

- 站址设施：同版物理设施按塔体、供电、储能、计量、环境分列，客户自有无线设备分开。类型、场景、设施子类及实时／回车搜索只影响明细，不改变全局概况和区域合计。整行开侧栏，名称进入`/tower-service/resources/[id]`同快照详情；返回保留版本、A/B、区域、运营商及局部条件／页码。旧站址档案明确为旧版入口，不冒充同版来源。
- 租户共享：读取选定资源版本绑定的月度修订；具体客户去重、锚定是／否／未知，分布为0／1／2／3／4／5+户，有源时可筛选和分页。当前来源未接，不用品牌数补造客户数、共享率或锚定档位，不列全量“缺失异常”。原品牌共享仍可按旧入口查看。
- 区域分布：省→市→演示县及返回上级；切换站址、设施子类、共享率，按行政编码或指标值排序。数量与同版全局范围核对，未知地域单列，不补造未有来源地区的零值。共享率缺源显示待接入，不画零进度条。

站址概况保留1,080站／5,400项铁塔设施，客户自有设备3,902项；五类铁塔设施各1,080项。西安240站／1,200项；其他品牌关联全省120站／600项。运营商品牌筛选选择关联站址，其设施仍按整站计数，非客户独占配置。

## 不可变来源、月度事实与权限

新捕获在资源载荷内冻结类型、场景、地址和资产编码；已有文件中的旧版本不回填当前资料。读模型只从所选不可变载荷聚合，列表不再携带每站完整graph；仅当前页侧栏和单站详情获得对应证据。区域和共享页不输出整套站址图谱。未改变T02版本身份、业务截止、来源／映射版本和原历史。

`domains/tower-service/tenancy.ts`建立可选月度载荷：月份、修订、来源、基准时点、上版引用、逐站完整性、具体客户、运营商品牌、有效期、锚定三态及原始证据引用。资源版本显式绑定月度修订，不静默取最新；客户多个服务只算一户，“其他”多个客户实体分别计数。有效期按半开区间；未知有效期、客户事实冲突或可见租户集合不完整时不计算全量共享指标。显式完整空集合才是0户，缺站／缺源不是零。

共享率＝至少2户站址／有租户站址；平均租户＝具体客户租户数／有租户站址。分母为0时未知。运营商筛选选站址后保留该站全部已授权租户；权限只允许部分运营商时将集合标记不完整，不把所选品牌当全站租户。单站详情沿相同授权及快照边界，越界、伪造版本、重复条件和不存在站址关闭。

月度事实跟随T02原子发布和文件适配；同月旧身份不允许覆盖，引用修订与来源边界需校验，失败同步不发布半批。月度载荷单独内容寻址并校验哈希，重启保留；同步清单API只出月度引用，不暴露客户事实或资源graph。此为本地预览存储适配，无DDL、启动建表或生产数据库变更。

## 验证与运行

- 904项应用单测通过（12项新增），tmp/t03-all-tests.log；最终23项相关规则／查询回归通过，tmp/t03-focused-final.log。
- 12项新增HTTP、13项T02及66项旧页面HTTP通过，tmp/t03-http-final.log、tmp/t03-t02-http-final.log、tmp/t03-legacy-http-final.log。正式关闭无演示载荷、同版详情越界404、重复条件、三页签、整站设施口径和清单不泄露事实均验证。
- pnpm build及最终Next生产构建／类型检查通过，tmp/t03-build.log、tmp/t03-final-build.log、tmp/t03-release-build.log。最终构建后重启63333，Web PID2920；独立本地定时宿主PID21892，原计划仍未启用／60分钟。
- 实际浏览器24组检查全部通过，artifacts/t03-resource-qa/checks.json。覆盖三页签、同版区域钻取／返回、手动新捕获、原版资料缺失不回填、同一时点修订差值0、实时／回车搜索、类型筛选／重置、10条分页第二页对应图谱、整行侧栏／名称详情／返回页码、卡片及运营商范围。390／475／984／1440浅色，390／1440深色区域与共享，以及390深色单站；无页面横向溢出、最终控制台无错误记录。
- 截图：desktop-light.png、sites-390-light.png、regions-390-dark.png、sharing-pending.png、detail-mobile-dark.png、final.png。最终恢复浅色并撤销临时viewport，资源页留作交付。
- 未新增CSS、tokens、组件原语、依赖；没有DDL、生产配置／真实授权、提交、推送或部署。保留大量既有工作区改动。

验收修正：原紧凑区域行会把总数单位拆行，改用已有详细区域行布局，名称和总数在上、进度条在下；未另建样式。HTTP负例最初误将“尚未接入”要求为连续“待接入”、将SVG渐变100%误判为共享0%，修正断言后最终全部通过。

## 保留及待接入

旧`/sites`、`/customer-use`、共享、单站、报告、配置、数据和历史全部保留，不切换T08主导航。当前页面迁移与来源接入分开登记：正式客户平台及授权、正式快照存储／组织范围、月度具体租户和锚定来源仍未接通。共享档位实际协议匹配属于T05，不在T03冒称生效；广电及其他口径仍待业务确认。无实时监控、故障／SLA、工单、交付办理、金额或结算能力扩展。

下一批固定为T04服务量化迁移，未开始。


## 设备列收敛（2026-11-11）

按用户意见，站址设施表将塔体、供电、储能、计量、环境五列合为“铁塔设备”总数，客户自有设备列统一为“客户设备”。两列共用官方 Tooltip，数字悬停或键盘聚焦展示设备名称和编码，每设备单独一行；零设备提示暂无设备。继续使用所选快照内的设备归属，不改变模型、过滤、汇总、卡片及明细口径。

类型检查及生产构建通过 tmp/resource-device-columns-types.log、tmp/resource-device-columns-build.log。浏览器实核八列表头、首行铁塔5／客户4与各自清单一致，提示框逐行展示，843与475页面无横溢。证据 artifacts/resource-device-columns-qa。


## 设施类型图标（2026-11-11）

设施构成五项分别使用现有 Phosphor 的 CellTower、Lightning、BatteryVerticalFull、Gauge、Thermometer，对应塔体、供电、储能、计量、环境。复用 site-analysis-distribution-icon，尺寸、主题色及间距不另建样式。仅变更展示映射，不影响设备数量和占比。验证证据 artifacts/resource-facility-icons-qa，生产构建日志 tmp/resource-facility-icons-build.log。


## 资源底数三个二级页面（2026-11-11）

本次为 T01–T08 完工后的用户授权细化，不增加迁移批次。入口默认资源构成，模型默认仍保留 sites 兼容已有消费者。主视图资源构成／区域分布／站址明细；租户共享辅助入口标记待迁移，已有实现、月度事实和旧链接保留。

资源构成分列铁塔设施与客户设备，使用配置化运营商标识、共享分布行、数量和占比；客户类别通过官方 Tooltip 展示。区域视图复用本地行政边界和投影，蓝色铁塔／绿色客户设备同尺度条形图，地市、区县及单站路径保持快照与对比上下文。已知零与无记录区分；未归属单列，不允许构造未知区域查询。

baseline-model 按物理设备 ID 去重，补充客户总数、归属构成、类别、区域合计及冻结版本差值；运营商过滤客户设备，不把全站铁塔设施改算为客户专属配置。表格局部筛选只影响明细。侧栏和移动卡片均补齐客户设备，表格继续八列与设备清单提示。

复用官方 PanelCard、SegmentedControl、Progress、Tooltip、DataTable 和页面容器；新增资源业务组合样式 resources.css。共享工作区新增可选 fillViewport，只有此资源视图启用，桌面内部滚动、固定操作／分页行，窄屏自然布局；不新增组件原语、依赖、主题 token 或全局覆盖。

验证：19项模型测试通过（tmp/resource-perspectives-model-final.log），12项最终HTTP通过（tmp/resource-perspectives-delivery-http.log）。完整 pnpm build 通过，最后表格样式修正后 Next 生产构建及类型检查再次通过（tmp/resource-perspectives-delivery-build.log）。浏览器13组观察见 artifacts/resource-perspectives-qa/checks.json；覆盖省市县数量对应、地图指标、下钻与返回、站址查询重置、侧栏与单站、390／475／843／984／1440响应布局及深色区域页。843表格最小宽度1024，长表内部滚动、分页可见、无页面横溢；构成两列逐行 y／高度一致。最终截图 final.png 为默认475宽度，regions-984-dark.png 为区域全屏效果；composition-1440.png捕获时为裁切图，不作整页验收依据。

服务已恢复63333，Web PID2172；既有worker PID25668保留。最终恢复浅色、撤销viewport覆盖、资源构成页留作交付。当前原资源快照 local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba 保留，1080站／5400铁塔／3902客户；来源仍为本地演示，未虚构月度租户或客户服务。旧功能／历史、无关改动保留；无DDL、部署、提交或推送。

## 标题与操作栏收敛（2026-11-11）

按用户三条批注，资源构成／区域分布／站址明细切换移入标题 secondary 槽。快照、运营商、区域、对比和三个统计数字合为一行；资源页紧凑快照触发器显示月日时分，选项仍保留完整日期及版本标识，页头常显完整数据截至时间。统计数字保留标签与单位，省略重复图标。窄屏仅操作栏内部横向滚动，不挤压内容或造成页面横溢。

页底统计口径改为标题区 info 图标，通过官方 Drawer 右侧展开；来源状态、对比说明、月度租户口径、版本引用及“租户共享 待迁移”入口保留。共享工作区新增可选 headingSecondary、headingActions、notesInDrawer 与 workspaceClassName，其他页面保持原有默认展示；统计组件和快照选择器的紧凑属性同样为可选。只调整展示，不改变查询和数据聚合。

最终生产构建与类型检查通过 tmp/resource-compact-delivery-build.log，12项HTTP通过 tmp/resource-compact-delivery-http.log。浏览器在843宽操作栏746/746无滚动，内容起点约250（原326），面板高589（原471），释放约118px内容高度。验证三区切换、明细页固定分页、运营商其他120站／铁塔600／客户120及恢复全部、说明侧栏开关；390与475窄屏内部滚动且文档无横溢，恢复默认1280视口。证据 artifacts/resource-compact-qa/checks.json、final-843.png、notes-843.png、final-475.png。

全局全屏按钮使用官方 ShellFullscreenToggle，位于主题后第二位；IAB没有原生requestFullscreen API，仅验证进入／退出按钮状态，普通浏览器原生全屏尚未实测。Web63333 PID15768，worker25668未改动；原始资源快照及历史完整保留。T01–T08仍为8/8，本次不另增批次。

## 区域分布纵向柱图与全量适配（2026-11-11）

按用户澄清，横轴排列行政区划、柱子纵向立起。资源底数区域视图改为单张满宽图卡，移除本视图地图；站网全景不受影响。保留市级／县级和对比／铁塔／运营商三视图：对比并列两类设备，铁塔按设施类别堆叠，运营商按归属堆叠，身份标识继续使用系统配置。已有 ECharts SVG 渲染支持业务多序列，不新增依赖或基础组件，字体、颜色、间距和网格线读取共用样式。

所有区划保留数据柱，不截断、不分页、不使用 dataZoom 或最小图宽；尺寸变化时自适应柱宽、间距和横轴标签密度。密集标签抽样避让，悬停显示完整区划、站址数和各系列数字；堆叠显示合计。图区横纵均不滚动；窄屏整页维持自然文档流。支持市到县下钻、返回上级和同快照站址明细；键盘左右／Home／End选区划，Enter下钻，Shift+Enter打开明细。新 regionLevel、resourceView 局部参数严格验证，不改变设备归属与快照口径。

22项模型测试通过，覆盖两级三视图、运营商过滤和汇总一致；类型检查及最终生产构建通过 tmp/resource-columns-delivery-build.log。HTTP验证日志 tmp/resource-columns-final-http.log。浏览器11项观察见 artifacts/resource-columns-qa/checks.json：全省98县196根对比柱全部绘制，西安市13县下钻正确；390／475／843图幅无内部溢出，843桌面工作区不滚动。检查两主题、配置化运营商、柱／标签点击、键盘和同版明细，控制台错误为空。最终截图 final-843.png，深色密集县级截图 counties-390-dark.png。

原快照1080站／5400铁塔设备／3902客户设备和历史均保留。Web63333 PID28280，worker25668未动；T01–T08仍为8/8，无新增批次、DDL、提交、推送或部署。

## 区域分组柱与配色收敛（2026-11-11）

按用户最新批注，铁塔／运营商均改为区划内多系列并列柱，不再堆叠；区域交互止于市、县两级。点击市名或柱子进入该市县级分布，县级点击、Enter及Shift+Enter均不再打开站址明细；原独立站址明细二级页面保留。Tooltip继续展示同一区划各分项、站址数和设备合计。

用户确认保留分项悬停高亮。实测发现 ECharts 的状态颜色计算不支持部分现代 CSS 颜色，导致高亮时部分柱子缺失；将从设计系统读取的系列颜色通过浏览器颜色解析转换为RGBA，再交给图表，保留原有focus交互。配色改为铁塔蓝色系、运营商青绿色系，对比保持蓝绿；色阶由共用primary／success和主题surface／foreground混合，深色主题提高色阶明度，无新增全局token覆盖或依赖。

生产构建含类型检查通过 tmp/resource-grouped-build.log；12项HTTP通过 tmp/resource-grouped-http.log，补充县级不含站址跳转说明及分组文案检查。浏览器证据 artifacts/resource-grouped-qa：843市级铁塔／运营商各50柱，西安13县65柱；县级鼠标点击和键盘确认均停留原区域，市级柱子下钻正确。390全省98县五系列全量显示，无图区滚动或页面横溢；零值柱无可见高度。颜色和高亮经两主题验证。原资源快照和所有旧页面、数据保留；T01–T08仍为8/8，此为精修。

## 区域图八项精修（2026-11-11，替代上轮配色与全县模式）

按用户八条批注，采用DS分类图表色 chart-1至chart-6，铁塔和运营商共用分类色序列，移除渐变和语气色映射。现有RGBA转换保留，保证图表高亮计算支持主题颜色。图例复用官方ToggleGroup／ToggleGroupItem多选，点击隐藏或恢复系列，隐藏状态划线并弱化；全部关闭仍可从图例恢复，提示显示“点击图例显示分项”。显隐不修改设备总量或排名。

区域选择改为“全部市级／前10县／后10县”；按市下钻后第一项为“全部区县”。排名按当前维度设备总量降序或升序取10县，行政编码处理并列，限定当前全局范围，未知归属不列入县排名；chartRegions仅为展示集合，regions和resourceTotals保留全范围。旧regionLevel仍验证但实际层级由归属和排名确定；旧compare视图兼容映射到tower，主控件删除“对比”，全局A/B快照对比保留。市县两级交互不变，县级不跳站址明细。

共享SnapshotControls新增可选showRegion（默认true），仅资源页false，保留Header区域入口。资源概况增加站址标签，三组之间分隔线；仅资源CSS局部作用。返回按钮使用md档，与分段控件同control-md（实测24px）。悬停tooltip依当前seriesKey高亮该行、600字重和中性背景；其他行400字重；Tooltip使用卡片表面保证标题和数字对比度，不把分类色作为整段正文色。

9项模型测试通过 tmp/resource-refinements-model.log，包括省／市排名、数量限制、排序、少于10县、全范围合计、非法及重复参数；最终生产构建含类型通过 tmp/resource-refinements-build.log；12项HTTP通过 tmp/resource-refinements-http.log。浏览器实测图例50→40柱、全部关闭／恢复、宝鸡12县、前后10县排序、省级排名、两维度一致配色、只有一个Header区域选择、三组概况分隔、390图例换行及277×336无图区滚动、两主题、tooltip关注行600／其余400，控制台错误为空。证据 artifacts/resource-refinements-qa，final-843.png为省级全市最终效果，tooltip-843.png／operators-top10-843.png／top10-390-dark.png补充交互与响应式。

交付恢复浅色、默认视口、宝鸡市铁塔全部区县。Web63333 PID17876，worker25668未动。T01–T08仍8/8；原快照／报告历史／旧页面／无关改动保留，无DDL、提交、推送、部署。

## 标题导航、快照与设备单位精修（2026-11-11）

标题右上方为完整数据截至时间及问号帮助入口，复用原说明抽屉；右下方为资源构成、区域分布、站址明细三个独立DS按钮链接，带当前页标识。共享工作区仅增加可选notesInHeadingContext，其他页面行为保持。资源SnapshotControls启用可选snapshotOnly，操作行仅快照选择及前后按钮，删除本页运营商、区域和对比选择器。前后按实际存量时点、同点修订同步／发布时间、版本标识排序，边界禁用；保留区域和页面，清空对比、重置分页。不构造时日周月累计、不新增同步事实，原版本对比及旧查询兼容保留。

范围概况铁塔和客户的单位改为“设备”，保留分隔线，显示“站址 140 站｜铁塔 700 设备｜客户 507 设备”。本轮未改图表计量口径。

5项查询测试通过（排序、修订、边界和查询约束），类型检查及生产构建通过tmp/resource-header-types.log、tmp/resource-header-build.log；13项HTTP通过tmp/resource-header-http.log，包含导航上下文、设备单位和原比较能力。浏览器证据artifacts/resource-header-qa：843时间与帮助同一行y80，独立导航y113.29；390自然换行，页面390/390无横溢，操作行内部横滚342/521。三页面导航、帮助抽屉、实际前后修订切换并恢复原快照、最新版本下一按钮禁用均确认。服务量化仍有原运营商及对比选择器，控制台错误为空。final-843.png为完整最终效果；mobile-390.png、help-843.png及checks.json补充验证。

恢复默认视口、浅色、宝鸡铁塔全部区县，tab5交付。Web63333重启PID512，worker25668未动。T01–T08仍8/8，原快照和历史保留，无新增批次、DDL、提交、推送或部署。

## 时间控件方形尺寸修正（2026-11-11）

前轮选用icon-md（宽24px），共用筛选行将高度统一至control-xl（32px），导致前后按钮成为24×32。改用原AnalysisPeriodControls相同的DS icon-xl规格，实测前后按钮均32×32，日期框同高32且同y185.96；不增加局部尺寸覆盖或新控件。日期框前增加16px日历图标，沿用共用8px间距。仅资源snapshotOnly模式受影响，快照切换逻辑保持。

向用户解释存量与期间累计的差别：时日周月可用于定位周期截至时点的资源快照，不能把同一设备的连续快照相加。当前仍为实际快照选择和前后版本，未新增时日周月筛选。

生产构建及类型检查通过tmp/resource-time-controls-build.log；浏览器截图及尺寸证据artifacts/resource-time-controls-qa/final-843.png、checks.json，843页面无横溢。已恢复默认视口并保留tab5，Web63333 PID12092，worker25668未动。T01–T08仍8/8。

## 站址明细开放式布局（2026-11-11）

按用户要求，资源构成与区域分布继续使用原卡片；站址明细直接展开操作行、表格和分页。共享SiteAnalysisWorkspace增加可选openTable，仅资源明细启用；使用普通内容容器，实际移除PanelCard包裹及重复标题／描述，不以透明卡片伪装开放布局。关闭该模式的列表／卡片切换并强制展示表格，其他页面保留原两种视图。搜索、筛选、分页、行详情与名称跳转逻辑复用；桌面剩余高度给表格，分页固定在其后，窄屏取消表格固定最大高度，20条自然展开。空筛选容器不占间距，窄屏搜索和表格同x24。

最终生产构建及类型检查通过tmp/resource-open-table-final-build.log；13项既有HTTP验证通过tmp/resource-open-table-http.log，不增加布局镜像测试。浏览器证据artifacts/resource-open-table-qa/checks.json及final-1280.png、final-843.png、mobile-390.png：明细无卡片容器／视图切换，表面透明、border0、padding0、shadow none；843表格利用461px剩余高度，分页底839.33，页面无横溢；390表格1585/1585且max-height none，页面390/390；1280表格1137/1137，8列全部可见。搜索无结果、重置、第二页（行21）、整行展开设备详情均正常。资源构成2卡、区域分布1卡均确认保留。控制台错误为空，原快照和范围140/700/507保留。

交付恢复默认视口、浅色、宝鸡市站址明细第一页，tab5保留。Web63333最终PID11292，worker25668未动。T01–T08仍8/8，无新增批次、数据修改、DDL、提交、推送或部署。

## 资源分析图标与明细复合筛选（2026-11-11）

按最新批注，资源快照前缀由16px日历改为DS chart-bar分析图标，使用xl原生规格32px；快照选择及前后方形按钮仍32px同行同高。仅资源snapshotOnly模式受影响。

站址明细沿用站址管理操作行结构：左侧DS列表／卡片显示切换，右侧依次搜索、复合筛选、重置。保留开放式外层；显示切换与外层卡片容器解耦，本轮恢复显示切换，替代上一轮强制列表要求。类型、场景、设施子类集中到官方Popover／Select组合，草稿应用后生效，取消不改变查询，按钮显示已生效条件数。当前零个外放筛选，后续高频外放最多两个；未复制不适用于资源快照的运维筛选。全局范围概况不受本地明细筛选影响。

类型检查通过tmp/resource-filter-toolbar-types.log，生产构建通过tmp/resource-filter-toolbar-build.log，13项既有HTTP检查通过tmp/resource-filter-toolbar-http.log。浏览器证据artifacts/resource-filter-toolbar-qa：843操作行全部控件32px且同y257.96；无外层PanelCard；三条件ground／industrial／tower联合筛选180站，徽标3，范围概况仍1080／5400／3902；草稿不导航、清空草稿后取消并重开回显原条件、显示切换保留条件、重置恢复1080站均通过。390页面宽390无横溢，操作行342／398内部滚动，筛选面板x0／宽384／右384完整显示。控制台错误为空。截图final-843.png、filter-843.png、cards-843.png、filter-390.png及checks.json。

恢复默认视口、浅色、全省原快照、operators维度、站址明细列表第一页，保留用户现有tab4交付；其他标签未修改。Web63333 PID7800，worker25668保留；T01–T08仍8/8，无新增批次、DDL、提交、推送或部署，原快照／历史及无关改动保留。

## 资源图标指定（2026-11-11）

资源底数标题与Launcher入口统一采用Phosphor CellTowerIcon（标题48px，入口20px），标题保持原主题配色。三个主视图分析行分别采用ChartPieSliceIcon（资源构成）、CityIcon（区域分布）、MapPinAreaIcon（站址明细），均32px、text-muted-foreground中性色，替代通用蓝色chart-bar。已存在的塔体条目CellTower保持。PageHeading增加可选iconVisual，SiteAnalysisWorkspace透传headingIconVisual，SnapshotControls增加可选analysisIcon；不传时保持原组件与DOM行为，未修改DS字典或新增依赖。生产无数据资源页也采用相同CellTower。

类型检查与生产构建通过tmp/resource-celltower-types.log、tmp/resource-celltower-build.log；最终补充三视图图标后生产构建与类型检查再次通过tmp/resource-section-icons-build.log。这是图标替换，未新增镜像测试或重复业务回归。浏览器实测标题48px、入口20px、分析行32px，中性色oklch(0.556 0 0)；三个视图均核对，控制台错误为空。证据artifacts/resource-section-icons-qa/{composition.png,regions.png,sites.png,launcher.png,final.png}，已有快照与数据保持。

Web63333最终PID22800，worker25668未动；交付tab4全省原快照站址明细，未设置临时视口。T01–T08仍8/8，无DDL、提交、推送或部署。

## 站址明细改为页面滚动（2026-11-11）

按用户反馈取消站址明细表格独立纵向滚动。资源构成与区域分布仍填充剩余高度；资源明细不启用fillViewport，记录完整展开，外层既有product-workspace-content为唯一纵向滚动区域，Shell全局header保持原位。标题、二级页入口、快照概况随页面滚走；列表操作行到达内容顶部后吸顶（DS sticky层级和背景），其余内容继续自然滚动，分页留在记录末尾。保留DS宽表横向浏览，不引入复制表头、第二套滚动条或新的基础组件。列表／卡片模式均自然展开。换页或修改每页数量后，仅开放式自然布局回到记录开头（scroll-margin使用DS尺寸），其他页面默认行为保持。

生产构建及类型检查通过tmp/resource-page-scroll-build.log；13项既有HTTP检查通过tmp/resource-page-scroll-http.log。浏览器证据artifacts/resource-page-scroll-qa：843页面内容client791／scroll1979，表格client1585／scroll1585，内部DS横向容器高1569／scroll1569无纵向溢出、宽746／scroll1024；滚动871.33后header仍top0高48，标题滚走，操作行top64高48，表格scrollTop0。第二页首行21，换页后firstTop166.75、pageScroll186；每页10条后10行且首行回到同位置，最终恢复20条第一页。卡片高2177／scroll2177、overflow visible，操作行正常吸顶。实际指针点击吸顶筛选后scroll871.33保持，面板在操作行下方正常打开；locator.click自动滚到元素原始流位置属于浏览器自动化定位行为，通过实际指针确认无产品跳动。390页面无横溢，表格仍1585／1585，header top0、操作行top56，表格scrollTop0。控制台错误为空。top-843.png、scrolled-843.png、sticky-filter-843.png、scrolled-390.png及checks.json保存。

最终默认视口、浅色、全省原快照、tower、站址明细20条第一页顶部，tab4交付。Web63333 PID1564，worker25668未动；T01–T08仍8/8，无数据变更、DDL、提交、推送或部署。

## 资源二级分析行重排（2026-11-11）

按用户指定，三个主视图统一为左侧“中性32px图标＋二级标题＋资源数量”，右侧快照选择和前后按钮。标题文案复用资源二级导航数据，数量组仍为站址／铁塔／客户，保留分隔线；标题与数量24px DS间距，数量与时间自然留白。删除原整行横滚／max-content结构，时间控件不再携带图标。SnapshotControls的analysisIcon显式null表示不渲染，undefined保持原默认图标；不影响其他板块。窄屏container40rem内标题与时间先同行、数量完整另行靠左，数量使用DS小字体，极窄自然换行。三页布局及业务查询、滚动方案保持。

初次构建与类型检查通过tmp/resource-section-row-build.log；13项现有HTTP通过tmp/resource-section-row-http.log。窄屏第一次审阅发现数量折行为两行、整行高158.19，已按最终响应式方案收为88px，最终生产构建及类型检查通过tmp/resource-section-row-final-build.log。最终843单行高48，标题x48.45／数量x178.45（中间24px）／时间右边794.89，所有时间按钮高32、前后32方形且同y185.96。三个页面二级标题／图标均确认正确。390页面宽390、分析行342／scroll342无横溢，标题与时间同行，数量一行，行高88。控制台错误为空。证据artifacts/resource-section-row-qa/{final-843.png,composition-843.png,regions-843.png,regions-390.png,checks.json}。

恢复默认843视口、浅色、全省原快照、tower、站址明细20条第一页顶部，tab4交付；其他标签保留。Web63333 PID10800，worker25668未动；T01–T08仍8/8，原快照／历史及无关改动保留，无DDL、提交、推送、部署。
