# 站址管理首版实施

2026-11-03，P02，配套[设计233](../30-design/design_bsmoss_233_site-registry.md)。

## 实现

新增 domains/site-registry 纯筛选／排序／链接规则和独立合成适配器；/sites 全宽工作台支持省市县、运营商、场景、共享方式、状态、状态时段及站名／编码／地址搜索，20项分页、稳定排序与关系展开。/sites?view=relations 按站址－运营商关系展示，归属与计数不混淆。

/sites/[id] 六层业务档案：总览、资源设备、服务关系、运行状态、经营用量、资料来源。共用资源与运营商设备独立编码；时段指标和周期用量分开。日周月总量、总量／日均环比、四周同小时参考波动、运营商结构及明细复用现有规则，HTML链接直接生成该站该周期报告；不把区域报告当成单站报告。地图双面板增加统一档案入口，档案返回地图保留站址、区县和小时；返回台账保留筛选及分页。

launcher 激活站址管理和服务关系；首页快捷工作区增加入口。业务首页／大屏去除内容最大宽度，正式分析／报告仅调整布局宽高，不重写既有服务和权限。配置管理域不变。

新增 UI 使用 @vxture/design-system 官方控件、模式及语义 token。桌面全宽全高，地域与台账内部滚动、分页底部；手机摘要合为MetricListCard、台账使用ListCard，避免固定操作列遮挡站名，档案宽表自身滚动。查询在服务端验证，拒绝非陕西地域、错配县、重复／未知参数、非法枚举与小时／页码；链接不接受任意返回地址。关闭预览不加载合成资料，真实来源未接入时显示尚未开放。

## 验证

- 9项相关单测：站址／关系去重计数，复合筛选、分页与排序、空结果、设备归属、物理电耗不分摊、三周期运营商与报告对账、严格参数及返回上下文。
- 双层类型检查、生产构建与26项门户HTTP检查；后者包含关闭预览无合成档案、六层路由／站址不存在、无效地域／重复参数和正式API仍拒绝匿名访问。
- 浏览器1440、787、390宽：全屏边界、地市区县、检索、关系下钻／档案返回、六层内容、日周月／经营指标、实际单站HTML下载、地图双向链接、分页／排序及空态。证据在 artifacts/site-registry-qa；最终检查事实和截图以该目录及工具输出为准。
- 编号文档、源文件ASCII、diff与密钥扫描。没有DDL／Prisma／依赖变化，未重复无关PG合同测试。

## 首轮布局批注修正（2026-11-03）

移除/sites中重复ViewHeader标题和演示标签，域名称由公共header统一承载：桌面16px heading-2／正文前景色／半粗体，手机14px保留当前业务识别；品牌字号不变。地域日期与地图入口合为主区紧凑工具行。地域树区县从sm按钮改为官方xl按钮（20px→32px行高），正文12px→14px；加入左缩进导线及aria-pressed选中态。

最终生产构建含类型检查、26项门户HTTP及140篇编号检查通过；两处源码ASCII与diff检查通过。1042×871实际表格顶部487.06→412.44，增加约74.6px可用高度；区县14px／32px符合设计。787与390无页面横向溢出，手机域名14px完整显示；县选择联动、地图范围链接及配置域顶栏兼容通过，浏览器warn/error为空。截图和实测在artifacts/site-layout-qa，日志tmp/site-layout-{build,http,docs}.log。纯布局未重复业务单测／数据库；未外部部署。

## 资源概况按需展开（2026-11-03）

用户要求统计区无需常驻。使用官方Collapsible／Trigger／Content，默认关闭，入口合入地域日期与地图工具行；展开统一使用MetricListCard替代桌面四张大卡。四项名称保持完整，单位跟随数值，手机地图改为带名称的图标入口；没有新增布局原语、数据口径或持久偏好。查询重新挂载时回到默认收起，用户可再展开查看当前范围数字。

生产构建含类型、26HTTP、140篇编号、源文件ASCII及diff通过，日志tmp/site-summary-{build,http,docs}.log。CUA1042×871表格顶部412.44→258.09，默认增加154.34px列表高度；787、390无横溢。默认统计区卸载、鼠标／Enter／Space开合、西安240站／864关系与全省1080站／3902关系一致，手机名称和单位可读，浏览器warn/error空。artifacts/site-summary-qa包含收起／展开桌面及手机截图、checks.json；viewport已恢复、临时tab37关闭。纯展示未重复业务单测／PG，未外部部署。

## 顶栏字号与列表工具行整理（2026-11-03）

系统名称由18px品牌字体改为16px heading-2，与功能域同字号与字重，保留品牌20px。/sites以语义token布局组装一行视图切换／检索／运营商／筛选／重置；底部分页保留结果数，移除顶部重复计数及建设主体说明。小时移至地域日期旁。新增业务组件SiteFilters，使用官方Popover、Label、NativeSelect和Button，五项单选条件草稿一次应用，城市变更重置县，取消后再打开还原已生效值；重置保持原有全量查询默认。手机三行自然布局，概况和地图为图标入口，日期完整显示。

最终生产build含类型、26HTTP、140文档编号、四源码ASCII及diff通过；tmp/site-toolbar-{build,http,docs}.log。CUA1042×871工具行高24.23px，列表顶部258.09→152.23，额外增加约106px。系统／业务及配置域名称实测均16px；787与390无横溢，手机日期宽与scrollWidth均113px。组合单选应用、取消草稿恢复、换市清县、清空、检索／重置、小时／运营商／关系视图保留与地图链接通过；手机一次应用city/county/scene保留operator/view/hour。artifacts/site-toolbar-qa截图及checks.json，浏览器warn/error空；viewport reset、tab38关闭。类型检查曾拦截未收录的重置图标名，改用官方refresh；无权限／数据规则／DDL／依赖变化，不重复业务单测或PG。

## 后续

P02正式版仍需真实站址主档、权属与验收资料、设备来源、服务关系有效期／受审修订、维护导入与变更审计。当前档案和设备清单均为显式演示模型，没有真实变更、巡检或审批记录；不显示可伪造成功的新建／编辑／导入动作。费用仅预留、退役影响P2；不涉及旧库迁移。平台、来源、Beta、容量恢复、客户UAT与生产批准依赖不因本批完成而解除；本地预览不等于外部部署上线。

## 搜索、类型与刷新批注处理（2026-11-03）

使用发布版官方InputGroup及框内查询按钮，桌面224px上限；回车和点击共用form提交。SiteQuery／SiteRecord新增严格枚举siteType，地面站与楼面站派生与既有塔房资料一致，台账、关系、统计、档案和返回上下文贯通。类型外放，运营商归入筛选弹层六条件；与业务场景分开。

移除台账小时选择，数据时点只读。手动刷新重新读取服务器模型，页面层返回readAt并以北京时间显示，未把刷新时间注入纯规则或合成适配器。读取等待禁用按钮，保留查询、页码、搜索草稿与展开状态；无上游真实同步或采集成功声明。档案／地图仍可分析历史小时，旧hour链接保持兼容。手机收紧图标内距，避免数据时点被挤压。

新增类型分区、档案一致性、交集、非法类型／重复参数与上下文单测，相关共10项通过；双层类型和生产构建通过，26项门户HTTP检查通过，包含每次页面读取时间递增、源时点不变、标准搜索组件及类型有效／非法边界。最终浏览器证据见artifacts/site-controls-qa；本轮无DDL／依赖／真实来源变更，不重复无关数据库合同测试。

## 字体角色收敛（2026-11-03）

实测原台账同类主数据在12／14px间跳变，搜索和选择14px而相邻操作12px，主站名600与普通数据400差异明显。采用站址域本地排版规则：正文／表头／操作使用body／label（标准14px），主操作500；辅助编码／时间／说明及徽章12px，标题heading-2（16px），品牌和档案既有关键读数20px。档案标题18px取消；共用header原16px系统／域名称和20px品牌无需重复修改。筛选面板通过官方className接入独立作用域，表格与操作使用语义token，不修改全局token或官方包。

最终生产build含类型与26HTTP、140文档编号、ASCII／diff检查通过。CUA1042／787／390检查无页面横溢；站址表头／地域主值／负载／按钮／选择／检索为14px，编码／辅助值／时间12px；浮层Label／select／Button均14px，标题16px。单站总览／资源／经营页验证只有12／14／16／20四档，标题16px、关键数值20px。手机刷新显示HH:mm、完整秒数保留title及aria，日期client／scrollWidth均148不裁切。证据artifacts/site-typography-qa，浏览器warn/error空，viewport已reset、tab40关闭。仅排版未新增业务测试或重复PG检查，未外部部署。

## 展开关系一行与自然换行（2026-11-03）

用户批注四运营商应优先同一行，过窄时弹性布局。expandedContent取消固定断点2／3列，改flex-wrap，子项flex-basis和最小宽度使用overlay-sm token（标准160px）且等分余量。每项改纵向组织，档案按钮独立落在下方，避免横向文字与按钮互挤；保留官方Button、14／12字号、真实关系数量和下钻href。无数据或权限变更。

生产build含类型通过，140编号／ASCII／diff通过。CUA1042实测可视展开区721.3px、四项各164.8px、同top306.4且最右986位于列表右界1018内，展开高129.2px；660下3＋1自然换行且无页面横溢；五运营商1042下4＋1均可见。初轮仅flex导致继承宽表949.9px，第四卡在视窗外，改列表inline-size容器＋展开100cqw约束后通过。服务档案实际进入DEMO-00946?tab=services，当前服务页签正确。artifacts/site-relations-layout-qa含桌面／窄屏／五家截图和checks，warn/error空、viewport reset、tab41关闭。纯布局未重复业务／HTTP或数据库测试，无外部部署。

## 操作列透明与三竖点菜单（2026-11-03）

三个有rowActions的表使用官方ActionMenu，台账与关系共用业务动作生成函数，手机ListCard.actions同步。菜单分别链接站址／服务档案、运行状态、经营用量；档案运营商明细菜单保留原地图时段用量入口。所有目标复用已有上下文构造，无虚假写操作。site-action-table局部取消操作列的独立遮罩背景和sticky层，透明显示所在行底色，防止透明锁列与滚动文字叠加。

生产build含类型、140编号、ASCII／diff通过。CUA1440操作表头／单元格rgba(0,0,0,0)，hover整行accent、全部9格透明，消除独立白块；1042横滚后菜单右界1002在视窗内，390无横溢且面板右界286。台账runtime／business、关系服务档案（保留view=relations）、档案移动时段用量地图实际URL均验证；手机ListCard菜单和Enter／Escape开关通过。artifacts/site-actions-qa含桌面／中屏／手机／档案菜单截图及checks，warn/error空、viewport reset、tab42关闭。中屏首轮Escape退场未结束即点击导致菜单被合上，检查data-state后重开并等待visible通过；无产品失败。无权限／数据／DDL／依赖改变，纯展示与导航复用未重复数据库或业务测试。

## 地域面板收放与工作区底色（2026-11-03）

SiteRegistry稳定外层只管理地域面板开合；带查询key的RegistryContent继续管理搜索草稿、行展开、概况开合，页面移除外层key，避免筛选时把面板状态重置。面板保留在普通flex流中，使用lg外距／间距、官方语义描边及bg-card/68；隐藏时不占宽度，内容区和表格不绘制白底。共用header及官方主题不改。

顶部用官方Breadcrumb系列展示省市县，链接使用已有siteListHref与navigate，仅清除对应下级范围／页码，保留其余筛选和排序。收放按钮在面包屑前，支持鼠标、Enter与Space；窄屏原本不显示资源树，保留筛选弹层地域入口。县级全路径在中屏通过紧凑图标操作避免与源时点重叠；手机上下文自然分行。关系展开内距收为sm，保留四卡同行的可读阈值。

生产构建含类型检查及26项门户HTTP通过；最终浏览器、编号文档、ASCII／diff及运行身份见artifacts/site-workspace-qa与实际Git／health。没有业务规则、权限、DDL、依赖或真实接入变化，未外部部署。

补充用户行内关系批注：名称使用官方Button的asChild链接承接原服务档案href，去掉重复动作文字；下方显示小时／百分比及官方Progress。demo-store只为当前页物理站生成operatorLoads投影，使用既有siteHour(site,hour,code)，包括物理站全部运营商，不受关系列表分页或当前运营商筛选截断。新增一致性测试覆盖0／12／18时、运营商筛选与第二页、空结果，逐项对照dossierDemo，相关9项通过；最终build含类型通过。

CUA1042实测四卡各约162px、同top299.77且右界992.66位于列表内；名称点击实际进入DEMO-00037的服务关系页签并保留排序。四条进度值分别为87.2%／90.2%／93.2%／96.1%，与档案口径相同，未当作份额。1440收起后主区x24／宽1392／右1416；787与390无文档横溢。主题测试header／工作区深色层级独立、表格透明，恢复浅色。截图及最终检查在artifacts/site-workspace-qa。

## 主列表负载可视化（2026-11-03）

台账时段负载列与手机站址卡片复用loadIndicator组合，使用官方Progress，值为既有物理站used／capacity×100；数值改为12px辅助字号与muted-foreground，上置右对齐，柱条及轨道保持官方样式。不增加指标、颜色阈值或数据计算规则，原排序继续按原始比率。仅展示调整，生产构建含类型与浏览器核验，证据见artifacts/site-list-load-qa及tmp/site-list-load-build.log。

## 地域标题与统一收放图标（2026-11-03）

省级资源总数由原树首行移至标题右侧；左侧map-pin＋陕西·资源，树移除陕西省按钮，不再出现默认选中省级行。计数仍为全部地市资源总数，与筛选结果数分开。配置域官方ShellSidebarNav使用ShellIconButton的sidebar图标，本站址域复用同一组件、非active，替换单向chevron；保留aria-expanded／controls及键盘收放。基础按钮对aria-expanded=true有底色，站址局部site-region-toggle仅覆盖非hover／非focus-visible的背景为透明，保留官方交互反馈。全省范围可从既有面包屑返回。生产构建含类型及浏览器验证记录在tmp/site-region-heading-build.log与artifacts/site-region-heading-qa，未改规则或权限。

## 隐藏滚动条保留滚动（2026-11-03）

地域树增加site-region-scroll，台账原site-table-scroll与DataTable内部overflow-x-auto统一使用scrollbar-width:none和WebKit伪元素隐藏，移除旧stable gutter，保留原overflow。树和列表增加tabIndex=0／命名region及局部focus-visible轮廓，支持键盘滚动；不隐藏其他业务页滚动条，不用overflow:hidden或脚本模拟滚动。生产build与浏览器证据见tmp/site-scroll-build.log和artifacts/site-scroll-qa。

## 分页组件根因及源头修正（2026-11-04）

实测原数字页码39.1–42.5px宽／24px高，箭头24px、gap4px；源头是DS普通md按钮横向padding叠加站址14px字号。D:/MyWebSite/vxture/vxture-design的官方Pagination改数字最小control-md＋px-2xs／tabular-nums、gap-xs，增加data-slot；不修改全局Button。BSMOSS仍用design-system15.0.0／design-ui12.0.0，registry仅挂局部分页class，CSS恢复官方12px导航字与限定旧版结构的等效布局，含移除条件，未改依赖锁定或node_modules。DS变更为未发布源码修正，不能视为已发布版本。

DS18项分页／Checkbox相关回归、UI类型、UI构建／DTS、组件类名守卫及相关ESLint通过；新增三位数窗口与Enter／Space行为验证。首次测试类型把浏览器locator的exact选项带入Testing Library，类型检查拦截后移除并复查通过。产品生产build含类型通过（tmp/site-pagination-build.log），纯布局不重复数据库／业务全量测试。

CUA1042实测单数字与箭头均24px、gap8px、12px字，末页54正确禁用下一页／末页，Enter上一页到53；关系末页196显示192–196且每个32.67px宽，无文字溢出，Space到195保留view=relations。390全页scrollWidth390，分页342px内末按钮右界347.33，正常换行且完整可达；1440无横溢，首页返回正常。artifacts/site-pagination-qa保存desktop／three-digit／mobile／wide截图与checks.json。最终Git及63333health为准；不push、不发布DS包或外部部署。