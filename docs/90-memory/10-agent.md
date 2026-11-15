## Energy allocation card proportions (2026-11-13)

User requests energy composition default1/3 alongside customer allocation. energy.css now uses1:2 grid and only stacks below768px, replacing1280px breakpoint. Named container query below24rem moves composition totals/group totals to a separate right-aligned line and lets destination labels/values wrap; no calculations/data changed. Production build/typecheck passed tmp/energy-parallel-build.log, live63333 wrapperPID14468. Browser887 confirms same-top249.6px/499.2px cards with no card-content overflow,1363 full1:2 layout,390 stacked326.7px cards. Existing customer table retains minimum42rem/local horizontal scrolling at887; existing top analysis controls still cause document horizontal overflow on narrow screens, outside this card change. Proof tmp/energy-parallel-wide.png and tmp/energy-parallel-default.png. Viewport reset, user's energy/month/allprovince view retained and marked deliverable. No new tests for CSS-only change; CUA completion recorded. No DDL/history mutation, commit/push/deploy.

## Sharing occupancy breakdown (2026-11-13)

Latest follow-up: composition uses default cursor plus a dashed vertical pointer on hover/focus, retaining DS tooltips and keyboard focus outline. Removed customer whole-row click adapter and pointer cursor; customer-name and ActionMenu details remain. Trend windows now rolling12months/8quarters/3calendar-years ending at selection, with explicit displayed bounds and actual source cutoff/history start. Quarterly/yearly values remain endpoints, no stock sums or synthetic missing history. Added window/partial-year/past-selection regression;9 targeted domain/model tests passed. Production build/types passed tmp/sharing-window-build.log. Browser887 verified month2025-11--2026-10, quarter2025Q1--2026Q4, year2024--2026 and cutoff2026-10-31/history2024-11; toolbar32px/no overflow at887and1363. Default cursor confirmed for all6columns and5customer rows/cells; plain-cell click opens no drawer, customer name opens actual1080/1077/99.72% details. Mouse-selected fresh column has no outline and visible dashed pointer; keyboard retains outline/tooltip. Proof tmp/sharing-window-annual.png and tmp/sharing-window-pointer.png. Viewport reset, original monthly/province/all-operator view restored. One click immediately after viewport reset did not navigate; fresh state and normal retry succeeded. Live63333 wrapperPID26880; no source/DDL/history mutation, commit/push/deployment. CUA completion recorded.

Latest controls correction: SegmentedControl root was24px while broad consumer button CSS forced32px children, visibly cropping both period/trend switches. Scoped sharing-switch fixes root32 and restores100% child height/min0; legend32 remains. Analysis row nowrap at tablet/desktop; below80rem visible metrics are occupied/rate while shared/average remain in existing full Tooltip; above80rem show four. Below48rem row may wrap. Busy hides summary to give32px loading pill space. Six composition columns use DS Tooltip/focus and subtle hover, preserving zero and unknown values. Other sharing candidates: tower/room/power/backup, but history configurations use dedicated ownership/customer-specific components, so co-location cannot prove resource sharing; no extra synthetic metrics added. Final production build/typecheck passed. Browser887 verifies analysis row32px, both switch roots32px with inner buttons within borders; month/quarter/year navigation works, final quarterly scrollWidth equals clientWidth773. Browser1363 shows all4metrics in32px row. DS column tooltip confirmed on keyboard focus with538sites/49.81%; viewport reset. Live wrapper PID18152.

Latest user refinement supersedes ratio below: wide composition/customer cards now2:1. Removed duplicate regional total and complete-state footer from composition. Plot flexes to card height; six bars normalize against current maximum count, reserving label headroom, so largest bar uses available plot height. Zero remains zero. Customer main table drops shared count, keeps customer/covered/rate/actions, removes36rem minimum width and tightens cell gaps for narrow1/3card. Detail/CSV counts unchanged; incomplete-source note preserved.

User requested six buckets: vacant/single/double/triple/quadruple/fivePlus. Sharing domain, structure trends, customer drawer and CSV now use these exact buckets. Composition changes from vertical rows of horizontal progress bars to six columns with counts/percentages above bars; wide detail ratio changes from1:1.8 to1:1.35, giving composition more room. Preserve concrete-customer dedup, unknown values and stock endpoint semantics. Validation:8 targeted tests plus production build/typecheck passed. Browser887/1363 confirms six columns, narrower customer card, trend legends and drawer categories; viewport restored. Current counts0/3/78/404/538/57 reconcile1080. Preview63333 restarted with wrapper PID5944.

## Sharing analysis migration (2026-11-12)

User approved a second focused judgment topic: sharing. Title-right links expose energy/sharing; energy remains default. /sharing and resource view=sharing redirect to judgment sharing with region/snapshot; remaining customer-use legacy stays. New sharing-analysis domain reuses monthly concrete-customer dedup and half-open validity; unknown/partial permissions never infer full sharing from brands/devices. Extracted historyTenancy is shared by original materialization and lightweight 24-month analysis, no hourly/source writes. Monthly/quarterly/yearly endpoints, current partial cutoff, missing-month gaps and regional scope preserved. First full-width trend switches rate line/grouped structure bars, second row structure/customer cards; large operator logos, scoped CSV and customer-only drawer/menu, 32px controls/loading. Blue/neutral palette only. Sharing rate uses explicit0-100-bounded zoomed axis; other ServiceCharts keep defaults. Do not sum operator site counts or period stocks; vacancy is not rentable capacity. Validation:32domain/history/navigation tests and13HTTP checks pass; final production build/typecheck pass. Browser887/1363,32pxcontrols, quarter/year switches, rate/grouped bars, Header province/city/county, customer drawer and CSV verified.

## Energy composition presentation (2026-11-12)

Customer composition refinement: column header is a single line "Customer energy Measured/Allocated". Measured label/values use chart-1 blue; allocated label/values use foreground neutral. No orange/red for this distinction. Customer rows retain two numeric lines without repeated labels. Exact values, details and CSV unchanged.

Latest layout: first row has one full-width trend card. Second row pairs composition(left) and customer allocation(right), using the same DSPanelCard; below80rem they stack. Customer export is the card header's32px primary action. Removed ordinal column and combined dedicated/common quantities into a labeled two-line composition column, leaving customer/composition/confirmed/pending/actions. Preserve customer logos, confirmed share, warning quantities, row/details/menu and CSV. This supersedes the earlier open customer-table presentation.

Latest trend simplification: removed the bottom dedicated+common=total equation. A compact total now sits above the plot in the legend row, with kWh attached to the amount. Removed standalone unit labels in this chart and the period row. Reclaimed footer height goes to a flexing taller plot. ServiceChart exposes optional legendSummary; other charts retain their existing unit label and behavior.

User refinement: formal panel titles are Energy Trend and Energy Composition. Removed oversized standalone customer-confirmed metric. Composition shows the same physical total as the trend, with separate assigned/pending groups, totals and total-energy percentages. Assigned includes confirmed dedicated meters, confirmed customer allocations and tower self-use; pending includes customer confirmation and unallocated common energy. Group bars share the same physical denominator and breakdown colors. Customer allocation remains in the open table below. Percentage pair rounds to100%; unavailable totals stay unknown. No meter/source values changed.

## Energy analysis loading correction (2026-11-12)

User reported judgment page would not open. Direct requests and launcher navigation rendered without errors; annual switching exposed a very slow synchronous calculation. Energy reference ledger now aggregates full days directly for week/month/year instead of splitting every day into hours. Day/hour charts retain the original hourly projection. Fixed whole-percent contract shares and integer common-meter units conserve the exact existing results. Shared date windows and site constants are computed once. Full1080-site benchmark: monthly analysis7023ms to1256ms; yearly59139ms to2355ms, identical physical and allocated totals. Added daily/monthly/yearly/weekly customer and balance reconciliation coverage;7energy tests and typecheck passed.

## Applied filter button appearance (2026-11-12)

Evidence toolbar correction: removed the report-centre shortcut (user wants export only). Summary left has expand/collapse and a truncating scope note; right has operator, composite filter, reset and primary export, all32px. Composite filter adds status for summary; details keeps status outside. Summary grouping/displayCounts now use filtered pre-pagination records, matching detail/export; summaryCounts retains the original full scoped diagnostic totals. Service restriction trims summary categories. Cross-view navigation retains method/service/dimension/state/operator but clears detail-only search. Service-drawer drilldown preserves current filter scope. Both resets clear operator, local filters and dimension. Added reconciliation tests for grouped filtered totals, operators/statuses, restricted access and exports.

Global filter-trigger audit found conditional secondary/outline variants in evidence details, resource sites and site registry. All three now reuse portal/filter-button.tsx, a ref-forwarding DS Button adapter: always outline; only label/count text becomes primary when count>0. Background, border, hover, focus,32px toolbar geometry and popover behavior stay owned by existing DS/layout. Do not switch filter-trigger surfaces when filters become active. Other existing filter controls already keep a stable variant.

## Evidence title and operator filters (2026-11-12)

User cancelled station navigation from service-type titles. Summary group titles only toggle expansion; leaf titles/rows open the existing service drawer. Both title buttons have32px height and transparent hover/active backgrounds, retaining row highlight and keyboard focus. Do not add station selection/jumps to these type titles. Actual site names retain existing single-site links. Neutral Phosphor Stack(summary) and Rows(details) replace repeated/search analysis icons.

Both evidence pages expose the existing permission-scoped operator selector: summary tools and detail tools. Operator context is retained across views and recalculates scoped summary counts, details and exports. Details expose operator+state; service type moves into the composite filter with method/dimension. Composite filter badge counts those fields only.

## Evidence summary focus (2026-11-12)

Latest: evidence analysis row shows captured, warning-tone pending and completeness. displayCounts uses all scoped rows for summary and filtered pre-pagination rows for details. Pending means pending only; complete is configuration+measured+allocated (estimates excluded), completeness uses customer records and known applicability. Summary main table is reduced to counts/complete/pending/rate with fixed widths and64px edge columns. Group row toggles children, leaf row/title toggles a DSDrawer, every ActionMenu has View details. Drawer retains all method/status counts and definition/source requirements plus links to service records. Missing-source examples remain. Do not fill nonapplicable method columns with fabricated data.

## Metering evidence demo expansion (2026-11-12)

User asked to fill evidence samples while retaining some missing-source examples. configuration-evidence.ts now reads active stock configurations directly from existing known DEMO-SERVICE-v1 history captures (no new stored hourly facts or fake meters); 22 stock items plus existing energy give23/25 services. standby-generators and indoor-coverage-area remain intentional source gaps, broadcast/other remain pending. Summary adds complete-configuration counts; details, CSV and source trace share the projection, service configuration IDs link to evidence. Explicit configuration dimension IDs prevent mixing same-unit metrics. Original meter totals/report sums remain meter-only. Partial-year stockAsOf moves inside the observed cutoff to respect exclusive validity. Formal sources, DDL and stored history bundles untouched.

## Metering evidence refinement (2026-11-12)

Detail toolbar uses a 32px primary CSV download and a scoped Report Centre link. The centre reuses the judgment report library under /reports?view=tower, with snapshot, region and operator retained; detail-specific filters still apply only to CSV. The details analysis row uses the file-search icon.

User-approved placement: evidence now has summary/details only. Configuration > Rules > Metering Agreements and Criteria hosts the comparison tool; configured and snapshot-frozen rules are shown as distinct sources. Legacy evidence rules links redirect with the original snapshot and scope. Evidence drawers retain read-only historical rule trace; no rule or snapshot data changed.

Rules comparison is now open too: removed PanelCard and repeated heading/description; selectors and comparison table flow directly on page with transparent surfaces and page scrolling. Shared portal/analysis-loading.css now owns capsule loading indicators for service, evidence and history controls; exact32px height, remaining-width flex fill, existing transition locks retained.

Latest background correction: normal group rows are transparent in both open service/evidence tables; this supersedes the earlier white-row preference. Expanded and hover blue hierarchy states blend with the page using transparency, not card white. Child-row tints exclude group rows containing a collapsed representative metric.

Latest user correction: summary is OPEN like service matrix, not PanelCard. Removed duplicate card heading/description. Extracted existing service-matrix hierarchy CSS unchanged into tower-service/grouped-table.css and reused it in both pages; transparent thead/th in both. Summary uses identical category icons, arrow column, child ordinal/indent and expanded tints; trailing64px actions use shared32px/20px ActionMenu (details for captured child, disabled placeholder otherwise). Rules card and details flow remain unchanged.

Implemented spec130: evidence summary/details/rules share title actions, help drawer and32px isolated loading strip. Eight-category25-item service directory preserves missing-source states. Explicit service usage basisId maps captured evidence to deliverables; estimates excluded from reliableCoverage, mixed-dimension sums rejected. Details use natural page scroll, DS list/cards and composite filters;32px/20px action adapter; structured trace Drawer retains inputs, bindings, frozen rules/monthly sharing and total/sub reconciliation. Rule comparison defaults to same service/kind; labels use business names and real differences only. Prior workspace retained in evidence/legacy-workspace.tsx, not routed. Formal sources/configuration-quantity evidence remain pending; no snapshot/DDL edits. T01-T08 remain complete. Typecheck and production build passed; local browser confirmed grouping, status drilldown, trace, rule comparison and32px controls. Final toolbar uses existing site-analysis-table-tools-single-line to avoid old grid search wrapping. No automated tests added/run.

## Service matrix presentation refinement (2026-11-12)

Loading message sizing: exact32px border-box height, no vertical padding, body font, flex-grow to fill remaining toolbar width between context and period controls; empty remains display:none.

Loading correction: highlight only service-analysis-loading message component (tinted surface/border/padding), not whole toolbar. Removed blanket grouped-row button hover transparency; toolbar enabled buttons retain DSaccent hover, disabled placeholders remain noninteractive.

Global row-action sizing: DS ActionMenu default icon16 differed from service overrides20. All8consumer files now import portal/action-menu sizing adapter (DSbehavior unchanged), shared32pxbutton/20pxverticalicon. Service analysis row data-loading highlights whole strip with primary tinted surface/insetborder and bold spinner+data-loading text; existing transition lock/inert preserved.

Latest: removed visible micro-amplification sentence at user request, amplification unchanged. Collapsed representative metric uses same service-matrix-child ordinal/title/unit/description structure and indent as expanded row, with regular rather than semibold title; category heading retained above. Avoid moving/resynthesizing metric text across expansion.

Action placeholders now reuse DS ActionMenu, same as sites/registry reference (vertical dots), in both service matrix and comparison rows. Empty items + disabled,32pxtrigger/20pxicon; replaced custom horizontal dots, no menu actions invented.

Comparison row trailing action placeholder: separate32px grid slot and32px disabled DSghostbutton with20px existing Phosphor DotsThreeIcon, centered. No invented actions; narrow layout retains trailing slot.

Latest comparison override: no overlay. Current blue bar above, baseline light-blue below; equal8px thickness,2px gap, square ends, aligned origin. Exact amounts and micro-gap amplification retained.

Comparison bars final visual override: all base/current bars and legend markers are square-ended (no rounded corners); thickness and micro-difference amplification unchanged.

Latest comparison override: baseline is now a full-length thicker light-gray bar behind unchanged-thickness blue current bar, sharing origin/centerline. Removed endpoint dots/vertical marker/local interval decoration; equal endpoints align exactly, increase extends blue, decrease exposes gray. Existing micro-gap amplification and notice remain; exact quantities unchanged.

Comparison micro-change refinement: exact zero shares one endpoint. Nonzero comparable gaps below4percentagepoints of chart width are widened to4for visibility; larger endpoint preserved except nearzero floor. Explicit visual-amplification notice, exact values/delta/rate unchanged. Added local interval highlight/current endpoint; dashed decrease interval. No amplification on missing or incomparable pairs, no data mutation.

Comparison redesign: removed local operator selector, replaced five-column table with full-height operator rows. Shared-scale current blue bar plus baseline gray marker, paired exact values above, delta+rate grouped right. Large existing operator logos retained, neutral identity/delta text. Metric/comparison controls32px. Missing/comparability/revision rules and both snapshot detail actions preserved; no source mutation. Initial build/typecheck pass; browser887 fiveequal73pxrows, no horizontaloverflow, two32pxselectors, no operator selector.

Follow-up: expansion chevron is a separate 64px first column, trailing actions is also 64px, both centered. Metric title is second column. Toolbar uses DS ViewModeSwitch with icon-only list/cards; toolbar and controls explicitly 32px. Shared history picker uses calendar icon at user's latest request, replacing earlier analysis icon.

Matrix list/card share full-width clickable category rows. Normal category surface uses DS card color; expanded/focused categories and child items use different low-opacity primary tints. Trailing actions column has a visually hidden heading and disabled ellipsis placeholder, no invented menu actions. Child detail actions and original snapshots are preserved.

## P7核验项两行配对（2026-11-09，覆盖上行指标方案）

核验项上行仅运营商logo／名称，下行指标＋变化数字，如流量 +35.0%，指标与数字inline-flex整体不拆行，继续DS stacked居中。清单／记录共用。三宽、三指标及无法判定／零参考和详情检查、最终构建通过，artifacts/p7-metric-delta-qa；63333已更新。

## P7异常实际量颜色（2026-11-09）

实际／参考列拆分数字与单位：实际业务异常数字用DS warning橙色，单位与参考量中性灰，缺数破折号／参考不足保留；无严重分级，不自行加红色严重规则。复用原quantity精确计算及DS stacked居中，无新增CSS。构建与三宽三指标六类场景14组及详情检查通过，artifacts/p7-quantity-tone-qa，63333已更新，无用户记录／配置写入。

## P7删除更新入口、统一秒数（2026-11-09）

用户明确删除核验页多余的更新数据按钮，不再给工作区传dataUpdate；标题只显示静态数据更新至时间，不挂可用性检查弹窗，清单／记录一致。共用formatDataTime精度改为YYYY-MM-DD HH:mm:ss，北京时间，窗口／人工记录仍用原业务格式。7项时间／可用性检查、最终构建、三宽双页及承载共用格式与详情检查通过，artifacts/p7-update-time-qa；63333已更新。

## P7合并核验项与变化（2026-11-09，最新列结构）

用户确认核验项与变化合并：上行运营商logo／简称 · 指标，下行变化比例或不可判定／参考为零，删除独立变化列。清单列序为序号→站址→核验项→发现→实际／参考→状态→操作；站址左对齐，其余业务列居中，DS现有窄序号／操作。记录保留最近操作与记录人／时间，共用合并核验项。四宽双视图及三指标／不可判定／零参考、详情与构建通过，artifacts/p7-merged-columns-qa，63333已更新。

## P7核验项与列对齐（2026-11-09）

用量核验清单／记录新增核验项列：运营商标识／简称＋指标；站址列仅名称和编码。发现、实际／参考、状态表头和内容同轴居中，复用DataTable align／TableTitleCell stacked，无额外页面CSS。四宽双视图、三指标、实际记录、详情点击与构建通过，artifacts/p7-table-columns-qa，63333已更新。

## P7操作行保持一行（2026-11-09，覆盖此前换行方案）

用户明确要求操作行一行、移除配置链接。用量核验清单／记录将模式、状态、搜索、类别／类型／指标／记录原因筛选、重置合并为唯一48px操作行，删除规则参数链接。共用site-analysis-table-tools-single-line，所有宽度不换行，空间不足只在操作行横滚，键盘聚焦可到达搜索，正文不横溢出。居右组件顺序固定为搜索→筛选→重置，居左仅清单／记录和状态。保留14px／32px、正文色和数字继承字重。七宽双视图及状态／类别／搜索／回车／重置／切换通过，artifacts/p7-toolbar-order-qa/checks.json，构建类型通过，63333已更新。

# 后续代理入口

2026-11-12 最新定位纠正：用户明确分析面向运行／运营／经营，前批关注事项／贡献不能代替业务专题。要求小步逐个建设，先做能耗“用了多少、分摊给谁”；仅按Header省市县下钻，禁止本页逐塔清单／单塔入口。/tower-service/judgment默认能耗，旧findings/contribution深链保留但不挂本页入口。能耗用区域总量／日均、趋势、分表＋公共表守恒核对、电量去向、客户计量／公共分摊／待确认开放清单、客户层级依据Drawer和CSV。单独site-energy-ledger-v1参考模型补公共表与固定协议，沿用原客户历史，不改存量快照或报告；未入驻份额留待分配，广电／其他协议待确认，受限客户不返回整站或公共池。详情不跳单塔。52项领域／导航、12项HTTP与最终生产构建通过；浏览器Header全省→宝鸡→渭滨、日月切换、887/1280无页面横溢出，加载条和操作控件32px已核对。规格140顶部覆盖旧首批安排。

2026-11-12 分析研判首批已落地：关注事项开放清单与规则追溯抽屉，变化贡献按运营商／区域／站址分解并下钻固定版本站址和计量依据。参考历史附带冻结策略，待确认数量与计量依据共用逻辑；配置期末、用量完整期间、精确整数增减与贡献百分点，缺源不补零。旧报告链接保上下文转报告中心，Launcher 旧入口保留，未建专题不预放空页。50项领域／导航测试、12项HTTP测试及最终生产构建通过；63333已重启为最新版本，887与1280布局、32px加载提示、站址整行详情及来源链接经浏览器验证。截图 tmp/judgment-findings.jpg 与 tmp/judgment-contribution.jpg。后续继续按业务归属逐项迁移，不宣称所有候选专题完成。

2026-11-12 用户确认分析研判渐进构建，但原有好能力不强制归入研判：按业务问题可迁其他板块，无法归集的继续保留原功能与 Launcher 待迁移入口。规格140记录归属与门槛。首批为关注事项／变化贡献；其余专题不预建空页。规则配置留配置管理，报告库归报告中心，旧报告链接保上下文跳转。保留成熟布局，不以迁移为由重做或删除旧入口。

2026-11-07 客户使用浏览器批注整改：取消页面max-width居中限制，沿用product-workspace／product-page-inset全宽规范；统一PageHeading的context显示“数据更新至”，本页去除Header及标题区演示标签。区域仅Header选择，图表负责下钻，正文不重复选择器；站址详情保留对象地域、地图保留选区、配置无地域。筛选统一32px／正文14px，增加按日／周／月及日期条件；当前只有固定单日资源快照，其他周期显示无可用数据而非零值或复用当前数。地域条形图固定5ch右对齐数值列，条轨起止不随数字长度变化。本条覆盖此前居中和正文面包屑设计。

2026-11-07 客户使用布局收尾：紧凑三指标带、运营商条形对比与双列地域分布并排、站址明细为主体，口径折叠。加入站址搜索、URL页码、DS分页、条件重置；全站运营商与筛选资源明确区分。使用详情采用DS抽屉，关闭不跳页、不丢分析位置；原档案页保持。手机三指标同行，表格局部横滚。历史入退驻／合同租赁仍待数据，不造变化。只完成客户使用，不自动迁移共享利用。

2026-11-07 客户使用首项迁移：新增 /customer-use，经营二级客户使用接入独立页面；复用站址快照与资源关系模型，省—地市—区县—单站址服务关系下钻、运营商筛选对比、物理资源去重及分页。历史入退驻、合同租用及变化无数据，明确待接入；正式环境不加载演示。此前把客户使用链接旧经营、共享利用链接通信用量不准确，本次撤回：旧经营和运营商用量保留待迁移，共享利用继续待建设。新增页面沿用header地域记忆。

2026-11-07 Launcher 对齐：业务各分区统一四列网格及相同列间距，少于四项时保留空列，不再按条目数量撑满整行；窄屏统一降为两列／单列。无描述入口使用 EntryCard 的 items-center，使图标与标题垂直居中。

2026-11-07 Launcher 紧凑化：移除纵览类、专项多域分析、基础类可见组名；仅运行／运营／经营／报告保留条目描述，其他业务入口只显示图标与名称。待迁移标题继续保留，移除说明段落；缩小面板与卡片内边距和网格间距。

## Launcher 三域与待迁移（2026-11-07）

按本轮用户确认：纵览类为运行总览、综合研判、站网地图；专项多域分析为运行、运营、经营、报告四列，二级分别为监测覆盖／运行状态／告警故障／趋势风险，承载能力／需求匹配／服务质量／履约保障，客户使用／共享利用／营收分析／成本效益，报告中心／报告生成。基础类保留站址管理、数据更新。旧容量质量、运行能效、运营商用量、用量报告、经营分析、核验、聚合、报告任务、总览偏好和服务关系入口置底部“待迁移”，保留原链接。新专业功能及独立报告生成尚未迁入，标待建设且无空壳链接；报告中心沿用现有页面。所有既有业务导航必须出现且不静默删除，权限、区域上下文和地图新标签页行为保持。此次为 Launcher 重构，不代表专业分析页面已完成。覆盖下文旧五／六类 Launcher 结构。


## 配置header当前位置（2026-11-07）

按用户确认，配置header在系统名称后使用DS ShellHeaderDivider与ShellHeaderDomain显示当前页面名称，管理首页显示“配置管理”；名称沿用导航current与pathname匹配，按最新反馈采用text-body／14px、font-normal／400与text-content-tertiary辅助文字色。小屏沿用隐藏长系统名，保留品牌及当前位置；页面正式标题保留，不叠加分组路径。

## 配置header移除地域选择（2026-11-07）

按用户要求，配置管理域header不再展示陕西省等区域选择和“演示”标签，并移除该组分隔线及空占位；共用外壳按management隐藏整组，业务域继续使用已有地域选择、记忆与环境标签。

## 业务进入配置管理（2026-11-07）

按用户要求，业务header右侧齿轮入口以新标签页打开/settings，保留当前业务页面；配置域内齿轮仍在当前标签页导航。共用ProductHeaderTools按management区分，使用原生链接target及noopener noreferrer。

## Header标题字号收敛（2026-11-07）

按用户要求，共用业务／配置header的“观澜”采用DS text-heading-1，系统名调整为“站址多域监管平台”并采用text-heading-2；按用户最终调整默认18／16px，随DS字号偏好变化，保留品牌字体及系统名浅色。通过ShellProductTitle公共name槽应用，内层使用block由自身DS行高撑开，避免外层text-xl行框造成品牌文字略偏下；不覆盖DS内部样式或全局token。生产构建及实际预览三档字号、业务／配置页面和窄屏检查通过，证据artifacts/header-typography-qa/checks.json；独立地图header未改。仅本地交付，未push或外部部署。

## 配置导航全面整改（2026-11-07，用户当前批次）

按console本机DS10/tokens3与本站DS15/tokens4逐项对照，确认同名尺寸／字号token变化造成32px导航行、28px图标中心、10px组名与64px轨道不匹配；本站所有组加线以及逐页重挂／effect恢复localStorage进一步造成间距与首帧跳动。共享design源码0033b60恢复40px导航行及导轨、32px分组行、默认12px组名／14px条目，三密度静态居中；补可访问名、关闭分组inert和可选服务端分组偏好。本站pnpm补丁固化原发布包修复，保持其他依赖锁定；/settings/layout保留唯一外壳，cookie服务端首帧恢复收起／分组，活动项按pathname，移动抽屉重开保留分组，移除重复组线和底部块。

实际预览10路由连续切换不重挂、逐帧64px、无JS首帧及水合刷新、三密度、键盘、分组记忆和904／390共18项通过，浏览器错误空；DS针对66、types/build与两护栏、本站types/build/HTTP及冻结安装证据见[ops_bsmoss_261](../40-implementation/ops_bsmoss_261_management-navigation.md)和artifacts/formal-checkpoints/management-navigation.json。旧构建缓存被验收捕获并隔离重建；手机脚本等待已修，favicon404已用现有观澜SVG补声明，最终重跑。来源／映射MVP本机保存、正式权限和数据边界保持，无DDL／真实接入／registry发布／push／外部部署；不自动恢复旧底层批次。


## 配置管理MVP两条流程（2026-11-07，最新交付）

用户同意按MVP推进，覆盖此前259底层接续。/settings/sources和/settings/mappings在显式产品预览模式开放可操作工作台：来源新增／编辑／启停／检索／详情，映射选择来源／检索陕西1080站址／关联保存／编辑启停。两页本机持久化共用，刷新重开保留，来源映射条数一致；重复编码／重复来源对象拒绝，旧详情覆盖新编辑拒绝、存储失败保留草稿且不假报成功。官方DS表格／表单／抽屉／分页／三点菜单，无新依赖。标题提示本机保存，样例3来源12映射，用户标签页未操作。

关闭预览仍保持原真实身份门槛与正式接口方法限制；无生产配置写入／外部连接／凭据／任务执行或数据截至推进。具体实现／限制／验证见[ops_bsmoss_260](../40-implementation/ops_bsmoss_260_configuration-mvp.md)，最终日志／截图／本地SHA见artifacts/formal-checkpoints/configuration-mvp.json。3项相关规则、types／build、HTTP以及实际预览两页／表单三宽12组及完整端到端流程为本批验证，不重复数据库全套。最初DS图标名及两处字段可访问名称问题已修复；Chrome一次截图故障重跑，不算通过。

MVP先让用户体验当前两条业务流程并按反馈收尾，不再自动接续复杂审批、跨版本治理、原件批准契约或扩建权限系统。正式共享持久化／真实来源接入及其他管理板块后置；不把本机配置当多人协同数据库，不把启用称已连接。未push／外部部署／上线，无新聊天或自动任务。


## MVP范围纠偏（2026-11-07，用户最新指令，优先于下文接续）

用户明确要求先做MVP，并指出连续底层扩展已偏离目标。停止按259及此前“下一批”自动接续审批契约、原件验证、跨版本治理等扩展；既有代码保留，不扩大建设范围。

交付优先级回到用户可见的完整业务流程：使用已授权陕西演示数据，配置管理先实现来源配置和对象映射的基础列表、检索、详情及新增／编辑／保存的最小闭环；沿用已确认官方DS导航、布局、四字标题及业务／配置分域。已有组织／权限／参数目录保持，不把五组全部治理作为MVP前置。具体实现先核对已有可复用能力，避免新建平行系统。

演示配置的保存必须明确其演示环境边界，不能伪装为真实生产配置写入或绕过正式身份权限；接收执行与数据更新继续留业务域。生产接入、复杂审批、完整依赖治理均后置，只有核心流程实际需要的校验和验证才进入本批。后续汇报用页面、操作及完成效果描述，不以测试数量或底层术语代替业务进展。尚未实现的新增／编辑／保存不得报完成。


## 来源跨版本接收位置预览（2026-11-07，最新执行）

设计259／实施[ops_bsmoss_259](../40-implementation/ops_bsmoss_259_source-position-preview.md)：来源变更预检增加最后接收→当前／拟变更三版本核对及待复核历史区间，超过原31日窗口提示分段。独立admin.sources.position.preview，无角色赋权；完整原新scope先验、历史完整scope SQL先过滤，真最后sequence不可见不退到早期可见回执。原receiptRow与纯版本／身份／摘要／位置校验，同只读RR快照，成功／missing／stale／SQL失败末次独立授权复核。无游标／原量／manifest／主体披露，无基准／配置／位置／任务写入。

759最终全量单测、20针对、486最终实际PG、60HTTP、双层types／build、三宽组件9组及正式门槛另9组的最终证据／SHA／健康见formal-checkpoints/source-position-preview.json与source-position-qa。初轮本机PG端口及夹具重复主体已修全量重跑，不计初轮通过。67表／Prisma保持，空库仅1permission种子，只应用随机专用本机合同库；合成组件不当真实来源或身份验收。

本批只读差异不等于受审重新基准完成；未读远端head／确认变化流兼容性，不直接沿用旧游标、不推进可分析截至；早期任务全集和精确binding修订聚合／报告依赖仍待。下一原件验证与可信提交／批准契约服务边界，再真实凭据环境下连接核验和受审写入。组织／授权写入、规则发布、P1工作台／消息／按需接收、P2共同版本及真实来源／平台环境／Beta容量恢复／UAT／生产批准依赖保持；未push／外部部署／上线，无新聊天或自动任务。

## 映射预检聚合与报告依赖（2026-11-07，最新执行）

设计258／实施[ops_bsmoss_258](../40-implementation/ops_bsmoss_258_mapping-dependencies.md)：映射当前预检增加当前聚合head及当前生成报告head的明确引用，各20＋lookahead。聚合原plan＋inputs按三类原内核重放校验；报告原manifest重建／摘要与完整scope验证，覆盖主／日级／peer及汇总成员引用。两类独立权限，无owner／机器绕过、无角色赋权；完整范围在LIMIT前过滤，同只读快照，所有成功／missing／stale／SQL失败末次复核。无权不查不计0，旧head引用不复活；无原量／聚合／报告／任务写入。

754单测、479最终实际PG、14针对、60HTTP、双层types／最终UI生产构建及三宽组件回归通过；最终SHA／健康和正式门槛见formal-checkpoints/mapping-dependencies.json，证据mapping-impact-qa。初轮UTC日夹具及汇总参数错误已修全量重跑，版本／时间段断字已优化再验。67表／Prisma保持，空库仅2permission种子，仅随机专用本机合同库应用。合成组件不当真实来源或身份验收。

本批是当前映射的授权关联预览，不是完整重算范围；历史／未发布／潜在新增依赖不覆盖。来源预检无精确binding修订依赖仍未评估，不以sourceId推定；映射接收任务及跨版本最新位置保持待评估。下一跨版本位置与受审重新基准只读差异／处置契约，再原件验证与可信提交批准下受审写入／真实连接核验。其他组织／授权写入、规则发布、审计、原P1/P2、真实来源／平台环境／Beta恢复／UAT／生产批准依赖保持，未push／外部部署／上线、新聊天或自动任务。


## 来源预检当前版本接收影响（2026-11-07，最新执行）

设计257／实施[ops_bsmoss_257](../40-implementation/ops_bsmoss_257_source-intake-impact.md)：来源当前预检增加实际回执／任务证据，各20＋lookahead，完整当前绑定范围在独立admin.sources.intake_impact.view授权内才查询，同只读快照，复用摘要／计划／完整事件历史校验并验证lookahead。成功／missing／stale／SQL失败均双权限末次复核；机器／owner无绕过，无角色赋权。无权不查询、不计0；空当前版本不代表无历史。早期修订、跨版本最新位置、聚合／报告继续未评估；新摘要仍需受审重新基准，无任务／配置／位置写入，不推进截至。

746全量单测＋15最终针对、468实际PG、60HTTP、双层types／production build、三宽展开明细及原预检交互通过，截图已复核；正式门槛／最终SHA／健康见formal-checkpoints/intake-impact.json，证据intake-impact-qa。67表／Prisma保持，空库仅一permission种子，仅随机专用本机合同库应用，未改业务库。合成组件不当真实来源验收。

下一聚合／报告实际授权依赖，再跨版本位置／受审重新基准、可信审批契约与依据原件验证下受审写入、真实连接核验。本批非完整配置治理；组织主档／授权写入、规则发布、其他审计、原P1/P2及真实来源／平台环境／Beta恢复／UAT／生产批准依赖保持。未push／外部部署／上线，无新聊天或自动任务。


## 配置管理来源配置变更预检（2026-11-06，最新执行）

设计256／实施[999](../40-implementation/999-source-preflight.md)：当前来源详情增加状态／适配／转换／覆盖起点／完整范围变更预检，审计页不放入口；固定原revision+摘要、拟revision+1，前后对比／范围差分、真实资源关联及指标登记。独立admin.sources.preflight、机器／owner无绕过，原新完整scope在lookup前验权、同只读快照、所有错误路径末次复核；无配置／位置／任务写入。任何新修订摘要变化需受审重新基准，旧位置不直接沿用；回执／任务／聚合／报告和能力影响未评估，依据声明未验真。

742单测、460实际PG、60HTTP、双层types／最终production build、三宽独立无头DS组件和交互通过，正式门槛及最终SHA／健康见formal-checkpoints/source-preflight.json，证据source-preflight-qa。初轮SQL符号残留、PG规范排序断言、下拉／Textarea可访问名称问题已修复重跑，不计初轮为通过。空库baseline仅一permission种子，无角色赋权，67表／Prisma不变，仅随机专用本机合同库应用。

下一实际授权聚合／报告依赖及接收任务重新基准影响，再可信审批契约／原件验证下受审写入及真实连接核验。本批不算完整配置治理；组织主档／授权写入、规则发布、其他审计、原P1/P2及真实来源／平台注册环境／Beta恢复／UAT／生产批准依赖保持。更新／接收留业务，不推进截至，无push／外部部署／上线、新聊天或自动任务。

## 配置管理映射有效期变更预检（2026-11-06，最新执行）

设计255／实施[998](../40-implementation/998-mapping-preflight.md)：对象映射详情增加只读有效期预检，固定旧版本／微秒区间、拟版本+1、依据引用／原件摘要声明，前后区间与覆盖差分、授权内重叠和服务期覆盖。独立admin.mappings.preflight、机器／owner无绕过、同只读快照及成功／missing／stale／SQL错误末次验权；输入变更清结果、迟到隔离、403清整页。只读无写入、不假审批，授权内无重叠不称全局通过；聚合／报告／接收任务固定未评估，时间覆盖差分不当完整重算范围。

733单测、453实际PG、59HTTP、双层types及production build通过；三宽独立无头组件／DS Providers与交互通过，正式门槛回归与最终SHA／健康见formal-checkpoints/mapping-preflight.json，证据mapping-preflight-qa。初轮测试夹具never[]和PG端口／构建期间夹具CSS缺失已修重跑，失败不计通过。空库baseline仅一permission种子、无角色赋权，67表不变，DDL仅随机专用本机合同库。

本批仅映射有效期预检，不算完整变更治理。下一来源配置变更预检，再聚合／报告依赖及接收任务重新基准影响与可信审批契约下的受审写入／真实连接核验。责任组织主档／授权写入、规则发布、其他审计、原P1/P2及真实来源／平台注册环境／Beta容量恢复／UAT／生产批准依赖保持。接收／更新留业务、不推进截至，无push／外部部署／上线、新聊天或自动任务。

## 配置管理对象映射与关联核对（2026-11-06，最新执行）

设计254／实施[997](../40-implementation/997-object-mappings.md)：数据接入组补对象映射，管理DS侧栏／总览／launcher同源；真实source_mapping检索、目标类型、keyset分页、五类关联详情和服务有效期覆盖检查。映射版本独立于来源转换版本，过去／将来定义不是变更审计；服务期未完整覆盖不冒充指标兼容或数据验收。微秒区间／numeric字符串保真，网络类型中文，日期保留精确UTC提示。

独立admin.mappings.view，owner／来源查看／ingest无绕过、机器拒绝。全部关联服务／设备、来源／站址与物理参数标志SQL先过滤再LIMIT，同只读快照、lookahead校验和末次身份／完整scope重验，空页／missing也验权；客户端取消迟到请求，详情失权清整页。空库baseline仅1权限种子无角色赋权，67表不变，DDL仅随机专用本机合同库。725单测、447实际PG、58HTTP、双层types／最终build及针对11项复测通过；最终SHA／健康见formal-checkpoints/object-mappings.json。

原生浏览器控制连接重试仍不可用，改独立无头Chrome，不操作用户标签页；正式6组＋合成组件3组／详情3组响应式及查询／分页／403／503／迟到隔离／导航通过，截图已复核，应用异常与warning空。证据artifacts/object-mappings-qa，63334合成组件不当真实来源验收。初版生成残留被types捕获已修，首轮63333未就绪连接拒绝后重跑，不计失败成功。

下一来源配置／映射变更预检及影响预览，先固定前后版本、完整原新范围、真实依据／原件摘要、可信提交／批准契约、重叠／关联和聚合报告／任务重新基准影响，再受审写入与真实适配器连接测试；当前只读不计完整治理。组织主档／授权写入、规则发布、其他配置审计和原P1/P2、真实来源／平台环境／Beta容量恢复／UAT／生产批准依赖保持。接收／更新留业务、不推进截至，无push／外部部署／上线、新聊天或自动任务。

## 配置管理来源配置与配置审计（2026-11-06，最新执行）

设计253／实施[996](../40-implementation/996-source-management.md)：官方DS管理侧栏／总览／launcher增加来源配置、配置审计。真实RP四个GET只读接口，当前head与逐版本历史、检索／状态／keyset分页／完整五维详情；独立admin.sources.view与admin.configuration_audit.view，owner无绕过、机器拒绝。完整scope在LIMIT前过滤，只读可重复读快照、lookahead摘要校验、空页／缺失也末次验权；历史游标保留微秒和numeric字符串版本。客户端取消过时请求，详情失权清整页和Drawer。登记启用不等于连接正常，数据库主体不冒充审批人，覆盖起点不称数据截至；审计仅覆盖来源配置版本。

717全量单测、441实际PG、57HTTP、双层types／最终build通过。67表／Prisma不变，空库baseline仅2权限种子无角色赋权，DDL只在随机专用本机合同库。正式三页三宽9组与独立loopback合成组件两页三宽6组，手机详情、检索／分页／空态／403／503／迟到响应和导航通过；warn/error空，临时18／19关闭、viewport恢复。首次PG夹具漏列名已修全套重跑。证据artifacts/source-management-qa，最终SHA／健康见formal-checkpoints/source-management.json。

下一受审来源配置治理与对象映射，先核对授权原件／字段、变更依据／版本、映射校验和连接测试契约；当前只读不计完整治理。组织主档／授权写入、规则回放签认／发布、其他配置审计仍待。原P1接收工作台／分阶段消息／重新基准／按需接收、P2共同版本／报告依赖及真实来源／平台环境／Beta容量恢复／UAT／生产批准依赖保持。接收执行／数据更新留业务，不推进截至，无push／外部部署／上线、新聊天或自动任务。

## 配置管理站址分类与分析规则（2026-11-06，最新执行）

设计252／实施[995](../40-implementation/995-business-parameters.md)：官方DS管理侧栏业务参数组补齐站址分类、分析规则，和指标字典／模板配置共组；管理总览与launcher同源。11项分类、9项规则只读目录，多词AND检索、维度／领域筛选、EmptyState与详情Drawer，保留口径、版本、使用边界；无租户记录或写API。业务更新仍在业务域，全局地域仅保留偏好。

纯business-parameters统一词汇／阈值，站址解析／历史分组、专题／容量／运行、总览触发项、核验和经营分层复用；三个分析表面的规则说明同源。原证据版本不改；WAVE_POLICY深层冻结，0运营商未知，合成适配器拒绝无运营商而不称独享。119568组有效输入与改前摘要一致a34957d58f15679cadfc823f4add7b802b720b8fcdd4d2578a3d2a4892e1c5a0。

710单测、56最终HTTP、双层types／最终build通过；无store／DDL变化，不重复PG，静态镜像67表。管理首页／两目录三宽9组唯一H1、无正文／文档横溢，手机390px详情、检索／空结果／分类、移动导航及规则边界通过，warn/error空。详情初版缺摘要且重复分类已优化并最终复测。证据artifacts/business-parameters-qa；最终SHA／健康见formal-checkpoints/business-parameters.json。临时17关闭、viewport恢复。

下一批来源配置与配置审计，先核对受审来源注册／版本／映射／连接核验能力；接收执行与数据更新留业务。正式站址赋类、生产规则回放签认／受审发布、组织主档与授权写入仍待，不能把本批只读目录算完整治理。原P1接收工作台／分阶段消息／重新基准／按需接收、P2共同可用版本与报告依赖及真实来源／平台环境／Beta容量恢复／UAT／生产批准依赖保持。无push／外部部署／上线、无新聊天／自动任务、不扩大权限或更新数据截至。

## 配置管理管辖与成员只读基础（2026-11-06，最新执行）

设计251／实施[994](../40-implementation/994-management-foundation.md)：官方DS侧栏增加组织管辖／管辖范围、成员权限／成员管理，管理总览按真实分组横向对齐。真实RP只读检索筛选、keyset分页、成员角色／scope详情；独立admin.members.view与admin.jurisdiction.view，owner无隐式管理权、机器拒绝。五维完整范围SQL先过滤再LIMIT，lookahead校验，同租户／只读可重复读快照及最后身份权限scope重验，空页／缺失也复核。资源关联仅计授权ID，不虚构组织树／县级责任。客户端取消过时请求、详情失权清整页与Drawer，无假数据回退。

705单测、434实际PG、55HTTP、双层types与最终build通过；67表／Prisma列保持，空库baseline仅加2permission种子，无角色赋权，DDL只在随机专用本机合同库。15组响应式及手机详情／翻页／403／503／迟到响应／导航交互通过，正式页面身份门槛与独立loopback合成组件验收明确分开。证据artifacts/management-foundation-qa，最终SHA／健康见formal-checkpoints/management-foundation.json；临时16关闭、viewport恢复。首轮PG夹具签名和cache断言问题、JSX属性Unicode字面显示已修并复测。

下一批业务参数：站址分类与分析规则，再来源配置／配置审计；责任组织主档与受审授权写入仍待。原P1接收工作台／分阶段消息、重新基准／按需接收／共同版本及真实来源、平台环境、Beta容量恢复／UAT／生产批准依赖保持，不能把两只读页算完整组织权限管理或生产验收。无push／外部部署／上线、无新聊天／自动任务、不扩大机器权限／不更新数据截至。


## 配置管理职责重组首批（2026-11-06，最新执行）

用户授权参考yucer管理思路结合本业务推进，导航尽量四字。设计250／实施[993](../40-implementation/993-configuration-boundaries.md)：覆盖249旧归属，数据更新、聚合处理、报告任务迁回业务；旧/settings/operations深链与/operations/reports固定307保留全部query及重复项，由原目的页验证，Header消息／登录returnTo同步。业务launcher增加数据管理第六组，报告任务归报告中心，聚合处理经数据更新二级进入。总览偏好移用户面板/preferences/overview，仍仅当前浏览器及原预览开放条件。

管理官方DS壳保持，侧栏管理总览／指标字典／模板配置。字典直接读12项FIRST_METRICS，分类检索及对象／归属／单位／粒度／聚合／依赖侧抽屉，planned显示待接入；不伪造来源启用。总览说明组织管辖、成员权限、业务参数、数据接入、高级管理五组建设范围，未具备项无空导航。非分析页改地域仅记忆并刷新，不改任务身份。导航四字，运营商用量五字保留准确性。

13规则、54HTTP、双层types及最终build通过；CUA七页三宽21组无正文／文档横溢、唯一H1。手机Drawer首次超宽已加max-w-full最终复测；字典搜索／依赖、移动导航、用户偏好／业务任务往返、收起刷新记忆和主题恢复通过，warn/error空。证据artifacts/configuration-boundaries-qa；viewport已恢复，临时15关闭。最终SHA与63333健康见formal-checkpoints/configuration-boundaries.json。

下一批优先产品组织管辖与成员权限，再站址分类／分析规则、来源配置与配置审计；本批不能算五组全部完成。原P1接收任务工作台、受审重新基准及真实来源／平台凭据／Beta容量恢复／UAT／生产批准依赖保持。无DDL／Prisma／依赖／权限分配／任务语义变更，无push／外部部署／新聊天／自动任务，不把未登录门槛页当真实业务验收。


## 配置管理官方 DS 导航与布局（2026-11-06，最新执行）

用户要求优先优化配置管理并明确“重试，应用DS系统的导航组件”。设计249／实施992：按本地平台ConsoleAppShell同源组合，ProductChrome管理域直接使用ShellViewport内置ShellSidebarFrame承载ShellSidebarNav，移除ProductWorkspace里的重复浮动边框壳；业务原布局保持。管理导航分配置／任务、底部返回业务，Next Link／精确选中，布尔收起偏好存浏览器。移动端官方Drawer承载同一导航，选择／关闭／Escape可退出；齿轮仍32／16且标识当前位置。管理首页分组EntryCard＋官方外观偏好，所有配置子页及门槛页用ShellPageContainer；全局地域／品牌／系统名保持。

最终build含类型通过tmp/management-ds-build-final.log，两项导航规则、54HTTP及190文档编号通过。首轮HTTP裸返回路径断言已更新为保留地域；CUA首轮移动端水合前检查作废，最终18组等待可见导航后无文档／正文横溢、每页唯一H1、桌面选中正确。256／64px侧栏切页／刷新记忆，移动抽屉跳转与Escape、业务齿轮及返回运行总览、浅深主题恢复通过，warn/error空。截图／checks在artifacts/management-ds-navigation-qa；viewport恢复、临时13／12关闭。任务页面验证既有门槛，未伪造正式工作台数据。最终SHA与63333健康收尾记录。

本批无权限／依赖／数据／DDL变化，无push／外部部署／上线／新聊天／自动任务。原P1接收任务工作台／Header分阶段消息、受审重新基准与按需接收仍待后续，不能把本次导航重构计为完成这些业务能力；真实来源／平台环境／UAT依赖保持。

## P1接收任务受审终止与查看接口（2026-11-06，最新执行）

设计248/实施[991](../40-implementation/991-intake-reviewed-disposition.md)：受审terminate追加历史，固定任务版本/命令/依据/真实主体，原完整scope的job_recover用户可处置失败/有效或过期启动/第五次上限/配置暂停或变更；与成功/恢复串行，旧执行不能再提交，不承诺远端请求立即停止。历史/回执/旧位置保留，新配置仍需受审重新基准。独立list/read同PG快照、完整原scope过滤后LIMIT、微秒分页及lookahead并集/空页最终重验。正式RP仅三个查看/终止API及无adapter监督组合，不暴露创建/run/recover，不扩大机器权限。67表/Prisma标量不变，空库DDL补终止转移和索引，只应用随机专用本机合同库。最终验证/SHA/健康见991及artifacts/formal-checkpoints/intake-disposition.json。

P1/B03-04/B03仍in_progress。本批为后端处置和正式查询基础，无UI改动；下一DS数据更新工作台与Header分阶段消息接入，再受审重新基准和业务按需接收、P2共同可用版本/报告依赖/B04。没有生产适配器/拉取路由或调度，不扩大机器ingest，不签来源完成、不批quality、不推进截至或旧报告。真实来源授权原件/字段/签认、稳定快照/变化流、平台凭据/环境、Beta容量恢复/UAT及生产批准依赖保持。未push/外部部署/上线，无新聊天或自动任务。本段覆盖旧“下一补任务终止”，不将剩余入口或上线依赖算完成。

## P1来源接收任务监管（2026-11-06，最新执行）

设计247/实施[990](../40-implementation/990-intake-task-supervision.md)：内部sourceIntakeTasks.run/read/recover，固定来源修订、命令幂等、持久启动/失败历史、数据库租约与旧执行隔离、精确版本/依据/双权限复核恢复。接收回执与成功终态同原量事务提交，丢失COMMIT应答先读持久终态不假报失败；撤权不能续写或记账，机器ingest保持拒绝。空库新增任务/事件两表及Prisma至67表，只作用随机专用本机合同库，不迁移或改业务库。最终验证/SHA/健康见990及artifacts/formal-checkpoints/intake-supervision.json。

P1/B03-04/B03仍in_progress。内部生命周期与失败/复核恢复本批完成；下一任务终止/配置重新基准受审处置、正式查看/消息和业务按需接收入口，再P2共同可用版本/报告依赖与B04。没有生产适配器/receive路由或调度，不扩大机器ingest、不签来源完成、不批quality、不推进页面截至或旧报告。来源授权字段/原件/签认、稳定快照/变化流、机器凭据/平台环境及Beta容量恢复/UAT与生产批准依赖保持。未push/外部部署/上线，无新聊天或自动任务。

## P1跨页面任务消息（2026-11-06，最新执行）

设计246/实施[980](../40-implementation/980-cross-page-task-messages.md)：Header消息抽屉接入已接收增量任务的授权状态投影，完整scope先过滤后分页、同一PG快照重建进度、末次整页并集重验；失败/配置变化、精确详情与恢复入口、打开且可见轮询/关闭隐藏取消、失权清空，跨页从服务器重读，不缓存任务、不制造未读/推送。687单测、391实际PG、52HTTP、双层types和production build通过；浏览器/守卫/最终SHA与健康以980及artifacts/formal-checkpoints/update-messages.json为准。无DDL/Prisma/依赖/赋权改变，65表保持。

P1/B03-04/B03仍in_progress。已有重算任务的跨页状态入口本批完成；接收阶段持久生命周期/失败记录与恢复监管、业务按需接收创建，再P2共同可用版本/报告依赖和B04待续。不把既有重算任务当上游拉取队列；没有真实来源或receive生产入口，不扩机器ingest，不签来源完成，不推进页面截至或原报告。来源字段/授权原件/签认、稳定快照/变化流、平台环境和Beta容量恢复/UAT及生产批准依赖保持。未push/外部部署/上线，无新聊天或自动任务。

## P1持久来源接收与游标一致提交（2026-11-06，最新执行）

用户继续下一步，接续bc3ca68。设计245/实施[970](../40-implementation/970-atomic-source-intake.md)：内部sourceIntake.receive从审阅注册和最后回执取配置/位置，网络准备后锁配置、互斥及前回执CAS，复用测量事务一次提交全部原量/pending质量/input_change/回执。失败/撤权/取消全回滚，同计划复用、重开/丢应答恢复；乱序修订先写前驱，受控pending重放保留原主体。有效接收可由原登记worker派发/重算并被现有任务工作台追踪，无新队列或机器权限。

空库新增注册修订/head及接收回执三表，Prisma镜像65表，仅独立本机随机合同库应用，不迁移或改业务库。686单测、387实际PG（新增21项）、双层types通过；末次production build/守卫/扫描与最终SHA/健康见970及artifacts/formal-checkpoints/atomic-source-intake.json。前两轮夹具计数字段/外键拒绝断言及重叠事件派发错误已修，失败不计成功。无UI变化，不重复浏览器布局验收。

P1/B03-04/B03仍in_progress。下一接收阶段持久任务监管/失败记录、业务按需创建和跨页通知，再P2共同可用版本/报告依赖与B04。没有生产receive调用方/API/网络适配器，不写source_completion，不推进分析截至，不自动批准quality；来源字段/原件/授权签认、快照/变化流保证、机器ingest审阅/凭据/环境继续待。来源配置新版本不自动继承旧位置，重基准需受审路径。本段覆盖旧“无DB写入/仅只读准备”，生产激活边界保持；未push/外部部署/上线。

## P1来源拉取契约与只读准备（2026-11-06，最新执行）

用户在launcher尺寸修正后“继续下一步”，接续5671ce7。设计244/实施[960](../40-implementation/960-source-pull-preparation.md)：integration不再只有占位，新增内部适配协议、固定快照/变化游标、72小时重叠与超窗迟到/修订、有界分页/取消、同截至修订、原量去重冲突与稳定摘要、完整范围反复验权。来源不能自批quality，准备数据pending；声明仅unverifiedCompletionClaim。没有生产调用方、DB/任务/游标写入，不发布可用版本；当前机器ingest仍拒绝。

686全量单测（新增20项）、双层types通过；生产build及最终守卫/健康/SHA见960和artifacts/formal-checkpoints/source-pull-preparation.json。无UI/DDL/Prisma/依赖/权限分配变化，62表基线保持，不重复PG/浏览器验收。本批只读内存夹具不当真实来源验收，未push或外部部署。

P1/B03-04/B03仍in_progress。下一优先受控持久接收：配置复核、原量/回执/游标一致提交与失败恢复，再现有后台派发、业务按需任务/跨页面通知、P2共同可用版本和报告依赖/B04。D05来源授权/字段原件/签认、快照/变化游标保证、机器ingest审阅/凭据和环境仍缺，不自签来源完整或声称上线。本段覆盖旧“integration仅占位”，其他依赖保持。

## Launcher图案恢复24px（2026-11-06，最新用户修正）

用户明确launcher外轮廓保持32px、图案恢复原大小。共享ProductLauncher保留size-control-xl，官方Icon lg子节点恢复24px；四工具继续32/16，区域/演示tag与其他Header组件保持。覆盖下方launcher16px结论。

生产build含类型通过tmp/launcher-icon-24-build.log；浏览器常态/展开32×32及SVG24×24、面板打开/Escape关闭、四工具32/16、390px无横溢均已验证。证据artifacts/launcher-icon-24-qa，视口恢复、临时页关闭。规格50/实施660同步；无依赖/DDL/权限/数据链路变化，P1仍按950接续，未push或外部部署。

## Header非标签控件32px统一（2026-11-06，最新用户修正）

用户在P1接续盘点途中要求先修正Header：区域/演示tag除外，其余控件高32，重点launcher。ProductLauncher从control-2xl改control-xl并删除lg子图标，官方sm为16；账户triggerClassName设control-xl；品牌首页链接h-control-xl。原四工具32/16保持，头像及品牌内部图形沿DS。未覆盖DS内部样式/token，未改全画布地图独立Header。

生产build含类型tmp/header-controls-32-build.log通过。CUA1280/904/390全部非标签交互高32/top8，launcher与四工具32×32/svg16，头像触发32；区域24，文档无横溢，配置launcher/账户及业务launcher实际打开通过，warn/error空。证据artifacts/header-controls-32-qa，viewport恢复、临时tab关闭。纯尺寸不新增镜像单测或重复PG/HTTP；规格50/实施660同步，无依赖/DDL/数据/权限变化，无push或外部部署，最终SHA/健康见header-controls-32检查点。

P1仅做了连接器/测量/完成账本及身份能力盘点，尚无本批数据链路实现：integration仍保留边界，真实来源字段样例/签认(D05)未提供，服务机器ingest尚未启用，不能自签完整或声称拉取上线。下一仍按950/设计243推进来源契约与可验证编排、共同版本/报告依赖；P1/B03-04保持in_progress，不重复已完成任务工作台。


## P1数据更新任务工作台（2026-11-06，最新执行）

用户“继续下一步”，接续a43c52a。设计243/实施[950](../40-implementation/950-update-task-workspace.md)：配置域授权列表和真实进度、任务URL刷新/重开/返回恢复、可见页轮询、本页状态通知、输入复核重试与不确定时原命令、结果job精确跳转。完整scope先SQL过滤后分页并末次重验，失权清旧详情/通知。OIDC关闭保持门槛，业务更新面板仅补任务记录入口，不伪造任务或提前推进截至。无DDL/Prisma/依赖/权限分配变化，仍62表。

666单测、366实际PG、52HTTP、types与最终production build通过。独立loopback实际组件验证失败/503/409/配置改变/403、完成通知及1280/904/390；初次旧通知残留已修后复核。正式页面仅门槛和入口验收，不能把QA合成任务当真实运行。日志tmp/update-monitor-*，证据artifacts/update-task-monitor-qa与formal-checkpoints/update-task-monitor.json。

P1/B03-04/B03仍in_progress：上游授权连接器/确认完整水位/拉取回补、业务按需创建和跨页面通知、共同可用版本/报告依赖仍待；下一优先来源契约与可本地验证编排，再P2/B04。真实来源/平台注册和机器ACL/环境、Beta容量恢复/UAT及生产批准依赖保持，无push/外部部署/上线、新聊天或自动任务。本段覆盖旧“正式页面任务工作台待办”，不覆盖其他上线依赖。


## P1已接收增量后台任务基础（2026-11-06，最新执行）

用户“继续下一步P1”，实施940/设计242，接续4e8ef1b。正式API创建/读取/输入隔离重试，审核登记分区与不可变证据清单，确定性任务ID、事务去重、活动/失败任务复用、已派发未完成任务接管、实际回执/结果计数、退避与过期租约等待、原死信审阅替代跟踪。人工aggregate/job_view/job_recover独立权限、完整范围与事务末重验；不借机器主体，原worker离页继续。容量超限明确拒绝不截断；配置修订显式变化，不暗换旧任务订阅。验证结果、最终SHA与健康见artifacts/formal-checkpoints/received-data-update-tasks.json和tmp/data-update-tasks-*.log。

空库baseline新增data_update_request，Prisma同步62表，仅专用本机随机空库验证，未应用已有业务库、未迁移/外部DDL/改依赖/自动赋权。未改页面视觉，固定合成来源检查仍无新增不建任务；processed不是跨域可用版本，不推进标题截至，不改旧报告。首轮新夹具重叠计数失败后改为同一源事件连续修订，最终重跑才计通过。

P1/B03-04/B03仍in_progress：本轮是已接收证据后台基础，不是上游拉取。下一继续授权连接器/已确认完整水位、外部拉取/72小时回补与超窗修订、正式页面任务恢复与通知联动，再P2跨域原子可用版本及报告依赖、地图/决策分析/二级页和B04六场景。真实来源、平台机器ACL/登记与托管、环境/Beta/容量恢复/UAT及生产批准依赖保持，不虚构或冒充同步已完成。未push、外部部署或上线，无新聊天/自动任务。

## B03-04第一子批数据更新检查完成（2026-11-06，最新执行）

用户确认数据更新时间方案后执行，见[930](../40-implementation/930-data-update-availability.md)与设计241。八个业务页面共用标题水位和DS更新面板，分析时段独立；固定来源实时只读检查、共同整点/各源详情、同截至修订和回退/未知规则，无新增不造任务/时间。657单测、6针对检查、50最终HTTP、双层types/build及守卫通过。浏览器总览三源详情、雁塔电信12点保留及1280/904/390面板验证，证据artifacts/data-update-qa。初次旧标题/非法首页hour断言已修后全过，未将失败算成功。

仅来源检查完成，后台同步尚未接入。B03-04/B03仍in_progress；下一依次：授权按需增量任务→修订与跨域可用版本/报告联动→地图/决策分析及二级页收敛与B04六场景。经营历史有效期/新增退出分解、B05治理、B06真实来源和服务器闭环、B07平台环境/Beta容量恢复/UAT及生产批准继续待办。用户要求继续分析重点任务，其他语义排队。不重复已完成BA01–04/B01/B02；无依赖/DDL/权限/真实来源变化，未push/外部部署/生产上线，无新聊天/自动任务。

## B03-03运行能效与未知覆盖完成（2026-11-06，最新执行）

用户“继续下一批”接续[920](../40-implementation/920-runtime-energy-coverage.md)及设计240。无地图运行与能效工作台新增三摘要、独立维度覆盖/未知原因、区域运行对比与电耗贡献、四指标24小时趋势、原地图排序六重点及24行Wh/字节/供电温度证据。电耗与对应字节先汇总再除，零流量站电耗仍计分子，单站强度未知；部分覆盖不当全量，运营商无分表保持未分摊。设备覆盖复用资源图，9302全站/6480移动关联设备均未采集，站级观察不当设备健康或因果诊断。

651全量单测、17回归、47HTTP、双层types/build及172文档/交付/SCA一致/61表静态镜像通过。16条浏览器记录含山区12→18点证据/资源原调查返回、运营商未知与物理覆盖独立、省市县下钻、四趋势、整体切时重置、空分母及固定水位刷新。390/904/1280真实尺寸1H1无整页横溢，卡内滚动、手机切换/小时标签/证据行可读，控制台为空。证据artifacts/runtime-energy-qa；最终提交/健康及清理见artifacts/formal-checkpoints/runtime-energy-coverage.json。

B03-03仅本地合成验收完成，B03整体in_progress；下一B03-04统一快照与刷新语义，再B04通用模块与六场景。历史有效期、真实来源/平台/环境、Beta/容量恢复/UAT及生产批准仍待。无依赖/DDL/权限/真实来源变化，未push/外部部署/生产上线，未新建聊天/自动任务。本段覆盖旧“下一B03-03”。

## B03-02容量质量贡献与证据完成（2026-11-06，最新执行）

用户“继续下一批”接续[910](../40-implementation/910-capacity-quality-contributions.md)及设计239。无地图容量质量工作台新增区域/运营商占用与未接通贡献、加权负载/接通原计数、高负载与低接通重叠/独立覆盖、24小时时点趋势、前六重点站址及24行原量证据。完整同范围沿原selectSites，分子分母先汇总再除，零分母未知，未接通不等同流失或原因；共享站址不跨运营商相加。局部证据小时与整体快照独立，档案/核验/地图带证据小时并可返回原整体范围；档案全站口径明确，无核验来源如实空。历史经营关联模式保持独立。

645全量单测、17回归、46最终HTTP、双层types/production build通过；20条浏览器记录含省市县下钻/移动切片、20→12证据与返回、整体切时清选择、空分母、三指标。390/904/1280真实宽度1H1无整页横溢，表格和24小时图卡内横滚；手机标题及标签拥挤已修，控制台为空。证据artifacts/capacity-contributions-qa，守卫/提交/最终健康以artifacts/formal-checkpoints/capacity-contributions.json为准。

B03-02仅本地合成验收完成，B03整体in_progress；下一B03-03运行与能效及未知覆盖，再04统一快照，其后B04。历史有效期、真实来源/平台/环境、Beta/容量恢复/UAT和生产批准仍待。无依赖/DDL/权限/真实来源变化，未push/外部部署/上线，未新建聊天/自动任务。本段覆盖旧“下一B03-02”。

## B03-01资源关系与有效期表达完成（2026-11-06，最新执行）

用户“继续下一批”接续[900](../40-implementation/900-resource-relationships.md)及设计238。1080站址、3902服务关系、9302去重资源形成双向引用；共用设施每站五项只计一次，无线设备归属对应服务关系，总电表不分摊。台账关系入口携带真实运营商，档案资源/服务页复用DS承载面板，资源详情与反向关联可查。设备没有独立遥测，状态统一未采集；站级供电/温度/电耗仅作关联观测。全部有效期未知，模型投运日期不当历史依据，既有24个月固定同群量不变。

640全量单测、19回归、45HTTP、双层types/build通过；实际台账电信→R2、全站9项/运营商6项/共用5项、总表4关系、反查切换和原列表返回通过。山区12→18点观测同步且设备仍未知，刷新不推进水位。390/904/1280资源/服务两页与手机详情已验，控制台为空，证据artifacts/resource-relationships-qa；守卫/最终SHA/健康见artifacts/formal-checkpoints/resource-relationships.json。原63333由本机代理verge-mihomo绑定而EACCES，未改代理；PORT=0临时loopback预览完成验证，最终URL见检查点。

B03-01仅本地结构与未知表达完成，B03整体in_progress；下一B03-02容量质量贡献，再03运行能效/未知覆盖、04统一快照，其后B04。历史有效期、真实来源/平台/环境、Beta/容量恢复/UAT及生产批准仍待。无依赖/DDL/权限/真实来源变化，未push/外部部署/上线，未新建聊天/自动任务。本段覆盖旧“下一批B03-01”。

## B02报告库与文件版本完成（2026-11-06，最新执行）

用户“继续下一批”接续[890](../40-implementation/890-local-report-library.md)及设计237。显式preview报告中心只列实际成功保存的本机文件；日周月及近12月历史报告绑定页面摘要，完整HTML/JSON/整数计数/来源模板及范围保存IndexedDB。重复内容保留原时间，不同内容独立版本，同范围可查看文件版本；刷新重开从原文件下载，不重算、不伪造正式发布。区域/运营商/周期/搜索、原调查和精确版本往返贯通，主动换区域清除旧对象。正式reports/OIDC/API仍隔离，无失败回退、服务器匿名写、DDL/依赖/真实来源变化。

636全量单测、末次14回归、44HTTP、双层types/build及10原生IDB检查通过；实际日周月/年度保存、重复幂等、同范围两版本、原HTML/JSON下载一致、分析→核验→原版本与筛选空态通过。390/904/1280真实尺寸列表/详情及手机保存行检查，证据artifacts/report-library-qa；守卫、最终提交、健康和清理以artifacts/formal-checkpoints/report-library.json为准。

B02本地合成验收完成，B02-01/02复用BA01–04，未把本机留存当成服务器发布或正式权限。下一优先B03资源关系/有效期、容量质量贡献与运行能效未知覆盖，再B04三通用摘要和六场景收口；本段覆盖旧“下一批B02”。历史有效期、真实来源/平台/环境、Beta/容量恢复/UAT及生产批准仍待。未push/外部部署/上线，未新建聊天或自动任务。


## B01-05跨板块调查完成（2026-11-05，最新执行）

用户“继续下一批”接续[880](../40-implementation/880-investigation-cross-domain-links.md)。地图/台账档案/运营商用量/经营历史及报告/UV核验和记录共用有界原调查上下文，严格内部路由校验；原地域、运营商、小时、周期、精确站址、选区/搜索与地图面板条件可返回。归档会话/event及记录原因筛选保留，主动Header换区域清除旧对象；详情Header识别显式地域。不同来源明确区分，不转移原量/结论或制造HE案件；无UV案例的站址如实为空，地图均新标签页。

632全量单测、末次10导航/地域回归、43HTTP、双层types及最终build通过。实际归档第五事件/原证据、历史摘要报告、地图双向往返和DEMO-00037空态已核对；核验列表/详情/记录等390/904/1280真实尺寸验收与截图见artifacts/investigation-qa，旧B01-04窄屏待验由本批证据接续。文档/守卫、最终提交/健康/清理以artifacts/formal-checkpoints/investigation-links.json为准。

B01合成本机闭环完成本地验收；正式身份/授权来源/服务器事件及权限仍属B06，历史有效期和环境/Beta/容量恢复/UAT/生产批准保留。下一优先B02报告库、版本与下载贯通，再按B03/B04推进；覆盖下文B01-05待办旧排序。无依赖/DDL/来源变化，无push或外部部署，未上线、未新建聊天或自动任务。

## B01-04本机核验人工记录完成（2026-11-05，最新执行）

用户“继续下一批”接续BA04后最新排序，实施870/设计235/规格90。UV隔离场景库新增纯事件规则、service/store与原生IndexedDB：确认→待复核→通过/退回、重开，原因/说明/固定demo-visitor及实际本机操作时间，每事件精确原证据快照。schema1，严格命令不接actor/workspace/目标状态/测量/时间；同事务活动会话fence、revision CAS、命令回执和事件原子，complete后成功。旧command精确重放不退head、同ID异内容拒绝、旧依据不能直接复核、存储损坏/不可用只读不假成功。未知结果原命令重试，跨tab通知只重读；旧草稿固定动作/版本，另一页更新后锁定并要求放弃重核。

/review-history仅preview开放，只列实际发生事件对象，状态/原因/周期/指标/运营商/地域与归档会话可查；点击定位同UV详情历史事件/原证据。用量核验状态先过滤再分页，保留原inputQuery页码用于本机投影。列表/详情/记录的archive会话往返保留，UUID严格v4，非法会话/event/权限字段拒绝。新会话仅切active，旧记录不删且禁止写。HE经营历史依据仍只读，不转换或冒充UV案件。无匿名服务端写API、正式权限/身份、PG/DDL、依赖或来源变化。

626全量单测、末次事件/导航回归、双层types/production build与42HTTP通过；17原生浏览器IDB检查含并发单胜、rollback/receipt原子、旧命令/旧证据、关闭重开、dataset隔离/归档与损坏失败。脚本scripts/review-record-browser.mjs在loopback63334与唯一测试DB运行，不碰应用DB。163文档编号、交付/SCA一致及61表静态镜像守卫通过。无schema变化未重跑PG，不冒充在线SCA。最终日志tmp/review-events-{unit,regression,types,build,http,guards,docs}.log，提交/健康/清理以artifacts/formal-checkpoints/review-records.json为准。

实际UI完成confirm/approve/reopen/confirm/return五事件及刷新保留；第二页编辑approve时第一页面通过，第二页仍锁定approve而非自动reopen。记录列表一个实际对象，定位#5及当时原量；新会话空、旧会话只读可看且list/detail/history往返正确。本机QA旧会话8c3b637a-e53c-4038-80d7-f0aba583748d归档保留，active新会话为空，不虚构业务处理结果。本轮viewport.set返回成功但实际一直1280，904/390不计通过；初拟mobile截图已改default命名，checks记实际尺寸，窄屏放下一切片补验收。初次HTTP旧只读断言失败已修，最终42通过；构建期间未以旧候选结果冒充末次。

B01-04本机功能完成，B01整体in_progress；下一优先B01-05地图/档案/运营商分析/核验双向上下文和来源识别并补窄屏，再B02报告库/B04通用收口。正式身份/授权来源/PG事件及权限属B06，环境/Beta/容量恢复/UAT与生产批准仍待。历史有效期/新增退出归因仍欠，陕西合成、费用预留、退役P2、新产品无迁移保持。未push/外部部署/生产上线，未新建聊天或自动任务。临时浏览器页/63334及视口收尾见检查点，用户页保留；63333运行版本bsmoss-local-review-records及SHA以health为准。

## 经营分析BA04完成（2026-11-05，最新执行）

用户“继续第二批P4”接续BA04，实施860。同资源/周期容量质量及物理能耗关联调查，capacity/efficiency显式history=1历史模式及完整条件返回，原固定快照保留。接通/尝试、占用/容量先汇总再比率；物理电耗每站每小时只计一次，单运营商能耗null不分摊；温度等时样本、备用供电站时样本不当事件时长，联合观察非因果。history-v4，calendar-v3测量不变；省级默认跨域构建预生成，固定合成站址/月缓存。

新增/analysis/report精确历史报告页，未带snapshot自动规范化SHA地址；HTML/JSON下载必须摘要、内容变化409、非法条件拒绝、preview关闭404，正式API401不回退。全量资源过滤/窗口覆盖，原分层/成员页码只作返回条件，不把当前20行当全量。三业务/同比/趋势/区域/站群/运营商/所有匹配站址/跨域分子分母/适用单站证据原值全部入载荷，嵌入HTML非执行JSON，输出转义；构建打包发布DS运行时token，不复制token值，样式摘要绑定报告SHA。未持久发布或审批，无电脑时间伪造修订。

619全量单测、末次8报告相关回归、双层types/production build及40HTTP通过，162篇编号。日志tmp/history-report-all-unit.log与history-report-final-{regression,types,build,http}.log，交付/SCA一致/61表静态镜像守卫通过，无schema变化未重复PG。浏览器单站→容量→能效→报告→依据→经营往返，1489.96kWh/36.4%/98.1%同源；实际下载HTML及JSON载荷一致，西安240站翻页不截断导出，移动报告1关系且能耗未分摊/强度未知。1280/904/390×三页9组无文档横溢且1H1。证据artifacts/history-report-qa。直接file预览被浏览器协议策略拒绝，未绕过、未算离线渲染验收；仅文件内容安全/一致性已验证。首次快速导航读旧条件不计成功，待加载及选项生效后已重核。最终日志/视口恢复/临时tab清理/本地SHA以检查点为准。

BA01–BA04本地工作包完成，下一优先原B01-04原因确认/复核/记录持久人工闭环，再B02报告库和B04通用模块收口；历史有效期新增退出归因、真实来源/平台/环境/Beta/容量恢复/UAT及生产批准依赖保留。无依赖/DDL/权限/来源/正式发布变化，无push/外部部署/生产上线，不新建聊天/自动任务。陕西合成、费用预留、退役P2及新产品无迁移保持。63333版本bsmoss-local-history-report-4及Git以本批health为准。

## 经营分析BA03完成（2026-11-05，最新执行）

用户“继续第二批P3”接续BA03，实施850。单站同类画像排除本站，同区域/场景/站型/互斥共享组/运营商/周期，显式当前区域/所在市/全省参照；不足3座不提供中位/区间/分位/偏差，零中位数不算比率。Header及本站范围不随参照变化。年度/月/日→24小时与四周同期证据，同calendar-v3整数计数；逐服务关系独立核验，历史覆盖前null且至少3参考，不补零。新只读/usage-review/history可切日期/小时/本站支持运营商，展示当前/参考/当日线索/精确计数与SHA，返回保留原范围；SHA绑定整天，切小时不变、切日/指标/运营商变，HE仅追溯编号非持久案件。独立核验场景库隔离，仅复用规则；原B01-04确认/复核/记录不计完成。history-v3，calendar-v3测量不变，正式API/OIDC保持，preview off新依据404。

98相关回归、双层types/最终build、38HTTP、161文档编号通过，日志tmp/station-history-{regression,types,build,http,docs}.log。CUA走通年→2025-11月→11-01日→00小时→依据→01点→移动→返回；参照3/37/170座且本站日均不变，早月0/4/偏离不可判定、SX-DEMO-003同类不足3座、正常线索空态。1280/904/390两页面6组无文档横溢、1H1、卡内表滚动，warn/error空。artifacts/station-history-qa保存截图与checks；视口已恢复/临时tab已清/用户页保留。日期输入仅validity有效才导航，服务器校验保持；切小时raw折叠后初次定位超时、展开后SHA一致，快速resize首帧未稳定不计最终证据。无DDL/依赖/权限/真实来源，未push/外部部署/生产上线。63333最终版本bsmoss-local-station-history-3及Git以本批health为准。下一批BA04跨域/精确历史报告，原持久人工闭环、有效期归因和真实来源/生产依赖保留。

## 经营分析BA02完成（2026-11-05，最新执行）

用户“继续第二批P2”对应设计236的BA02运营商/站群，非退役P2。实施840完成：/analysis区域/运营商/站群三视角共享时间/区域/三业务指标/运营商及场景/站型/互斥共享组；运营商份额、份额变化pp、增减量、贡献pp、正负核对及区域追踪。贡献分母为范围上年同期总量，正负抵消不丢失；零/缺基期未知。固定同群日均/中位数/P25—P75、零量独立/非零分位、日均增长±10%分布、前10站集中度、20条分页和单站下钻/返回；分层只过滤成员、资源条件影响整体。属性与台账共用纯规则；model v2保持calendar-v3测量值，逐站聚合仅服务端，省级默认摘要构建复用。

固定资源无历史有效期，新增/退出贡献不计完成，不虚构事件。正式OIDC/API隔离、显式preview边界保持。无依赖/DDL/权限/来源/生产状态变化。下一批BA03单站同类画像及时段核验证据，再BA04跨域/报告；原B01人工闭环、真实来源及生产依赖不关闭。

最终build和双层types通过tmp/cohorts-build.log及types.log；76领域/链接回归cohorts-regression.log、9台账cohorts-registry.log、36HTTP cohorts-http.log通过，160文档编号。UI实际验证高位270座不改188323.95TiB摘要、下降排序/page2及下钻返回、运营商筛选/区域追踪、站型180及三指标、空交集清除、负14.3pp/负58.8万分钟及早月缺基期。连续点击旧条件覆盖已修为pending禁用；手机action挤压已迁卡内工具行，最终1280/904/390×两视角6组无文档/标题横溢或挤窄、1H1，warn/error空。初次HTTP双转义、等待超时/错误role定位与旧版手机结果均不计成功，实际可见后复核。证据artifacts/business-cohorts-qa；视口恢复/临时tab清理/用户页保留。无push/外部部署/生产上线/新聊天/自动任务。63333最终版本bsmoss-local-business-cohorts-2，Git见本批提交/health。

## 经营分析BA01完成（2026-11-05，最新执行）

用户授权按分析方案及至少12月要求分批执行。设计236定BA01历史/区域→BA02运营商/站群→BA03单站/核验→BA04跨域/报告，优先接续此经营工作包；原B01–B07欠项保留。BA01实现830完成本地验收：history三层与calendarSource共用小时/日/月整数公式，2024-11至2026-10共24完整月、默认近12月并带上一年度基期；旧9/10月数值及地图基准日不变、calendar-v3及报告摘要同步更新。默认省级结果构建预生成，区域读取仅合成站址/月限定缓存；流量BigInt字符串，通话/短信安全整数。同比零基数和缺基期未知，日均可比，来源截至固定。

仅显式preview开启时/analysis提升为经营分析，无新专业模块；正式OIDC/API鉴权保持、无失败回退。DS三摘要卡、年度日期轴/月份点击和键盘、区域→市→县→站→运营商结构，月/年度/季度/自定义366日，Header地域继承。固定资源集合清楚说明，不冒充历史新增/退出/缺测/人工核验；既有档案与报告仍固定日周月，历史精确报告与时段核验后续BA03/04接。

最终build含类型tmp/history-build.log、67回归tmp/history-regression.log＋1链接tmp/history-links.log、34HTTP tmp/history-http.log通过；159编号。CUA省→西安→雁塔→单站4服务、早月缺基期、跨年2天、Home/Enter选2025-11月、短信切换成功；1280/904/390无文档横溢、1H1、904三卡/手机单列/date128，warn/error空。证据artifacts/business-history-qa含overview.png、mobile、regional-table及checks。原生date自动fill未触发React第一次提交无效，分段原生键盘后确认并提交成功；DS容器不透传data初次HTTP失败、包裹层修正后34通过，初次不计成功。视口恢复、tab110关闭、用户原页保留。无新增依赖/DDL/权限/真实来源、无push/外部部署/生产上线/新聊天/自动任务。下一批BA02，不误报全部四批完成。63333最终版本及Git以本批收尾记录/health为准。

## 经营分析年度时间范围（2026-11-05，最新用户补充）

用户基本同意区域—站群—单站—服务关系经营分析框架，要求至少覆盖近12个月。规格60及台账30已固化为后续验收要求：12个完整月趋势、本月未完结单列、滚动12月/自然年/年初至今、月周日聚合及适用小时证据下钻；逐月同比需额外基期，历史准备目标至少24个月，缺基期不伪造。合成历史需有年度季节、周内、区域/运营商差异和可核验样例，同源聚合对账，来源截至不随墙钟推进。检查period-rules当前仍为2026年9/10月固定比较窗口，现状不计年度能力已完成。本轮仅规格与规划补充，无代码、数据、UI或上线变化；后续先完善统一历史模型与聚合，不扩大细粒度单次查询范围替代性能设计。原B01–B07未完成项继续保留。

## vxture Design 门户视觉纠正（2026-11-03，最新）

用户要求参照yucer、引用vxture-Design，否定上版首页。设计229／实施650；发布DS15.0.0／UI12／tokens4已接入，latest声明与pnpm锁版。官方字体／主题／品牌／workbench／PostCSS，自有client providers。全部新门户界面从伞包导入，不引入平行组件和硬编码视觉值，已入CLAUDE.md。

ProductFrame服务器层传preview，ProductChrome为DS48px顶栏、可收侧栏、手机launcher。观澜左／BS-MOSS与描述右上下两行，无竖线。首页指标／三类概况／24小时可切换柱图／占比／表格／入口全为DS。大数用TiB／万分钟／万条并标单位，数字不截断。旧首页CSS删除，旧globals全1177行限制到legacy-metrics路由作用域，不污染DS。五个正式页共享外壳，业务表单主体尚未全转DS，勿说所有页面已重构。地图保留独立全幅和原深链。

首次build失败因react-resizable-panels4.17要Activity而Next15.5.28内置React无此导出；沿DS仓锁4.12.3通过，未修依赖源码或React别名。冻结安装、540单测／双层types／生产build／20HTTP通过；实际pnpm audit prod为199依赖、已知漏洞0，不冒充OSV或远端CI。最终CUA／截图／守卫和扫描、提交／63333版本以artifacts/formal-checkpoints/vxture-design-portal.json为准，日志tmp/portal-ds-*。无DB变更未重复PG。

P01视觉纠正，下一批仍P02站址台账／完整档案，后续页面必须沿DS。真实来源／平台／环境／容量恢复／UAT和生产批准依赖保持，未上线。未推送／部署／建聊天／恢复goal或自动任务。陕西演示／费用预留／退役P2不变。


## 门户首页与产品结构（2026-11-03，最新用户指令）

用户指出地图之外缺少完整业务入口，要求从门户首页梳理补齐。设计228／实施640，50信息结构已更新V0.4并盘点目标8个入口与实际代码差距；台账新增P01–P08。本轮P01首页及导航完成，下一批P02站址台账与完整档案，再P03独立三类分析／贡献与P04异常核验；P05来源质量、P06正式摘要、P07角色审计及P08验收上线仍待。不要把全部规划计为完成，也不恢复已清除goal或bs-moss heartbeat。

首页/直接200不再重定向。显式preview on才动态读map-demo同一规则，固定2026-10-25；1080模拟站址／3902服务关系／全日经营与物理电耗、18点运营状态和地市排名分开标注。无地图引擎、虚构完整率／待办／发布数或11万真实接入宣称。preview off无合成读模型和数字，仅公开入口与登录／未开放状态。正式授权首页汇总待P06。

新增共享ProductHeader和纯公共路由目录，5个正式页面统一首页／分析／报告及管理菜单；目录不是授权结论，实际RP／权益／权限和scope独立不变。地图保留全幅布局、旧深链和默认不选站；顶部可见品牌返回门户。初查发现rail品牌被HUD隐藏，已实际改为顶部可见入口；手机管理菜单原右溢，修为相对header右侧定位。

540单测／双层类型／生产构建与20HTTP通过，最终日志tmp/portal-home-{unit,types,build,http}.log。CUA1280默认client1265及390手机client375均无横溢；菜单右358.67<375，首页无mapcanvas，已核对管理入口／正式未开放提示及首页→无site地图→可见返回首页，最终warn/error为空。截图和checks在artifacts/portal-home-qa；最后运行SHA／BUILD_ID以formal-checkpoints/portal-product-structure.json收尾为准。

无服务契约、DDL、Prisma或依赖变化，不重复实际PG／worker测试，不将静态守卫冒充在线SCA。来源授权／平台／环境／Linux／11万容量恢复／UAT与生产批准仍待，无远端push／PR／CI／外部部署或上线。陕西演示／费用预留／退役P2／新产品无旧库迁移保持。

## 后台任务服务身份适配（2026-11-03，最新入口）

接续20a89ac，恢复时clean；原五项active goal和bs-moss hourly heartbeat复用，不新建、不spawn。本turn有实质progress。设计226／实施620：平台治理仓D:/MyWebSite/vxture/vxture-platform现可读！已读AGENTS／memory／product_210 §2／§3／token-exchange真实签发与服务context／注册runbook；原产品接入通则Claude原件仍登录门槛，未登录／改平台／注册。product_210明确后台Job／周期同步用既有产品confidential client、service无sub、RS256 kid/JWKS、单目标aud／act.sub／workspace_id／scope／300秒exp iat jti。本产品适配不另写跨产品标准；自受众aud=bsmoss实际签发和平台联调仍待，aud=vxture既有channel用途不改。

新增platform/worker-identity：固定workspace与产品client换票，严格签名profile／UUID／实际expiry／TTL≤300／单受众／调用方／scope，无用户sub；32KiB流／16KiB票据／10s／无redirect／既有出口检查，错误固定不泄body或token，单实例singleflight和30秒提前刷新／失败无旧票回退，有效期min(JWT,请求开始+expires_in)，只缓存无token proof。VerifiedIdentity显式user/service；本地ACL审计键s2s:bsmoss源于验签act，不是平台用户或第二套凭据，人用身份禁止s2s:前缀。service仅data plane aggregate／report_generate／report_export_execute，无owner baseline／自动member或role／全范围；禁止人工发布／模板／恢复／下载。

production-ports抽取原RP共用C3／C2／PG grants／feature policy且保留lazy pool；worker-access与workers/runtime提供内部生产组合根，无新HTTP／生产daemon。聚合supervisor将机器identity错误作authorization_denied，不消耗业务重试。无DDL／Prisma／依赖变化，61表空库，无迁移。

534单测（新增9）、353实际PG（新增6）与双层types通过；最终clean-commit build／20HTTP／125篇编号／61表镜像／交付／SCA／ASCII／密钥扫描、SHA及63333版本以worker-service-identity检查点和tmp/worker-identity-{unit,db,types,build,http,guards,ascii,staged-scan}.log收尾为准。本包PG实际空库镜像已比对，无schema变化不重复PrismaCLI。真实RS256／本地HTTP单测含所有claim反例、流上界／响应期限／并发刷新无旧票／固定错误／redirect；PG独立UUID租户经真实签名provider→生产C3和显式PG ACL→聚合／报告／导出循环，缺数不补零，写后DB撤权及provider失败回滚结果／attempt／artifact、聚合独立租约保留、报告pending保留；人工审阅fixture与service独立，service不可发布下载。新增fixture首轮模块路径、TTL跨秒反例及human interactive不能借bundled被正确拒，修测试输入无产品放宽。无UI变化，不重复地图CUA。

下一包优先生产daemon托管（当前runtime只是组合根，不能声称正在生产运行；需审查Docker standalone中worker独立构建／依赖／进程停机、固定受审宿主配置），或I08分层规模／I11角色层级。实际平台注册／aud=bsmoss签发／受审机器ACL和周期登记仍需验收。真实来源签认样例、私有app.env／stack.env、Linux域名TLSregistryDB／远端源码及build-beta-prod、11万3倍突发／安全恢复／UAT／生产批准仍缺；现有只读preflight仍prerequisites_missing／productionLaunch=false，未重复无变化外部轮询。五项1–3本地完成，4–5active，无push／PR／远端CI／真实来源／外部部署或上线。临时PG58874已启用于随机测试库，收尾应stop；63333旧本仓Next PID3840为build需核验停后恢复新SHA。已有自动任务保持ACTIVE，勿重建。

## 受审模板可视化编辑（2026-11-03，最新入口）

接续841f444，恢复时clean；既有五项active目标与bs-moss heartbeat复用，无spawn。本turn有内部实质progress，勿标blocked／complete。设计225／实施610，/settings/templates 新增editor-model浏览器纯转换、实际React表单和6项测试；标题／三类字典指标／合法组件单位粒度精度／显隐／排序增删／单对象或受审rollup显式ID绑定。稳定ID同步绑定顺序，最多16／至少1面板；指标变更清旧绑定，报告日周月同步所有面板，状态设备数／时长转table。字典选项不代表来源已验收或授予权限；新草稿三类全部not_connected，无合成值。

表单／高级JSON共用内存draft，每次编辑清preview／candidate／receipt，非法结构保留原文和修复提示，不丢未知字段。读取清旧reviewRef，新增同步inFlight门闩；503仍锁定全部表单与JSON并沿原command重试，409清上下文。校验入口移到编辑区上方，桌面结果sticky／视窗内滚动、手机自然顺序。只改客户端，不改正式API／权限／store／DDL／Prisma／依赖；上一包347实际PG和PrismaCLI沿已验证证据，本包不冒充新跑PG。

525单测、双层类型／生产build通过；最终20HTTP、123篇编号／61表镜像／交付／SCA／ASCII及staged密钥、提交／63333 SHA见visual-template-authoring检查点与tmp/visual-template-{unit,types,build,http,guards,ascii,staged-scan}.log。新单测验证input不变、精确metricRef、变指标清绑定、报告粒度联动、状态view约束、稳定ID／顺序／上下限和坏JSON。CUA临时tab15／63334合成实际React：表单JSON同步／坏JSON保留／编辑清校验／状态单位联动／绑定／增删排序；默认切换和发布均首次生效回503，再次完全同command仅1结果；新报告全month。桌面client/scroll1265、390×844手机实际375无横溢，最终日志／截图及viewport reset和tab／63334停止以收尾工具为准。证据artifacts/visual-template-qa。主地图未操作；63333原Next PID18180已核验停为build，收尾恢复新SHA；未启动PG。

更正本turn最初选题：核对发现报告生成／导出受审恢复已在550／560完成，未重复实现，当前backlog主表同步真实最新状态。I11可视化子项完成，角色／workspace层级受审配置待；I08分层规模／11万3倍突发待。下一包继续上述独立内部工作；角色需可信DB membership、独立有效配置摘要／CAS和不存在指针的并发fence，不能拿前端role或个人prefs充当正式管理。

真实来源字段／样例／口径签认、C1/C2/C3 live、真实机器provider权威契约／生产托管、私有app.env／stack.env／Linux域名TLSregistryDB、远端源码及build-beta-prod、容量恢复／UAT／生产批准仍缺；沿上一只读预检prerequisites_missing／productionLaunch=false，不重复无变化外部轮询。五项1–3本地完成、4–5active；没有push／PR／远端CI／真实接入／外部部署或上线。陕西演示／费用预留／退役P2／新产品无迁移不变。

## 受审模板发布与默认选择（2026-11-03，最新入口）

接续69b27b9，恢复时clean。既有五项active goal／bs-moss heartbeat复用，无spawn。设计224／实施600；I11新增templates纯规则／端口、PgTemplateStore、config-only校验和独立授权门面、实际RP组合根、/api/templates的GET／POST及preview／selection、/settings/templates管理页。page／report版本规范化，16面板，隐藏绑定和受审rollup全部真实拓扑／完整设备总体验权，映射及受审配置修订摘要pin，缺失／不匹配拒绝；不读测量或聚合，不代替真实来源／质量验收。草稿仅页面内，不持久化。

空库新增template_publication／template_selection_event，61表及Prisma标量镜像；发布trigger原子建版本、选择trigger原子移pointer，连续CAS、不可变版本／事件、DB SHA／session_user／时间。运行角色不再直接insert版本／写默认pointer，偏好改窄共享锁函数，选择排他锁。views.templates.view／publish／select独立，仅入字典不赋role，owner无隐含。新旧模板完整scope并集及末次原身份／有效期／C1/C2/C3再验权；精确subject原command replay不回退当前head，历史范围不按今天配置改写。报告发布不自动生成／发布报告，默认只analysis:default page，回退追加新event。

519单测（新增7）／347实际PG（新增13）／双层types／Prisma／生产build通过；最终20HTTP、121篇编号／61表镜像／交付／SCA、ASCII／staged密钥、提交及63333运行SHA以 reviewed-template-governance 检查点和tmp/templates-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,preflight}.log核对。实际PG含同异command并发、共享／排他fence和旧RR拒绝偏好、历史回退／不复活、配置修订失效、物理flag和新旧范围、写后撤权与SQL全回滚、不可变及伪scope／版本链拒绝。旧模板损坏测试改test-owner helper临时disable／finally恢复immutable trigger，runtime无ALTER。首轮fixture遗留dist默认选择和误写rollup.status列修夹具；并发确实命中template_version_pkey，限定race重试；SQL JSONB减字段括号修正，无产品放宽。

63334合成实际React：默认选择／发布首个成功回503，完全同command重放均只1条；回退旧版、发布不改默认、409清上下文；客户端hash server模块导入被独立构建发现，改type-only，校验留服务器。最终桌面client/scroll1265，390×844实际375，无warn/error，三类中文标签／版本主体北京时间。artifacts/templates-qa含desktop.png／mobile.png／state.json／commands.json；viewport已reset、tab14关闭，用户地图标签未动。专用PG58874和63334收尾应停止；63333原PID23064经确认停以build，最终重启新SHA见检查点。

I11仍in_progress，角色／workspace层级受审发布和可视化编辑待，I08分层规模待。真实来源签认样例、C1/C2/C3 live、真实机器provider权威契约／生产宿主、私有app.env／stack.env及Linux／域名／TLS／registry／DB／远端源码和build／beta／prod、11万3倍突发／安全恢复／UAT和生产批准仍缺，preflight仍prerequisites_missing／productionLaunch=false。没有push／PR／远端CI／真实接入／外部部署／上线；五项1–3本地完成、4–5active，费用仅预留／退服P2／陕西演示保持。

## 受审设备状态与均温分布（2026-11-03，最新入口）

接续d29ae0c，恢复时clean。原五项active goal及bs-moss heartbeat复用，本turn有实质progress，不标blocked／complete、不新建自动化、不spawn。设计223／实施590。I08新增device-distribution纯规则并由object-rollup按设备语义分派；沿原object_rollup_revision只读受审配置，无DDL／Prisma／依赖变化，仍59表空库，无旧库迁移。

设备atom显式deviceId、真实station、service/network=null，单成员单设备，跨来源重复覆盖／同设备伪装第二站址拒绝。预期总体256／成员64上界沿用，未知保留总体。状态六态期末count及deviceMilliseconds／expectedDeviceMilliseconds精确守恒，不推断站址停机。温度basis固定device_mean_bins/ref/mode/scale/递增thresholds（1–12），逐设备原均值分数BigInt比边界，不跨设备求和／均值；计算分数独立64位字符串上界。PG连无发布都校验真实gauge策略。权威／发布stale或不可用、未发布／未覆盖均unknown；部分可信子集仍partial/preliminary。scalar value/knownValue=null，独立distribution及每成员deviceValue／原发布证据；旧interval结构／指纹未加字段。

PG同RR配置／真实归属／成员快照，设备范围独立于allowSiteParameters；整个预期总体含未选来源设备必须授权。reports requiredScope和analysis locator补真实deviceIds，站级flag只用于station_meter，正式报告／发布／执行和下载原末次授权链保持。正式分析分布列表＋总体／有效数据覆盖、无伪单值趋势，原始依据／周月逐日pin／旧报告不变／修订后stale下载拒绝。共享display支持分布，既有支持输入HTML不变，新输入此前不支持，renderer仍v1。

最终512单测（新增7）、334实际PG（新增8场景）、双层types／生产build／20HTTP通过。PG验证守恒／温度边界、重复人口／映射、未覆盖设备授权及站级flag无替代、完整生成→发布→导出→下载、隐藏不读时序、周月每日、写后设备撤权全回滚／SQL故障、同RR并发修订、旧字节／stale下载、能力恢复不复活审阅及新配置恢复。新夹具初期事件periodEnd全日而validUntil半日被正确拒；修窗口后，card的device_count仍被state_view_unit_mismatch拒，改合法state单位。未放宽产品规则。

CUA隐藏tab13＋独立63334合成实际React，桌面实际client/scroll1265、390×844手机client/scroll390，无warn/error；11行分布、未知、总体覆盖可读。发现继承全局dl>div margin-top20px，局部分布归零并固定12px行字体；截图artifacts/device-distribution-qa/{desktop.png,mobile.png,state.json}，viewport已reset、tab已关闭。没有操作用户主地图。临时PG58874 aggregate-data只随机合同库，最终334后应stop；63334收尾应核验stop；63333为build已核验停本仓Next PID2940，收尾恢复新SHA。最终cleanup／扫描／运行SHA见工具和reviewed-device-distributions检查点。

日志tmp/device-distribution-{unit,db,types,build,http,guards,ascii,staged-scan,preflight}.log，最终119篇文档／59表／交付／SCA守卫与staged密钥以工具收尾为准。只读release-preflight仍prerequisites_missing／productionLaunch=false，自动检查缺app.env／stack.env、remote_commits及build/beta/prod环境，人工出口授权来源字段／样例／单位口径签认、C1/C2/C3 live登记、真实机器provider权威契约／生产宿主、11万3倍突发／安全恢复／UAT和生产批准仍缺。没有push／PR／远端CI／真实接入／外部部署或上线。

I08设备分布子项已完，分层规模汇总及容量验证待；I11受审管理员模板发布／角色层级配置也待。下一包可先推进模板发布（已有template_version／selection，现仅owner seed／测试写入，需独立权限、审计／不可变发布、选择回滚及末次完整scope，不能拿个人配置权限当管理员），或分层规模。机器provider不能借aud=vxture通道token冒充产品测量C1。五项1–3本地完成、4–5active；陕西演示／费用预留／退服P2不变。

## 正式分析工作台与账户显示配置（2026-11-03，最新入口）

接续dd1f9b1及上轮未完成的222草稿／4个analysis源文件，本turn继续实质progress，复用active goal和bs-moss heartbeat，不重建、不spawn。设计222／实施580。完成views analysis纯规则／PgAnalysisStore／正式授权门面／RP组合根、/analysis和/api/analysis；正式根入口改为分析，preview仍陕西地图，首页不默认选站和地图布局均未改。

固定服务端analysis:default page模板，最多16面板，同RR读取本人配置与三类；最近7自然周期、单卡周期、设备状态条／温度摘要／精确表格及全量依据。显示换算BigInt，仅有界图形坐标转Number，缺数／过期不连线。未授权绑定不返回，隐藏不读时序；真实scope／实际依赖／物理参数开关及末次C1/C2/C3权限有效期复查，未接入／未发布／依据不可用／SQL错误有区别，不回退演示或补零。直接比率rollup定位不强加未使用依赖。

本人偏好仅visible/order/displayUnit/grain/precision，租户／可信subject／模板版本追加；CAS和commandId、精确历史回执／当前head分开、重置追加空偏好。有限RR竞争重试让同command并发只插一次；首次保存模板选择共享锁，写后撤权／故障全回滚。既有user_preference增加双SHA／DB actor、命令唯一索引、invoker固定search_path捕获／连续revision校验／不可变trigger，仍59表，Prisma同步，无旧库迁移。HTTP复用配置origin／16KiB实际流／严格字段及私有响应头，409／400／503区分；共享reportCommand新增可选错误映射，原调用默认不变。

最终505单测／326实际PG（新增10场景）／双层types／Prisma／生产build／20HTTP与117篇编号／59表／交付／SCA／ASCII／staged密钥扫描以authorized-analysis-workspace检查点及tmp/analysis-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,preflight}.log为准。首轮单测required fixture共用可变scope，改独立快照；新增physical测试遗留无测量mapping与后续同对象重叠被正确拒，finally清理后326全过。没有放宽产品限制。

独立63334合成实际React QA首次已提交回503、完全同command重试只有1偏好、隐藏通话／GB换算／刷新恢复／追加重置、三类状态／桌面和390×844。手机抽屉width390、主页面client375，无横溢；桌面实际1265，无warn/error。artifacts/analysis-workspace-qa含desktop.png、mobile.png、mobile-settings.png、commands.json；viewport reset、临时tab12关闭及专用PG58874与63334停止、63333当前SHA见检查点。无正式路由测试身份后门。

I11本人配置切片完成，总体in_progress；后续受审管理员／角色模板、I08对象分布与分层规模。真实来源字段／脱敏样例／签认、C1/C2/C3 live注册、机器provider权威契约、私有app.env／stack.env、远端源码及build／beta／prod、Linux／域名／TLS／registry／DB、11万3倍突发／安全恢复／业务UAT及生产批准仍缺。只读预检prerequisites_missing；没有push／PR／远端CI／真实接入／外部部署或上线，五项1–3本地完成、4–5active，费用预留／退服P2／陕西演示不变。

## 历史报告周期核验（2026-11-03，最新入口）

接续01ea8ac，本goal turn实质progress，保持active，不重建goal／heartbeat、不spawn。设计221／实施570。新增reports/history、pg-history；export registeredTransaction复用当前登记共享锁、active／subject／全scope／原templateSHA及真实generate和末次授权。已有到期报告不受72小时lookback限制；scope先SQL过滤再LIMIT，每步一份，小时回执排除本小时已核验，先never再最久checked再period/id，无全局watermark，跨小时积压不饥饿，晚提交更早周期可见。

current记unchanged，stale调用原生成核心记inserted/duplicate，结果可仍stale或不完整；精确原revision／结果revision／当时head分开，旧报告和发布不变、不自动发布。已知mapping／rollup缺失／paused／覆盖或ratio basis不可用记blocked，原值保留，其他报告继续；SQL／授权／损坏／序列化／未知异常回滚，报告／head／outbox／check及末次注册全scope授权同RR。原始身份过期也不借当前续期延长。

第59表report_history_check和Prisma标量镜像，无迁移，原／结果SHA和head同租户FK，history_last_check索引；invoker固定search_path触发器核验当前登记subject／template／window／head和scope并集，捕获DB SHA／actor／时间并禁改删清空。读回精确历史登记与旧新报告重建manifest、双SHA／真实列验证，后续head前进不改receipt。WorkerConfig显式reconcileHistory=true增独立lane，32登记×2＋export最多65；未开64登记保持，无真机器provider／宿主伪实现。

最终498单测／316实际PG（新增14）／双层types／Prisma／生产build／20HTTP通过。覆盖数月外、周月逐日、晚提交更早／跨小时公平、物理flag／全scope／owner／末次撤权及SQL／receipt故障、blocked不阻塞、登记pause／旧RR／同worker并发、真实宿主中断恢复、原指纹历史重复不退head、SHA／scope／result／schedule／hour损坏及不可变DB actor。首轮fixture未来clock沿用即期身份被拒，改模拟expiry；误删测量引用mapping被FK拒，改无测量专用mapping后清理；captured stale只能duplicate，不能断言unchanged。无产品放宽。公平性排序追加后全PG／build再次通过。

日志tmp/report-history-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,preflight}.log；115篇／59表、最终SHA／本地63333、专用PG停止见report-history-reconciliation检查点，无UI变化不重复地图QA。只读上线预检仍prerequisites_missing。下一项I11正式配置面板、I08分布／分层规模；需真实来源协议样例与签认、平台注册C1/C2/C3、机器provider权威契约、私有app.env／stack.env及Linux／域名／TLS／registry／DB／远端CI／Beta/prod，11万3倍突发／安全恢复／UAT和生产批准未完成。无push／PR／远端CI／真实接入／外部部署／上线；五项1–3本地完成、4–5active，复用bs-moss，陕西／费用预留／退服P2不变。

## 生成任务受审恢复（2026-11-03，最新入口）

接续cff5450，本goal turn有实质progress，保持active，不重建goal／heartbeat、不spawn。设计220／实施560。一般ReportRecoveryStore／RecoverReportJob替代仅export接口，HTTP显式generation|export；独立reports.jobs.recover无自动赋role。生成首次恢复锁原dead／连续终态，原scope先SQL过滤，当前登记共享锁必须active／同revision／原模板有效，requested_by保持原登记subject、审计另记reviewer，新pending与不可变审计和末次真实授权同RR。

空库58表report_generation_recovery；generation新增recovery_of／scan_job_id，普通扫描窗口唯一索引仅普通任务，反向延迟FK防孤立恢复；同租户parent／root、精确终态FK和invoker固定search_path触发器绑定旧新/root/原登记scope及窗口，捕获DB SHA／actor／时间、禁止改删清空。新generation-recovery模块完整JOIN和双SHA／真实列验证；worker／monitor共享validateGenerationProvenance，原scan manifest精确root／period／dueAt不可改写。恢复可成链，历史命令按原actor/reason/attempt/scope验权；今天pause／换subject不改原receipt，执行仍独立拒绝，不自动发布。

491单测／302实际PG（新增10场景）／双层type／Prisma／生产build／20HTTP通过。真实PG含5次失败及新任务执行、pause换版、CAS/template漂移、独立权限／owner／全scope／固定worker、物理flag、写后撤权与SQL回滚、链式root／普通扫描唯一性／孤立和跨租户FK、登记RR fence／同异command并发、SHA/scope/root/terminal损坏，SQL独立防伪及append-only。首轮SQL JSONB包含加括号修优先级；TRUNCATE夹具需CASCADE才到达append-only触发器，runtime仍42501，无产品放宽。

63334合成实际React QA：首次提交生效回503，完全相同generation命令重放仅1replacement；旧5次失败／固定登记subject／父子双向，409清旧详情要求刷新；1440与390×844实际client1425／375无横向溢出，无warn/error。证据artifacts/generation-recovery-qa，viewport reset、tab11 close。日志tmp/generation-recovery-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,browser}.log；113篇／58表／最终SHA／服务与清理见report-generation-recovery检查点。

下一包历史报告变化传播、I11正式配置、I08分布与规模；不能拿aud=vxture channel token冒充测量C1，不虚构机器provider。真实来源协议样例／口径签认、C1/C2/C3平台注册、app.env／stack.env、Linux／域名／TLS／registry／DB和远端CI／Beta／prod、11万3倍突发／安全恢复／UAT／生产批准仍缺。无push／PR／远端CI／真实接入／外部部署或上线；五项1–3本地完成、4–5active，复用bs-moss，陕西／费用预留／退服P2不变。

## 导出任务受审恢复（2026-11-03，最新入口）

接续48d63b2，本goal turn实质progress，不标blocked／complete，不重建goal／heartbeat、不spawn。设计219／实施550。新增ExportRecoveryStore独立门面／reports.jobs.recover，真实RP及POST /api/report-jobs/{id}/recover，配置origin／实际流16KiB／严格kind=export和CAS／路径。只入权限种子，不自动赋role；owner／view／export／execute不隐含。

PgReportJobStore锁完整scope可见原dead／连续attempt，首次恢复沿report_series发布fence，精确原发布仍活跃、报告完整新鲜、原renderer仍受支持才另建pending0，不重绑新版。新job／不可变恢复审计／末次真实身份租户权益独立权限原和新有效期／实际scope同RR提交。每原任务一次，新任务dead可继续形成链；精确同command／actor／reason／attempt重放只核验原历史作用范围和当前授权，今日撤回不改变原回执，执行下载仍独立拒绝。

空库第57表report_export_recovery和原终态精确同租户FK，Prisma镜像／CLI通过，无迁移。invoker固定search_path触发器精确绑定旧新job、manifest scope／terminal／确定性命令／主体，捕获DB SHA／session_user／时间，禁止改删清空。应用读回完整JOIN和双SHA核验，没有RETURNING缺关联列时跳过验证。详情提供父子恢复链，生成详情两个link为null。UI原命令503重试／锁表单，明确4xx清详情要求刷新，不恢复发布或授予下载。

最终490单测／292实际PG（新增8）／双层类型／Prisma／生产build／20HTTP通过；PG含五次失败／真正执行下载、撤回后历史重放、重发不改绑、全scope及物理站选择／末次／重放、链式恢复、同异命令并发、真实发布RR fence、各种写后撤权和SQL回滚、无关收缩、不可变审计及跨租户FK，篡改manifest重算应用SHA也不能缩scope或换binding／terminal／command。物理夹具首轮误用无站级flag的pub.read被正确拒绝，改DBA读取真实既有event编号后走站级完整授权，无产品放宽，最终292全过。

独立63334合成实际React QA：第一次提交成功返回503，第二次完全相同command duplicate仅一replacement；父子双向回溯／五次旧失败／准确报告链接，1440与390×844实际client1425／375无横向溢出、无warn／error；artifacts/export-recovery-qa含commands.json与两张截图。viewport已reset、临时tab10已close。日志tmp/export-recovery-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,browser}.log，最终111篇／57表守卫、扫描、SHA和63333以report-export-recovery检查点为准。

build已核验本仓63333 Next PID9760并停，收尾需新SHA恢复；专用PG58874 aggregate-data与合成63334收尾停止，仅随机合同库／合成数据。下一项生成受审恢复（必须处理scan provenance／唯一约束，不能简单复制job）、历史报告变化传播、I11配置、I08分布规模；真实机器provider／生产宿主仍需权威契约，不能拿aud=vxture channel token冒充测量C1。真实来源／平台注册／Beta／11万3倍突发／安全恢复／UAT和生产批准仍缺，无push／PR／远端CI／真实接入／外部部署或上线；原五项1–3本地完成、4–5active，bs-moss复用，陕西／费用仅预留／退服P2不变。

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

## I08设备状态可信持久化（2026-11-02）

本轮持续五项目标，有内部实质进展，不标blocked；没有真实来源／环境资料回复，不重复追问。上一包提交62085f5，当前新增197设计／340实施。state-period纯规则绑定设备／来源／核验event能力、1秒至24小时保持策略、完整有效映射、事实／质量／转换／载荷摘要和全对象组合证明。回看max(周期开始-hold,能力valid_from)；未核验／过期事件保留以阻断更早状态。同刻冲突、心跳失效和无证据保持unknown；最高事实修订先选再按对象／时间过滤，移设备／移窗撤回旧值。17分钟等非网格映射切换合法，事件不得跨映射有效期。

新增pg-state-snapshot／state-service／state-store／pg-state-store，物理设备不按运营商归属，有限设备范围＋平台metering＋aggregate/view两道门。pg-repository抽取已有interval CAS／幂等／租约／结果outbox事务，两薄适配器拒绝彼此语义。refresh-snapshot依字典选择可信读取器与计算器，enqueue和execute支持state，所有事实／证明／head／结果／回执共享RR事务。原有BUG-001区间回归保持，新状态并发回归也证明旧快照不覆盖新head；回执故障整体回滚。

DDL aggregate_revision新增state_value JSON，六态十进制整数字符串时长、非负整数转换数、合法末态和数值列互斥，result_payload.value一致；Prisma标量镜像同步，共33表。新产品空库基线，无旧库迁移。无依赖或UI变化，不重复六场景浏览器验收。

395单测（新增7）、97项实际PostgreSQL报告测试（96子项＋父项，新增10）、双层类型／生产构建／Prisma validate通过；69篇文档编号／33表镜像／交付／SCA配置初检通过，最终HTTP／源码ASCII／密钥扫描及本地提交／运行SHA以工具收尾为准。日志tmp/state-{unit,db,types,build,prisma,http,guards}.log。PG专用cluster已stop，仅随机bsmoss_contract库测试，无业务库操作。

I08设备状态内部切片完成，仍缺瞬时结果持久化、跨对象权威汇总；没有state HTTP查询或真实设备连接器。I09仍缺输入事务outbox、持久证据旧／新影响解析与消费进度、登记分区／种子与真实机器身份／常驻进程。随后I11/I12正式查询发布。第4／5项真实资料及Beta、11万容量、安全恢复、业务UAT和生产审批未到位；未push／远端CI／真实接入／部署／上线。目标active、heartbeat bs-moss已存在，勿重复创建。旧演示快照不代表当前全部源码；外部前置最新核验仍以40-live-prerequisites及先前preflight为准，本轮未重复联网核验。

上一包收尾：设备状态提交6b84b92，19HTTP／16文件ASCII／staged gitleaks77.40KB通过；检查点artifacts/formal-checkpoints/device-state-persistence.json绑定SHA／树／BUILD_ID和日志。63333当时session11284，health=bsmoss-local-6b84b92，首页HTTP200；下一包以工具收尾为准。

## I09测量及质量事务变化传播（2026-11-02）

上一goal turn分类progress（状态持久化实际实现、验证并提交），本轮继续内部实质进展，不标blocked。没有真实来源或环境资料回复，未重复追问／联网预检。目标active，bs-moss heartbeat已存在不重复创建。

设计198／实施350。input_change由measurement和quality_decision AFTER INSERT触发器同事务写入，运行时只读，SECURITY DEFINER固定pg_catalog路径／限定源表／完全限定目标表／PUBLIC无执行。冲突重放不产生新变化，捕获失败使原载荷／测量／质量全回滚。input_refresh_receipt追加消费清单，空库共35表，Prisma标量同步，无旧库迁移／依赖／UI变化。

input-refresh提供输出指标／粒度策略和完整有限scope规范摘要，支持不同配置分区重放。pg-input-refresh只有pendingInputChanges与dispatchInputChange内部函数，没有HTTP或生产机器身份。changeId从持久测量解析同来源／事件／分量／指标的全部修订（最多1000），旧新对象必须全授权；从字典找直接／依赖输出，核验direct比率不受次数变化影响。区间按真实半开时间；状态按产品最大保持24h保守扩展并截到映射有效期，防短TTL／pending事件失效后仍抑制旧状态的漏算。目标去重后最多64，不静默截断。refresh-enqueue新增外层绑定事务函数，全部目标可信快照＋job＋消费清单同RR事务；故障或授权过期全回滚。事务try advisory lock防同事件同订阅并发，忙返回busy；重放回执先验当前范围与清单摘要，不新增job。队列执行仍另行按原可靠租约事务完成，消费不冒充聚合成功。

发现器以单事件回执NOT EXISTS查最多64项，不推进created_at或ID高水位。实际PG证明较早事务晚提交，在新事件已消费后仍可发现。当前无变化失败持久退避／隔离，持续失败旧事件可能占满发现页，需要后续正式worker处理。订阅来自服务器受控配置契约，尚无生产登记表；scope或输出改变产生新摘要，不抹掉旧订阅进度。

400单测（新增5）、107项实际PG报告测试（106子项＋父项，新增10）、双层类型／Prisma validate通过；最终生产构建／HTTP／守卫／ASCII／密钥／Git和预览SHA以工具收尾为准。新增验证覆盖原子变化捕获／只读、旧新日期和对象撤回／历史、依赖输出、质量修订、job／消费回执故障和授权过期、并发锁／重启、晚提交、全范围权限与订阅隔离、状态抑制、direct比率和缺依赖权威拒绝。旧missing-quality owner损坏夹具需先删新FK引用的质量变化再删质量，未放宽运行权限；另一失败修正为独立未消费事件，不用已消费同事件其他分量。日志tmp/input-change-{unit,db,types,build,http,prisma,guards,ascii,staged-scan}.log。PGcluster收尾停止状态以工具为准；只随机测试库，无业务库操作。

下一包：I09完成／撤销证明、能力策略及映射／服务有效期变化的捕获和影响传播；变化消费的持久失败退避／隔离、登记订阅／分区种子和真实机器身份／常驻调度仍缺。不能把本批测量／质量outbox说成全部来源变更传播完成。I08瞬时持久化／跨对象权威汇总、I11/I12正式查询发布及真实来源／平台注册／环境／Beta／容量安全恢复／UAT和生产审批继续待办。无push／PR／远端CI／部署／上线。旧演示快照不代表当前全部源码，不重新执行不变的六场景UI验收。

上一包收尾：测量／质量传播提交fbfd5fb，400单测／107PG／19HTTP／类型／构建／Prisma及71篇文档／35表守卫通过，8文件ASCII与staged gitleaks57.12KB无泄漏。PGcluster已stop；检查点artifacts/formal-checkpoints/input-change-dispatch.json绑定SHA／树／BUILD_ID／日志／health，63333当时session25192，版本bsmoss-local-fbfd5fb，HTTP200。后续以工具收尾为准。

## I09来源完成及撤销传播（2026-11-02）

上一goal turn为progress（测量／质量outbox与实际持久历史传播实现并提交），本轮继续内部进展，不标blocked；没有真实资料回复，不重复追问／联网预检。目标active，heartbeat bs-moss复用。设计199／实施360。

source_completion新增数据库生成内部id及workspace/id唯一键，原复合主键不变；input_change扩展四种互斥指针，measurement_id可空，新增legacy_completion_id／completion_set_id同租户外键。source_completion及source_completion_set INSERT触发同事务捕获；运行角色仍不能写证明／变化或改删证据，捕获函数固定源表schema／pg_catalog search_path／完全限定目标，PUBLIC不能执行。Prisma标量镜像同步，仍35表，新产品空库，无旧库迁移／依赖／UI变动。

planCompletionRefresh只规划同指标同粒度同周期，不将确认扩散到反向依赖或粗周期。pg-input-refresh从原账本读证明对象／period／watermark／status／revision／输入及证据摘要，全对象按对象和有效期映射valid_from/id确定定位anchor，再由可信快照核验所有映射。消费清单保存原证明信息和任务引用；两类proof与事实／质量由UNION ALL有界发现，证明按配置输出／精确粒度过滤，仍无全局偏移。授权／幂等／busy锁／RR入队消费回执沿原机制，执行重读最高证明，旧确认晚消费或入队后新撤销不能复活旧完整性。

401单测（新增1纯规则）、117项实际PG报告测试（116子项＋父项，新增10）、双层类型／生产构建／Prisma validate通过。新增覆盖精确目标、确认／撤销降级与历史、旧或失效证明不复活、单段／全对象优先级、状态unknown、捕获／回执故障回滚、source／service／device／粒度拒绝、指针互斥／租户／追加、多映射17分钟状态以及消费快照之后最高撤销。最终HTTP／守卫／ASCII／密钥／Git和63333运行SHA以工具收尾为准，日志tmp/completion-change-{unit,db,types,build,http,prisma,guards,ascii,staged-scan}.log。只专用PG随机合同库，收尾cluster停止状态见工具，无业务库操作。

下一步I09能力策略和映射／服务有效期变化的捕获及历史影响传播、消费失败持久退避／隔离、登记订阅／分区种子及真实机器身份／常驻worker；I08瞬时持久化／跨对象汇总、I11/I12正式查询发布仍待。真实来源／平台注册／环境／Beta／容量安全恢复／UAT和生产审批缺少，未push／PR／远端CI／真实接入／部署／上线。没有新增来源签认或代理审批功能；本批确认夹具只有测试owner写。不要重复1—3演示工作或创建自动化，也不以本地预览称正式上线。

## I09输入消费退避／隔离与恢复（2026-11-02）

本轮继续既有五项active目标。恢复时已有input-dispatch-control／pg-input-refresh／DDL／Prisma及DB测试未提交改动，已接续并完成验证。上一轮有完成／撤销传播实际进展，本轮也有内部实质进展，不标blocked；没有真实资料回复，不重复追问或建立自动化。

设计201／实施370：新增input_dispatch_event追加历史，共36表空库基线／Prisma标量。第1–4次延迟5/10/20/40秒，第5次隔离，DB clock_timestamp生成及判断due。同事件／完整scope和输出配置摘要try advisory lock；工作SAVEPOINT包住规划、可信快照、全批入队和消费回执，失败先回滚再写固定分类，失败记录写错／授权过期／scope变更全部回滚。失败前重新验身份／data面权益／metering.aggregate／完整scope，不存异常原文。数据库连接已断等事务无法继续时不能保证写失败，事件保持未消费待监督恢复。

发现页排除未到期／隔离，runInputRefreshStep处理一个可用事件，后续正常变化可继续；dispatchInputChange直接内部调用也服从退避。reopenInputChange只可恢复quarantined，expectedRevision CAS和reasonRef幂等，追加attempt=0／reopened而不覆盖5次原失败，恢复不等于来源已修复或签认。成功仍只认input_refresh_receipt。

收尾发现并修复原草稿的规划错误漏洞：evidenceHistory在SAVEPOINT外，超长历史／缺映射会逃过退避。新增独立authorizeInputChange：稳定对象验权、EXISTS检查所有历史对象范围（不被1000条返回边界截断），再在SAVEPOINT内读有界证据并规划。重放／隔离／恢复均不能绕过当前范围；缺历史映射仍可按证明稳定对象记录失败和显式恢复。新增DB回归覆盖1001修订末条越权及缺映射证明隔离／恢复／历史保留。

405单测（新增4）、126项实际PostgreSQL报告测试（125子项＋父项，新增9）、双层类型／生产构建／Prisma验证通过。初轮失败为PG带参数多语句夹具，已拆独立语句，最终全DB通过。75篇编号文档／36表镜像／交付／SCA配置守卫通过；最终19HTTP／ASCII／密钥／本地提交／预览SHA见工具收尾。日志tmp/input-control-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。专用PGcluster已stop，只创建删除随机合同库，无业务库操作。无依赖／UI变化，不重复六场景浏览器或在线漏洞扫描。

下一包I09能力策略／映射／服务有效期变化历史传播、登记订阅／种子和真实机器身份／常驻worker；或I08瞬时值持久化／跨对象权威汇总以支撑正式I11/I12。第1—3项演示本地完成，第4项真实来源／平台注册未到位，第5项内部出口和Beta／容量／安全恢复／UAT／生产审批继续未完成。不得把本地预览、空库测试证明或内部服务称真实接入上线。未push／PR／远端CI／外部部署；heartbeat bs-moss复用，费用预留／退服P2／不扩外省演示不变。

输入退避收尾：提交90da987，12文件；staged gitleaks44.84KB无泄漏，7个源码／SQL／测试ASCII通过。检查点artifacts/formal-checkpoints/input-dispatch-control.json，绑定SHA／Git树／BUILD_ID／全部日志摘要与health；当时63333为bsmoss-local-90da987，session72456。405单测／126PG／19HTTP与所有检查完成，PGcluster已stop。

## I11授权周期结果读取（2026-11-03）

同一用户持续任务下接着推进第二个实际切片，未等待外部资料、不重复追问或创建自动化。设计202／实施380。I11从backlog转in_progress，但未完成面板或真实来源验收。

新增query严格选择器（sourceId／mappingId／metric／grain／at／revision），URL4096字符／拒绝重复键未知键与伪造身份范围，正安全整数版本和30位十进制修订，按北京时间自然周期定位。pg-query在单REPEATABLE READ READ ONLY事务读取可信当前输入／质量／能力／完成、稳定主体、当前发布指针和选定历史修订；现支持区间／派生／比率和设备状态。未发布或缺修订null，GET返回404，不造零、不发布或入队。

返回持久结果、当前修订、selection／freshness和当前可信输入摘要。旧指针标older_published_revision，来源／权威／质量／签认／算法摘要改变标latest_input_or_authority_changed，均stale。旧complete原样保留在历史结果内，调用者必须同时显示stale，不当作当前签认。current只是快照一致，不等于complete。单对象摘要检查需有界读取事实，并非全省分页／汇总接口，不代表11万容量。当前能力不可核验仍拒绝历史读取，不绕过授权。

access/aggregate-query按view权限构造有限reader，读取后重查C1／C2交互权益／本地授权和完整scope，主体／workspace／scope变更或两次有效期过期均丢弃结果。runtime基于实际RP cookie接GET /api/aggregates，错误受限、不回显内部信息，成功／错误no-store／nosniff／Vary Cookie（Next还会追加RSC vary项）。preview开关不能授权正式查询，无样例回退。

409单测（新增4）、133项实际PG报告测试（132子项＋父项，新增7）、双层类型／生产构建、20项HTTP（新增preview不能解锁正式查询）通过。77篇文档编号／36表镜像／交付／SCA配置及9个源码／测试ASCII通过。首轮DB失败为新device夹具漏ownership，补tower后全量通过；首轮HTTP失败为测试错误地要求Vary等于Cookie而非包含，改为包含后20项通过，没有放松安全头。日志tmp/aggregate-query-{unit,db,types,build,http,guards,ascii,staged-scan}.log。无DDL／Prisma／依赖／UI变化，未重复Prisma CLI／六场景浏览器／在线漏洞扫描。专用PGcluster已stop，仅随机合同库；无真实业务库操作。

最终提交／密钥扫描／63333运行SHA及检查点以工具收尾为准。后续可补I08瞬时值持久化（当前FIRST_METRICS仅11项，没有已注册gauge，需先完善字典／单位／固定精度而非冒充已接入）、跨对象权威汇总；I09能力／映射／服务变化历史传播及登记订阅／种子／真实机器身份／常驻worker，随后I11面板与I12持久报告／异步导出。五项1—3本地完成，4仍缺真实来源／平台注册，5环境／Beta／容量／安全恢复／业务UAT／生产审批未到位。目标active，不标blocked；未push／PR／远端CI／真实接入／部署／上线，费用预留／退服P2／陕西演示边界不变。

查询包收尾：e38c605提交，409单测／133PG／20HTTP／类型／构建／79之前的77篇编号文档／36表守卫、9文件ASCII和staged gitleaks39.98KB通过；检查点authorized-aggregate-query.json。63333当时session15967，版本bsmoss-local-e38c605，首页200及匿名聚合401。

## I08瞬时温度可信持久化（2026-11-03）

接续既有active五项目标，恢复时已有gauge草稿，已完善并实际验证。本轮有内部实质进展，不满足blocked；真实来源／平台注册和环境仍未补齐，不重复追问或创建heartbeat。设计203／实施390。

新增第12个planned字典定义runtime.environment.temperature_c@1、degC、物理device、gauge_summary／not_additive；测量fixed_point有符号30位unscaled和0–9整数scale，拒绝服务／网络归属。gauge-period绑定核验capability.rules.gaugeAggregation，sample_mean无时长宣称，time_weighted必须durationRef；固定5m／15m／hour／day来源网格，不自动保持／插值。精确mean分子分母字符串，极值保留时间，missing／partial不补零，pending／rejected不参与均值但影响摘要。映射和测量ISO时间规范化，完整全对象completion_set匹配才complete，最高撤销／失效不回退。

新增pg-gauge-snapshot／gauge-service／gauge-store／pg-gauge-store；最新事实先选再过滤设备／日期，移对象或移窗撤回旧输入。共享PgAggregateRepository CAS／幂等／追加结果和outbox，refresh-enqueue／execute及GET /api/aggregates支持gauge，同RR快照绑定输入／head／结果／回执。旧快照不能覆盖新head，回执故障全回滚。DDL增加gauge_value JSON／typed互斥／shape和payload绑定，Prisma镜像同步，仍36表空库、无迁移。gauge策略缺少时长依据纳入source_unavailable退避分类。原11项地图合成样例过滤gauge，不编造温度。

416单测（新增7）、141项实际PG报告测试（140子项＋父项，新增8）、双层类型／生产构建／Prisma validate／20HTTP通过。79篇文档编号／36表镜像／交付／SCA配置守卫通过；最终ASCII／密钥／Git提交和运行SHA以收尾工具为准。首轮PG新增修订传播夹具误用hour，现有自动订阅只day／week／month，改为实际day验证且未放宽调度；第二轮全通过。测试覆盖大整数／超30位加权分子、完成与撤销／策略／质量失效、移设备日期和日周期自动传播、旧新范围验权、错误scale／能力／映射／窗口拒绝、原子回滚与并发保护、SQL形状／不可变权限。专用cluster已stop，仅随机合同库，无业务库操作。日志tmp/gauge-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。无依赖或演示布局变化，不重复六场景UI验收。

下一步I08跨对象总分表权威／去重汇总，或I09能力策略／映射／服务有效期历史变化传播、登记订阅／种子／机器身份和常驻worker；I11正式面板与I12持久报告／异步导出继续待办。温度内部链路不代表真实接入或环境参数UI完成。五项1–3本地完成，4缺真实来源／平台注册，5仍缺内部出口、Beta环境／11万容量和3倍突发／安全恢复／业务UAT和生产批准。未push／PR／远端CI／外部部署／上线；目标active、bs-moss heartbeat复用。

温度包收尾：132e76a提交，24个源码／SQL／测试／根文档ASCII、staged gitleaks65.84KB无泄漏、20HTTP和全部守卫通过，PG已stop。检查点gauge-persistence.json绑定SHA／树／BUILD_ID／日志和health；63333当时session58775，bsmoss-local-132e76a，页面200／匿名正式查询401，工作区clean。

## I09能力与主数据变更证据（2026-11-03）

同一持续任务接着完成第二切片，目标active、实质progress，不标blocked或重复外部追问。设计204／实施400。空库authority_change新表，共37表；Prisma标量同步。source_mapping／source_capability／station_service的INSERT／UPDATE／DELETE同原事务捕获前后完整行与workspace／实体种类／id／正修订、SHA256、session_user数据库actor；无变化UPDATE抑制。按实体事务advisory lock＋唯一键续修订，删除再建不复位；记录无当前行FK，保留删除证据。禁止原位换workspace／id与三源表TRUNCATE，防静默绕过。时间UTC，mapping.version和capability.metric_version转字符串保30位精度。

捕获函数SECURITY DEFINER固定pg_catalog／UTC／源schema表白名单／完全限定目标、PUBLIC无执行。原97 grants已使新integration表只有SELECT，运行角色不能写主数据／伪造或改删账本。SHA仅对PostgreSQL jsonb envelope文本UTF8校验，非业务签认或owner防篡改证明；session_user不是审批人。没有新HTTP／管理批准／机器身份。该账本尚未接既有input_change，禁止宣称能力和主数据已自动传播。

147项实际PG报告测试（146子项＋父项，新增6）、Prisma validate／37表镜像通过。新增覆盖三源全生命周期／noop／重建、30位版本／核验策略引用／UTC、SHA独立校验、捕获失败原写和同事务业务回滚、所有运行DML／函数执行拒绝／伪表白名单／TRUNCATE、租户身份形状哈希、并发修订链和未提交／回滚无幽灵。首次全DB已过，随后补运行INSERT拒绝断言后再全DB，最终结果和cluster停止以工具收尾为准。应用TS／布局未变，沿用132e76a已通过416单测／20HTTP／类型／构建，不重复无变化验收；日志tmp/authority-{db,prisma,guards,ascii,staged-scan}.log。最终文档／交付／SCA／ASCII／密钥／本地提交及运行SHA和authority-change-evidence.json以收尾为准。

下一步必须补authority_change的发现、旧新来源／对象／指标全范围授权、有效期与依赖影响解析、删除或失效后的历史输出、消费回执／失败退避隔离、晚提交和原子批量入队；不得只用最新行代替旧快照或只处理现存映射。另I09登记订阅／种子／真实机器身份／常驻scheduler，I08跨对象权威去重汇总、I11正式面板与I12持久报告／异步导出未完成。真实来源／平台注册、Beta环境／11万容量3倍突发／安全恢复／UAT和生产批准仍缺。五项1–3本地完成，4–5未上线，无push／PR／远端CI／真实部署。保留费用预留、退服P2、陕西演示；heartbeat bs-moss复用。


## I09权威变更影响与消费（2026-11-03，覆盖同类历史待办）

继续既有五项active目标，当前有内部实质进展，不标blocked；没有真实资料回复，不重复追问或创建自动化。设计205／实施410。authority_change同事务追加input_change，pg-authority-impact以原快照、历史稳定对象和既有事实／发布周期规划直接与依赖影响；无全局消费高水位，晚提交可发现。权威可用则入队，不可用则追加精确旧发布修订失效，不制造零或新结果。失效／全批任务／成功回执原子，失败纳入既有退避隔离恢复；成功回执前再验身份／权益／权限／完整scope。旧RR遇新head回滚，direct比率不误受未使用的次数能力影响。

38表空库／Prisma同步，无旧库迁移。稳定映射／能力／服务的对象身份禁止UPDATE或删除重建后重分配，纠错用新身份及事实修订；已有事实或任务引用映射的FK保留，用有效期停用。三语义快照绑定权威generation，精确authorityRevisions清单保存于plan／manifest／结果并纳入指纹，可复算；配置改回旧值也不复活旧complete证明。服务窗口修复：完全停用为not_applicable，实际窗口外事实不混入，最新修订先选、跨界粗粒度仍拒绝。

422单测（新增6）、160项实际PG报告测试（159子项＋父项，新增13）、双层类型／生产构建／Prisma通过。最终20HTTP、编号／38表镜像／交付／SCA配置守卫、ASCII／密钥／Git及运行SHA以工具收尾和authority-impact-dispatch.json为准。日志tmp/authority-impact-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。专用PG仅随机合同库，无业务库操作，收尾停止。无依赖或地图UI改变，不重复六场景验收。

有限scope内最多1000映射／事实窗口、64目标，超限进入异常控制不截断；无事实／发布时不制造空历史日历。下一步I09登记订阅／分区及种子、真实机器身份／常驻worker；I08跨对象权威去重、I11正式面板与I12持久报告／异步导出仍待。五项1–3本地完成，4缺真实来源／平台注册，5未到Beta／11万容量3倍突发／安全恢复／UAT和生产批准。未push／PR／远端CI／真实接入／外部部署／上线；费用预留／退服P2／陕西演示不变，heartbeat bs-moss复用。


## I09登记周期分区与扫描回执（2026-11-03）

本轮接续权威变更包e93ad32（422单测／160PG／20HTTP及全部守卫通过，63333健康版本bsmoss-local-e93ad32，检查点authority-impact-dispatch.json）。同一active目标继续实质推进，不标blocked、不重复外部追问或自动化。

设计206／实施420：新增refresh_partition_revision／head受审配置和refresh_scan_receipt，共41表空库／Prisma，无旧库迁移。触发器严格修订链、同事务推进head并计算JSONB配置SHA；runtime只读配置。FOR SHARE需更新权限，首轮实际PG发现后改为仅开放固定只读锁函数，PUBLIC无执行，不授head UPDATE。配置绑定实际subject、有限scope／输出策略和最多12个种子；内部enqueueRegisteredPeriodic只接分区id，每批64目标，RR共享锁head、可信快照、全批任务和回执原子，成功／重放均重新验权。无事实设备可排队并产生missing；暂停不自动取消旧任务，执行仍验当前grant。登记不制造来源完成证明或机器身份。

425单测（新增3）、167项实际PG报告测试（166子项＋父项，新增7）通过。覆盖配置修订／不可变权限／租户、同小时重放与新小时、新配置／暂停／主体／完整scope、无事实种子、任务回执故障／撤权全回滚、并发fence、配置共享锁和取锁前RR竞态。最终类型／构建／Prisma／20HTTP、85篇编号／41表镜像／交付／SCA配置守卫、ASCII／密钥／Git与运行SHA见收尾工具及registered-periodic-partitions.json。日志tmp/registered-periodic-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log，专用PG随机合同库收尾停止，无业务库操作。无依赖／地图变化，不重复六场景UI。

下一出口：登记分区到输入消费的同事务接线，全省种子自动分区／机器身份provider／常驻调度；I08跨对象权威去重、I11正式面板与I12持久报告／异步导出。真实来源／平台注册／Beta环境、11万容量和3倍突发、安全恢复、UAT与生产批准仍缺；未push／PR／远端CI／真实接入／外部部署／上线。五项1–3本地完成，4–5继续active，heartbeat bs-moss复用，费用预留／退服P2／陕西演示不变。


## I09登记输入消费与恢复（2026-11-03）

前一goal turn为progress：e93ad32权威传播、40de497登记周期分区两批真实实现并提交，最后检查点registered-periodic-partitions.json为425单测／167PG／20HTTP及全部检查通过，63333版本bsmoss-local-40de497。当前turn继续内部实质进展，不满足blocked；未重复追问真实资料或创建自动化。

设计207／实施430。pg-registered-partition共用配置读取器锁head／核验原始SHA和规范语义，周期和输入统一使用。pg-input-refresh抽取事务内发现／消费／恢复核心，pg-registered-input只接分区id及必要事件／恢复选择器。外层唯一RR事务持配置锁，内层SAVEPOINT包住历史影响、可信快照、全部失效／任务和成功回执；失败回滚工作后原子追加退避隔离，不把两独立事务包装成可靠登记消费。inputRefreshSubscription可选登记id／精确修订／原始配置SHA／规范SHA，原无登记摘要保持，父grant未使用范围变化不重置登记进度；登记完整scope失权必须回滚。成功／重放／发现／延迟／隔离／恢复与外层提交前均重新验权。

input_refresh_receipt及input_dispatch_event增成对可空partition_id／revision和同租户配置FK，回执载荷登记与指针必须同时存在并匹配。空库仍41表／Prisma标量，无旧库迁移。新配置／暂停等待旧事务释放head共享锁，内层SAVEPOINT回滚不释放该锁；取锁前head已变更则RR回滚。跨对象修订必须包含全部旧新历史scope，不能单分区静默处理一半；审阅新完整配置后才消费，旧失败／进度不删除。

428单测（新增3）、178项实际PG报告测试（177子项＋父项，新增11）通过；强化登记载荷不能空指针及精确FK断言后再全PG，仍178全通过。覆盖独立分区／修订／无登记、暂停所有入口、完整范围及末次撤权、回执／失败写后回滚、5次隔离恢复历史、并发fence、成功／失败配置锁、取锁前RR竞态、晚提交完成、质量／权威路径、租户指针及旧新对象范围。最终类型／构建／Prisma／20HTTP、87篇文档／41表镜像／交付／SCA配置守卫、ASCII／密钥／本地提交及运行SHA以工具收尾和registered-input-consumption.json为准。日志tmp/registered-input-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log，PG仅随机合同库，收尾停止。无依赖／地图变更，不重复六场景UI。

下一出口全省自动分区／时间分片、真实机器身份provider和常驻scheduler／worker；I08跨对象权威去重、I11正式面板、I12持久报告／异步导出。真实来源／平台注册／Beta环境、11万容量3倍突发、安全恢复、UAT与生产批准仍缺；未push／PR／远端CI／真实接入／外部部署／上线。既有五项目标active，1–3本地完成、4–5未完成，heartbeat bs-moss复用；费用预留／退服P2／陕西演示不变。

## I08受审跨对象区间汇总（2026-11-03，覆盖区间汇总待办）

继续既有五项active目标，当前turn为实质progress，不标blocked、不重复真实资料追问或创建自动化。前包f0e2c6c登记输入消费已clean并有检查点。本批设计208／实施440，新增object_rollup_revision，共42表空库／Prisma，无旧库迁移；运行角色只读，DB触发连续追加修订、并发串行、JSONB SHA／actor／时间留痕，禁止改删截断，不伪称业务签名。

object-rollup纯规则、pg-object-rollup及生产组合根／GET /api/aggregates/rollups实际接通。请求仅rollupId／grain／at，RP／权益／metering.view／完整scope与返回前再验权，演示无正式授权或样例回退。抽取pg-query共享事务内核心，配置／真实拓扑／可信快照／全部发布在一个RR READ ONLY事务，输出精确配置修订和摘要、成员发布证据／authorityRevisions；fingerprint覆盖除自身外的整个响应，calculationFingerprint另留计算摘要。并发新配置／事实／发布下一次可见，不承诺返回后不变。

最多256业务cell或物理站原子、64选定成员，审阅总体明确、不从事实倒推。总分／跨来源同原子互斥；同稳定对象的新旧mapping别名即使分配不同原子也拒绝，防相同series重复算。总表只覆盖同站同服务，实际小区／归属验证；physicalStationCount去重，serviceCount总体与applicableServiceCount周期适用独立。站级电耗映射必须无service／network／device，不按运营商分摊。PRB分母仅prb_capacity_time、接通率voice_attempts，来源intervalAggregation.objectBasis必须与配置basis一致；按分子分母合并，0/0留证据不生成0%。温度和状态不在此求和接口。

authority generation变更和改回旧值不复活旧审阅；需新配置修订。未发布／缺覆盖／来源不可用／旧发布分别显示；旧发布和失效权威不参与可信小计，数据库故障不吞成missing。只有完整已确认总体提供value，其余knownValue独立；not_applicable不拖低有效成员水位。权威不可用时不宣称已证实未发布。

437单测（新增9）／193实际PG报告测试（192子项＋父项，新增15）通过，随后补来源修订证据与可独立校验响应SHA断言再执行最终回归。验证配置权限／真实双连接并发串行／SHA、总分与跨来源去重、完整scope／归属、缺覆盖／未发布、完整确认与过期排除、generation恢复、比率与PRB依据、物理电耗、映射别名、服务不适用、SQL故障、同RR并发暂停和发布、读后撤权。初轮新夹具缺PRB字典FK，后续旧完成证明错误纳入新证明基准导致preliminary；补字典并删除旧证明后绑定基础快照，未放宽产品条件。最终类型／构建／Prisma／20HTTP、89篇编号／42表镜像／交付／SCA配置守卫、ASCII／密钥／Git及运行SHA以工具收尾和reviewed-object-rollup.json为准。日志tmp/object-rollup-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。专用PG仅随机合同库，收尾停止，无业务库操作。无依赖或演示UI变化，不重复六场景。

下一项I11正式面板／I12持久报告与异步导出；I08设备状态分布／温度分布、配置审阅工具、跨分区分层规模汇总仍待，保持in_progress。I09自动分区／真实机器身份和常驻scheduler／worker未完成。本查询只处理有限审阅分区，不称11万站全省原始扫描。真实来源／平台注册／Beta环境、11万容量3倍突发、安全恢复、业务UAT与生产批准仍缺。五项1–3本地完成、4–5未上线；没有push／PR／远端CI／真实接入／外部部署／上线，费用预留／退服P2／陕西演示不变，heartbeat bs-moss复用。

## I12正式周期报告持久快照（2026-11-03）

上一goal turn为progress：受审跨对象区间汇总0ba7ab8提交、工作区clean，reviewed-object-rollup.json检查点含437单测／193PG／20HTTP和全部守卫；预览当时session33385、SHA正确。当前turn继续内部实质progress，不标blocked或重复外部追问／自动化。

设计209／实施450。domains/reports规则／store／PgReportStore，复用现有bsmoss_views.template_version报告模板；严格schema、title／日周月／最多16面板与单对象／受审区域／未接入binding。三类保留各自语义；hidden已配置面板仍保存值与缺数，不因个人偏好变完整。周月保存周期结果＋每个自然日发布依赖，不能缺日还称complete；所有数据在同一RR事务，日独立修订也stale。pg-object-rollup抽取事务内核心；ObjectRollupResult.requiredMetricKeys输出实际依赖，直接比率不强加未使用次数权限。

新增report_series／report_revision／report_outbox，共45表空库／Prisma，无旧库迁移。生成保存完整规范模板、原聚合结果及series／revision／输入／权威／完成证据、周期、必要scope和SHA；按租户模板版本周期唯一，CAS／RR防旧输入覆盖新head，旧指纹重放返回旧版但不回退head。revision＋head＋report.generated outbox及末次再验权原子。运行角色只追加修订和outbox、仅更新series.current_revision。generated不是published或exported，无外部outbox消费者。

新增本地reports.generate，仍在已有metering能力下、仅入种子不自动赋权，owner无生成基线；读用metering.view。createAuthorizedReports与reportsForSession接生产组合根；公开仅GET /api/reports/{id}?revision，生成内部调用暂无命令HTTP／常驻worker。读写都使用同主体／租户／权益／权限／有效期／全部实际scope的末次检查；不相关父grant范围撤回不影响仍有权的历史报告。原记录不变，另返currentRevision／freshness／reasons。模板／输入／质量／完成撤销／权威generation／发布变化可见；区域先比配置修订，配置换版／暂停不读新越界成员。

来源能力不可用而稳定mapping仍存在时，生成先验真实归属和完整scope，再存authority_unavailable（authorityVersion=null，无publication，不断言没有历史发布）；mapping已删则生成等待审阅修复，不猜历史归属。周月主周期不可用仍实际逐日读取，不能造整月同状态。主状态authority_unavailable／not_published不被逐日stale覆盖，但capturedFreshness仍保留逐日旧结果。SQL／授权错误不吞成missing或current。

448单测（新增11）、209实际PG报告测试（208子项＋父项，新增16）全通过。覆盖真实三类完成／撤销、超安全整数、单RR区域＋单对象并发发布、生成与owner权限、历史完整scope和末次撤权、CAS／并发首建／旧RR竞态、旧重放不回退、outbox和写后身份权限范围全回滚、模板／区域配置／权威变更、逐日依赖、周期能力边界逐日实读、租户FK／typed generated／不可变列权限和SQL故障。首轮206PG全过、补完成证据和并发后208全过；增来源不可用／周期边界后主不可用被日stale覆盖导致一例失败，按上条保留主状态且仍标freshness后209全过。最终类型／构建／Prisma／20HTTP、91篇编号／45表镜像／交付／SCA配置守卫、ASCII／密钥／Git及运行SHA见收尾工具与persistent-report-snapshots.json。日志tmp/report-snapshot-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。专用PG仅随机合同库，收尾停止；无依赖或演示UI变化，不重复六场景验收。

下一项报告发布／撤回事件、异步HTML导出、正式报告页面及生成命令／登记调度；I12保持in_progress。I11面板、I08设备状态／温度对象分布和分层规模汇总、I09真实机器身份／常驻scheduler／worker未完成。有限报告查询不是11万站容量证明。真实来源／平台注册／Beta环境、11万3倍突发、安全恢复、UAT和生产批准仍缺；五项1–3本地完成、4–5未上线，无push／PR／远端CI／真实接入／外部部署。既有active目标与bs-moss heartbeat复用，费用预留／退服P2／陕西演示不变。

持久快照包收尾：f27d9a1提交，448单测／209PG／20HTTP／类型／构建／Prisma与91篇文档／45表守卫通过，19文件ASCII、staged gitleaks100.41KB无泄漏。检查点persistent-report-snapshots.json绑定Git树／SHA／BUILD_ID和日志；63333当时session51059，bsmoss-local-f27d9a1，页面200／正式报告匿名401。PGcluster已stop。随后为下一包构建已核验并停止同仓Next PID24432，当前预览状态以工具收尾为准。

## I12报告发布／撤回（2026-11-03）

同一active五项目标接续内部实质progress，不标blocked；真实来源和环境仍缺，没有重复追问或创建自动化。设计210／实施460。publication规则／PgReportPublicationStore／独立授权服务及生产组合根；公开仅GET /api/reports/{id}/publication，可选eventRevision，命令仍内部调用。新增reports.publish显式本地权限只入种子不赋role，owner无发布／撤回基线。

抽取pg-store事务内持久报告／新鲜度核心，普通报告回看复用。发布锁series＋单RR核验当前生成修订、精确SHA、完整与新鲜度，追加event／typed outbox及末次全scope再验权原子。withdrawn必须匹配当前活跃原报告修订与SHA，可撤回已stale或不再最新生成的版本，不改历史manifest／签认／费用。命令绑定expectedEventRevision／commandId／actor／reasonRef，冲突拒绝；旧命令重放仍验原scope和权限，不要求原发布仍新鲜，不复活已撤回发布。命令及读回执独立currentEventRevision／isActive，原报告freshness另返，历史published动作不冒充当前活跃。

新增report_publication_event／report_publication_outbox，共47表空库／Prisma、无旧库迁移。DDL连续链、同租户报告修订及SHA、撤回目标、不可变触发器、数据库时间与outbox动作精确FK；函数固定pg_catalog／目标表白名单、PUBLIC无执行。SQL不替代当前用户scope／业务完整和新鲜度。成功并发只一条连续事件，另一个需显式重试，不能吞旧CAS。发布判断只承诺RR快照，随后事实修订使活跃报告read stale。

453单测（新增5）、220实际PG报告测试（219子项＋父项，新增11）首轮全过；增强旧重放回执及隔离测试事务内outbox动作FK后再全DB，最终见工具。验证完整／过期门槛、显式权限／owner、精确SHA／版本、主体绑定重放、撤回重发与旧命令不复活、输入修订与旧生成head、双连接并发、旧RR、同RR发布后修订可见、历史完整范围／跨租户、末次scope／权限／主体／权益／有效期撤回和outbox故障全回滚、SQL／权限。最终类型／构建／Prisma／20HTTP、93篇文档／47表守卫、ASCII／staged扫描／Git及运行SHA以收尾和report-publication-events.json为准。日志tmp/report-publication-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。只本地专用PG随机合同库，无业务库操作，收尾停止；无依赖／地图布局变化，不重复六场景UI。

下一项异步HTML导出＋下载时重新验当前发布／scope／权限，随后正式报告页面／生成发布命令／登记调度。I12保持in_progress，I11面板、I08状态／温度对象分布和分层规模汇总、I09真实机器身份／常驻scheduler／worker未完。没有外部outbox投递／真实来源／平台注册／Beta环境、11万容量3倍突发、安全恢复、UAT或生产批准；未push／PR／远端CI／外部部署或上线。五项1–3本地完成，4–5继续active；heartbeat bs-moss复用，费用预留／退服P2／陕西演示不变。

发布包最终本地验证补记：220实际PG在加强回执／动作FK后再全量通过，cluster已stop；双层类型／生产构建／Prisma／20HTTP／93篇文档／47表及交付／SCA配置守卫、16文件ASCII全部通过。最终Git／staged密钥和63333 SHA见后续工具收尾。

发布包收尾：f6dfcfe提交，staged gitleaks60.54KB无泄漏、clean；report-publication-events.json绑定SHA／Git树／BUILD_ID及所有日志，63333当时session79929、bsmoss-local-f6dfcfe，首页200／正式发布匿名401。当前turn为构建已核验并停止Next PID23008，后续预览以收尾工具为准。

## I12正式异步HTML导出（2026-11-03）

上一goal turn为实质progress（f27d9a1持久快照、f6dfcfe发布／撤回两包实际提交），本轮继续实质progress，不标blocked、不重复外部追问或创建heartbeat。设计211／实施470。exports纯规则／ReportExportStore／PgReportExportStore／renderPublishedReport／独立授权服务与实际session组合根；公开GET /api/report-exports/{id}状态及?format=html下载，request／run仍内部调用。reports.export与reports.export.execute显式本地权限仅入种子不赋role，owner／view／generate／publish不隐含。

新增report_export_job／artifact／attempt，共50表空库／Prisma，无旧库迁移。命令reportId／publicationRevision／commandId绑定主体及精确报告修订／SHA／rendererVersion，不存token、不重绑定旧发布。持久pending任务只按明确jobId处理，FOR UPDATE SKIP LOCKED＋RR＋SAVEPOINT内可信发布／新鲜度与纯渲染／追加制品，成功回执／任务状态及末次全scope验权同事务；无事务外IO，进程中断全回滚到pending，无悬挂租约。固定分类失败退避5／10／20／40秒，最多5次或terminal，授权／scope／SQL权限和序列化故障全回滚。机器身份当前grant验权，不冒充真实provider或常驻调度。

series新增current_publication_revision，由发布触发器维护且精确FK、runtime不能直接更新。发布／撤回／请求／执行锁同一series，新发布更新行版本，旧RR执行等待后40001全回滚，不能旧快照生成已撤回制品。readPublicationInTransaction抽取共用核心，原GET行为不变。制品2MiB界限、实际UTF8 SHA SQL核验、成功任务及回执精确制品FK，只状态列runtime可改；HTML／尝试不可改删。没有外部文件地址／签名URL或样例回退。

HTML中文三类、模板收起可展开、BigInt转换与原始精确值／单位、比率分子分母及0/0未知、状态秒／期末单设备分布及原毫秒、温度口径／极值时间、逐日依赖和原证据；动态内容全转义、无脚本／外链。主时间改北京时间，原证据UTC。每次下载独立重验RP／权益／export权限／全部原scope／精确活跃发布／完整当前输入，按固定renderer重渲染核对实际SHA；撤回／替换／新生成／数据过期均阻断，历史成功不代表还能下载。no-store／nosniff／Vary Cookie／CSP sandbox／安全attachment文件名。RR只承诺一次快照，不回收已交付离线副本。

460单测（新增7）／233实际PG报告测试（232子项＋父项，新增13）通过；最初GiB断言手写小数错误，独立BigInt整除余数核对后修正夹具为83886080000000010.463006692，原90071992547409931234567890完整保留，未放宽产品规则。首轮231PG，补输入并发／非默认单位／零分母后233；浏览器发现UTC主时间后修正，再执行最终单测／PG／类型／构建和20HTTP，结果见工具。验证三类真实完成、全阶段撤权、主体绑定／CAS、双worker、任务中断、5次退避／dead、制品／回执故障、篡改有效SQL摘要仍拒绝、撤回／重发不复活旧任务、旧RR发布fence、完整历史范围／租户、运行权限／FK／摘要及渲染中来源修订后下载stale。日志tmp/report-export-{unit,db,types,build,prisma,http,guards,ascii,staged-scan}.log。PG只专用随机合同库，无业务库操作，收尾stop。

Browser QA使用CUA隐藏临时页、桌面及390×844viewport，手机内容和视窗clientWidth均375、无横向溢出，标题／长数值／隐藏面板展开与证据入口可读。临时viewport已reset、QA tab7已close，合成artifact artifacts/report-export-qa/report.html；临时63334服务收尾应核验停止。没有操作用户主地图页、没有重复六场景地图验收。最终95篇文档／50表守卫、ASCII／密钥／Git及63333 SHA以收尾和async-report-exports.json为准。

下一项正式报告页面和生成／发布／导出命令，再接登记报告调度／真实机器身份及常驻worker。I12保持in_progress，I11面板、I08对象分布和分层规模汇总、I09常驻调度仍待。真实来源／平台注册／Beta环境、11万3倍突发、安全恢复、UAT及生产批准未到位；未push／PR／远端CI／真实接入／外部部署或上线。五项1–3本地完成，4–5继续active；bs-moss heartbeat复用，陕西演示／费用预留／退服P2不变。

导出包最终验证补记：北京时间渲染修正后的460单测／233实际PG／类型／生产构建／Prisma／20HTTP和95篇文档／50表／交付／SCA守卫、20文件ASCII全部通过。PGcluster已stop；63334 QA服务已核验停止，63333也暂无listener（待新SHA预览重启）。最终Git／密钥／检查点与预览以工具收尾为准。

## I12正式报告工作区（2026-11-03）

接续7fdbf09导出包，恢复时clean，async-report-exports检查点绑定460单测／233PG／20HTTP及63333正确SHA。当前turn有内部实质progress，不标blocked、不重复外部追问或创建heartbeat；五项active目标与bs-moss沿用。

设计212／实施480。ReportStore.list／授权门面／Pg同RR列表，SQL先过滤完整requiredScope（含物理站参数独立开关）再limit+1，period_start与id COLLATE C降序键集分页，严格base64url游标。返回前完整manifest／SHA与全部scope验证、末次union再验权；元数据freshness=unchecked，不冒充当前完整／发布，不吞SQL或损坏记录为空态。无全省总数或容量宣称。

新增POST生成／发布撤回／导出请求和GET列表。HTTP只信配置appOrigin，对实际流16KiB、JSON／无query／严格字段与路径报告匹配，CAS／过期完整性冲突409、范围404／身份401／权限403／故障503及no-store／nosniff／Vary Cookie。服务仍为实际RP／权益／本地显式权限／有限scope和事务末次再验权，无owner隐含、无preview授权。导出run仍内部，不开放用户HTTP。

新增/reports正式列表与宽详情、模板生成、修订回看、三类／逐日／精确原证据、发布撤回／导出任务。无默认选中，RP未配置未开放、未登录实际平台入口。preview关闭首页转/reports，开启仍地图。当前发布GET无事件改200 null，明确历史事件不存在仍404；null不证明报告存在，读失败不能显示未发布或解锁操作。发布针对当前展示且最新完整可信生成；撤回／导出针对明确当前活跃发布，历史详情与其分开。响应不确定保留同commandId重试，同步inFlight锁防重复，切换卸载取消客户端请求不代表服务端回滚。导出轮询5秒最多60次，终态／错误停止，卸载取消。display纯函数从renderer抽出给浏览器复用，HTML renderer版本和内容规则未改。

最终465单测／238实际PG（237子项＋父项）／双层类型／生产构建／20HTTP已通过。PG新增5场景：授权先分页／同周期无重漏、各维度／独立物理参数开关／租户、末次撤权与无关范围收缩、损坏及SQL故障。首轮夹具只期待新建5短信记录，漏已有合法短信空态，修正独立全授权集合并保留前5顺序验证，未改产品过滤。无DDL／Prisma／依赖变化，沿用50表Prisma验证，不重跑未变CLI／在线扫描；编号文档／镜像／交付／SCA配置／ASCII／扫描仍执行。

实际React组件在独立63334合成fixture接口跑发布已提交却返回503、同命令重试、撤回CAS／重发事件3／导出轮询及下载、精确长计数与生成表单。1440与390宽无横向溢出、无pageerror，截图／HTML在artifacts/report-workspace-qa；只是UI合成QA，无正式路由测试身份或真实平台注册／来源验收。没有操作主地图或重复稳定六场景。专用PG随机合同库最终238全过并已stop；临时QA服务收尾核验停。日志tmp/report-workspace-{unit,db,types,build,http,guards,ascii,staged-scan,browser}.log，提交／63333 SHA／正式检查点以工具收尾为准。

下一项登记报告调度／真实机器身份及常驻worker，或I11正式配置面板；I08设备状态／温度对象分布、分层规模汇总继续待办。真实来源／平台注册／Beta环境、11万容量3倍突发、安全恢复／UAT和生产批准仍缺，未push／PR／远端CI／外部部署或上线。五项1–3本地完成、4–5未完成；费用预留／退服P2／陕西演示不变。

工作区包收尾：c840089提交，clean；465单测／238PG／20HTTP／双层类型／构建、97篇编号／50表镜像与交付／SCA配置守卫、23文件ASCII通过，staged gitleaks74.55KB无泄漏。formal-report-workspace.json绑定SHA／树／BUILD_ID／全部日志及合成UI制品；63333当时session42128、版本bsmoss-local-c840089，/reports与预览200，正式全部匿名读写401。63334合成QA与专用PGcluster已stop。当前后续修复为构建已核验停止该仓63333 Next，最终状态以工具收尾为准。

## I12发布替换范围修复（2026-11-03）

同一turn继续实质progress，不标blocked。实际PG新回归复现：较宽流量＋接通率报告活跃发布，审阅模板缩至流量并生成新修订后，只有流量范围的主体可用已知CAS替换旧宽发布。原execute只校验新报告，遗漏间接撤下原发布的范围。commandScope现于追加前读取原被替换immutable快照，核对SHA／完整scope，末次再验权覆盖新旧并集；事件/outbox全回滚。

重复命令沿原事件previousEventRevision取当时前序，原published被替换范围仍属原命令，不能在重放时缩减，也不读今天无关head。撤回后新命令不再隐含旧宽范围；后续扩大当前发布不阻断旧窄命令重放，旧回执仍isActive=false且不回退head。没有DDL／API／UI变化，报告原快照和历史事件不改。

新增1PG场景覆盖前置拒绝、写后撤旧范围全回滚、完整权限成功、原footprint重放、明确撤回／新命令和无关后续head。首轮新夹具的rate对象不是原引用导致displayUnit误count，显式%修正后，修复前准确得到Missing expected rejection；修复后239PG，补无关head断言再全PG239均通过，cluster已stop。465单测、类型／生产构建／20HTTP也通过。日志tmp/publication-replacement-{unit,db,types,build,http,guards,ascii,staged-scan}.log，修复前证据tmp/publication-replacement-regression.log；最终守卫／扫描／提交与63333版本见publication-replacement-scope检查点。

下一项仍为登记报告调度／机器身份与常驻worker或I11正式面板。真实接入、平台注册、Beta环境、11万3倍突发、安全恢复／UAT和生产批准仍缺，没有push／PR／远端CI／外部部署或上线；五项目标active、1–3本地完成、4–5未完成，bs-moss heartbeat复用。

## I12登记报告周期生成（2026-11-03）

接续1e1705a，恢复时已有未提交日历／SQL实现，本turn完成测试与交付。实质progress，不标blocked／complete，不重建goal或heartbeat，不主动subagent。设计213／实施490。

reports/schedule纯规则绑定固定subject、完整有限scope、受审template SHA、day／week／month、北京时间notBefore、延迟0–10080分钟和回看1–168小时。建议日480／周540／月2040分钟、回看72小时。只生成闭合且到期周期；小时扫描不可变清单／每次最多16窗，重复小时返回原清单，竞争busy。新小时重排回看内周期，报告指纹幂等或补齐后新修订。自定义分钟到期可能等下一小时；中断超回看或72小时外变化不承诺自动报告补跑。

pg-schedule内部scan／pending／run无HTTP／真实机器provider／常驻循环。每阶段resolve data-plane generate、固定主体与全登记scope、末次再验；不是只校验当前模板使用范围。pending只列明确授权登记的当前修订due pending、最多25。RR＋head共享锁串行暂停／换版，旧RR等待后40001。FOR UPDATE SKIP LOCKED防重复；SAVEPOINT生成核心、失败分类与DB时间5／10／20／40秒退避，第5dead。未知／权限／42501／40001／40P01全回滚不消耗次数；无事务外IO，进程中断任务仍pending。成功绑定报告历史revision与当时currentRevision，不能把旧指纹重放冒充最新；不会自动发布。

抽generateReportInTransaction，交互PgReportStore行为不改。5新表为report_schedule_revision／head、report_schedule_scan、report_generation_job／attempt，55表空库及Prisma一致，无迁移。SQL捕获session_user与JSON摘要、连续配置head，固定schema SECURITY DEFINER共享锁函数PUBLIC不可执行，runtime不能配置写／head推进／证据改删。成功job精确延迟FK到成功attempt，attempt精确report revision／SHA与currentRevision历史FK。只放行job状态列更新。

468单测／双层类型／Prisma／生产构建通过；254实际PG（253子项＋父项，新增15）全过。旧239回归最初只有50→55表计数断言需更新；新增owner TRUNCATE被FK先拦，改TRUNCATE CASCADE测试不可变触发器，未放宽runtime。并发暂停实测使用pg_blocking_pids确认真实阻塞，runtime无权读其他session语句的pg_stat_activity不能用于此断言。覆盖日周月／缺数／回补／不发布、全部阶段撤权／范围／租户／主体、模板漂移与新版隔离、旧report与current分离、损坏证据、worker／scanner并发、中断／回执双故障、5次dead、序列化权限不计次、共享锁及旧RR、精确成功FK。最终HTTP／守卫／ASCII／密钥／SHA／63333版本见工具收尾与registered-report-calendar.json。日志tmp/report-schedule-{unit,db,types,prisma,build,http,guards,ascii,staged-scan}.log。

无UI改动，不重复稳定地图或报告视觉QA。为构建已核验并停止本仓63333 Next PID21480，收尾需恢复新SHA；PG专用58874 aggregate-data仍需收尾stop，只有随机合同库。下一项真实机器身份／常驻worker、监控与受审dead恢复、历史报告变化传播，或I11正式配置面板；I08对象分布／分层规模仍待。真实来源／平台注册／Beta、11万3倍突发、安全恢复／UAT与生产批准仍缺，未push／PR／远端CI／真实接入／外部部署或上线，五项1–3本地完成、4–5active，陕西／费用预留／退服P2不变。

## 报告worker核心与授权导出发现（2026-11-03）

上一goal turn为实质progress：3207974日历包已提交、clean，检查点registered-report-calendar绑定468单测／254PG／20HTTP、99篇／55表及63333真实SHA，PG已stop。当前turn同样实质progress，不标blocked／complete，不重建goal或heartbeat，不主动subagent。设计214／实施500。

ReportExportStore与授权门面新增pending(limit1–25)，仅reports.export.execute。Pg同只读RR，精确历史报告requiredScope先SQL过滤租户、五维、独立站级参数开关，再available_at／id COLLATE C取limit；逐项jobOf及readStoredReport原manifest／SHA验证，末次scope并集再验。未来due／terminal不列，撤回或stale仍列供执行器保存dead，不让它们永久悬挂；只返回ID，故障／损坏不是空列表。无普通用户队列或run HTTP。

新增domains/workers/rules／loop／report-worker。可信配置固定workspaceId／subject、最多64登记、可选导出、1–25步／轮、1–60秒间隔；不含token／scope。包装C1每次精确租户主体，仍真实C2／显式grant。每登记scan→pending1→run，导出pending1→run；公平轮转独立通道，异常5／10／20／40／60秒单调performance时间退避、成功重置进程连续失败，不改DB作业次数。固定通道索引／状态／分类／退避事件，不回显异常；snapshot是可重置进程内统计，不冒充持久监控。run才安装等待，重复run拒绝，run期间手工tickbusy，tick互斥；Abort停止下一通道及事务派发，空闲timer可中止，在途事务完成后run返回，宿主await后才能pool.end。observer抛错使run明确失败，不静默吞监控故障。没有Next定时器、真实机器provider或生产宿主／进程。

最终475单测（新增7循环行为）、双层类型与260实际PG（259子项＋父项，新增6）通过。新PG覆盖完整授权先分页、scope维度和物理Wh独立开关、撤权／租户／固定主体、撤回终态、事务中断新实例恢复、暂停通道隔离、生成导出联动、扫描已提交后停机留下pending、HTML制品事务中停机等待精确成功且不执行第二个pending。纯单测实查真实60秒空闲timer中止、单调时钟倒退、独立退避、状态不泄密及重入／observer失败。第一轮损坏注入误匹配旧SQL文本，修为真实SELECT s.*,r.*后通过；新能耗夹具引入第二个合法同日报告使旧report-list[0]断言不成立，改为合法可见性some，独立全集合排序测试保持，不改产品行为。无DDL／Prisma／依赖／UI变化，沿用55表PrismaCLI，不重复稳定地图／报告视觉QA。

日志tmp/report-worker-{unit,db,types,build,http,guards,ascii,staged-scan}.log。101篇编号／55表／交付／SCA守卫已过，最终构建／HTTP／扫描／提交及63333以工具收尾和report-worker-loop.json为准。为build已核验本仓63333 PID4540并停，需新SHA恢复；PG专用aggregate-data只随机合同库，260全过后已stop。

下一项聚合周期／登记变化／结果队列的后台宿主链路（须继续保留当前真实grant核验），真实机器provider需平台权威契约，不能拿audience=vxture的channel-token冒充产品测量主体。现有executeRefreshLease只工作前resolve及事务内静态context，接生产worker前应审计提交末次撤权；仅可依据当前元组和实际依赖scope，不扩大权限。还可推进I11正式配置面板、任务监控／受审dead恢复、历史报告变化传播、I08对象分布／分层规模。真实来源／平台注册／Beta／11万3倍突发／安全恢复／UAT／生产批准仍缺，无push／PR／远端CI／真实接入／外部部署或上线。五项1–3本地完成，4–5active，bs-moss heartbeat复用，陕西演示／费用预留／退服P2不变。

## 聚合worker与提交权限复查（2026-11-03）

接续ffa5801，恢复时clean，report-worker-loop绑定475单测／260PG／20HTTP与63333正确SHA。当前goal turn继续实质progress，不标blocked／complete，不重建goal或heartbeat、不spawn；原五项全部范围active，1–3本地完成、4–5继续。

设计215／实施510。新增实际PG写后撤权回归，修复前准确Missing expected rejection，日志tmp/aggregate-worker-regression.log。executeRefreshLease于同RR结果／成功回执写后、COMMIT前重解真实C1／权益／aggregate显式权限，固定原subject／workspace、原和新有效期，核验规范mapped-object-v1元组实际source／station／service／device／物理站参数开关与目标指标；interval按实际inputMode要求真实依赖，direct比率不额外强求次数，状态／温度只自身。无关scope收缩可成功；撤权时aggregate revision/head/outbox、成功attempt/job状态全回滚，独立claim仍leased，不能声称租约也回滚。已识别授权失败supervisor不再记录普通失败，保留租约恢复。

新增workers/aggregate-worker和严格配置：固定真实租户／主体、最多32唯一partitionIds、executeResults、1–25步／轮和1–60秒，禁止token/scope。每登记独立calendar／input通道＋可选result，共最多65；复用报告循环公平轮转／独立退避／互斥／可停止等待。周期沿head锁／receipt，变化沿同事务SAVEPOINT排队和失败control，结果沿grant先过滤／租约fence。暂停不是撤权，旧已排队结果仍按当前grant执行。输入quarantine/deferred明确映射dead/delayed，结果failure_recorded保留中性固定状态，不猜自定义maxAttempts。runRefreshStep前及claim后识别停止；独立claim已提交时保留leased待过期，不启动结果事务；在途实际提交／回滚结束后run才返回。

最终476单测／266实际PG（新增6）／双层类型／生产构建／20HTTP通过，103篇编号／55表镜像／交付／SCA守卫通过。PG覆盖四种值语义各维度写后撤权／原有效期、无关收缩、直接比率／派生实际依赖、物理站独立开关、暂停隔离／周期变化结果闭环、新实例恢复、固定subject/workspace、scan及claim后停止、租约过期重领、run在途停机等待及授权失败无虚假失败回执。扩展首轮误用不存在能耗code、numeric字符串attempt误作number，修fixture显式转换；复用report-src能耗遇到旧两个合法capability歧义，改新独立source/map/cap，无产品放宽。类型提示完整输入联合含quarantined/deferred后明确映射。日志tmp/aggregate-worker-{unit,db,types,build,http,guards,ascii,staged-scan}.log；最终SHA/扫描/预览以aggregate-worker-loop检查点和工具收尾为准。

无DDL／Prisma／依赖／UI变化，沿55表CLI，无迁移、不重复稳定视觉QA。为build已核验本仓63333 Next PID20616并停，收尾恢复新SHA；PG专用58874 aggregate-data仍需收尾stop，仅随机合同库。下一项失败回执自身事务末次授权审计、真实机器provider／生产托管、任务监控与受审恢复、历史报告变化传播，或I11正式配置面板／I08对象分布和分层规模。真实来源／平台注册／Beta／11万3倍突发／安全恢复／UAT／生产批准仍缺，无push／PR／远端CI／外部部署或上线，bs-moss heartbeat复用、陕西演示／费用预留／退服P2不变。

## 聚合失败回执末次授权（2026-11-03）

同一goal turn在f2d03b6完成聚合worker后继续实质progress，不标blocked／complete。aggregate-worker-loop检查点绑定f2d03b69bbae7f609d573307474164195a8f00a4、476单测／266PG／20HTTP、103篇／55表、9文件ASCII和35.55KB staged gitleaks，预览曾为bsmoss-local-f2d03b6、session22480/PID3108、BUILD_ID ktdckLnfNTjUPVqCAsnnC；PG已stop后本批重新start。

设计216／实施520。新增PG回归准确复现recordFailure只前置验权，失败attempt插入后撤权仍返回failure_recorded、failure=null；修复前证据tmp/aggregate-failure-regression.log。PgRefreshJobs内部failed动作新增可信可选提交复查回调，recordFailure始终提供：attempt和job retry/dead写后、COMMIT前重新解析真实C1／权益／aggregate权限、失败事务原身份／租户与原、新有效期，并复用规范稳定对象scope核验。成功结果仍按actual inputMode验证依赖；失败只更新job生命周期，不重查或编造已缺capability／依赖。无关scope收缩仍可合法记录失败。

失败复查或SQL故障使attempt及retry/dead全回滚；独立claim的attempt/token/lease仍保留leased，不是领取次数归零，之后同lease合法恢复或过期重领。低层队列不代替平台授权，内部直接调用仍可信，不能把可选复查暴露用户开关。无DDL／Prisma／HTTP／依赖／UI变化。

最终476单测／268实际PG（新增2）／双层类型通过；PG扩展四种值语义身份／权益／过期／目标范围及失败SQL故障，包含max_attempts=1最终dead边界、原claim保留／同token恢复，以及缺capability和无关scope收缩仍可真实dead。读取SQL夹具先核对state/gauge使用无别名FROM后统一匹配实际共同表名。生产build／20HTTP和105篇编号／55表／交付／SCA、4文件ASCII／staged密钥与最终SHA/预览以工具收尾、aggregate-failure-authorization检查点为准。日志tmp/aggregate-failure-{unit,db,types,build,http,guards,ascii,staged-scan}.log；为build已核验本仓PID3108并停63333，需恢复新SHA；专用58874 aggregate-data收尾stop，仅随机合同库。

215所列失败回执审计已关闭。下一项真实机器provider／进程托管、持久监控与受审恢复、历史报告变化传播，或I11正式配置面板／I08分布和分层规模。真实来源／平台注册／Beta／11万3倍突发／安全恢复／UAT／生产批准仍缺，无push／PR／远端CI／外部部署或上线，原五项全部active、1–3本地完成／4–5未完成，bs-moss heartbeat复用，陕西演示／费用预留／退服P2不变。

## 聚合任务工作台与受审恢复（2026-11-03）

接续8336a94，当前goal turn有实质实施及完整本地验证，不标blocked／complete、不重建goal／heartbeat、不主动spawn。设计217／实施530。新supervision规则／PgAggregateJobStore／授权门面、实际RP组合根、三个API及/operations/aggregation工作台；独立显式metering.jobs.view／recover只入种子不自动授予，owner无隐含。SQL完整对象范围先过滤后limit，六位微秒created_at加C排序ID键集分页，lookahead亦末次验权；详情最多8次连续尝试、DB时钟readiness，无租约token。固定原与当前主体／租户／有效期，读写末次再验权。

dead恢复保留原任务与attempt，另建同对象／指标／周期的新pending，沿原maxAttempts，每原任务一条恢复；恢复链可在新任务dead后另行审阅。新任务／不可变审计／末次授权同RR原子。当前真实policy首次复核，实际inputMode依赖及物理站参数独立范围；缺数仍可恢复并执行missing，不补零。审计存inputPolicy与requiredScope，精确同command／actor／reason／attempt重放只核验历史足迹，不重新套今天capability。新增第56表refresh_recovery、原终态attempt精确FK、旧新任务绑定／SQL provenance与不可变触发器；PrismaCLI通过，空库无迁移。

正式工作台无默认任务、状态筛选／宽详情／执行记录／父子链和复核依据。503或网络不确定保留原command重试并锁表单；明确4xx移除旧详情要求刷新复核。恢复POST配置origin、实际流16KiB及JSON／路径严格校验，no-store／nosniff／Vary Cookie；无预览授权或测试RP后门。实际React合成63334测试首次已提交返回503，第二次完全同command duplicate，仅一条replacement，父子导航／筛选正常。1440及390×844实际clientWidth375无横向溢出，浏览器无warn／error，artifacts/job-workspace-qa含desktop.png、mobile.png、state.json；viewport已reset、临时tab8已close。没有操作主地图。

最终483单测／277实际PG（276子项＋父项，新增9）／双层类型／生产build／Prisma／20HTTP、107篇文档／56表镜像／交付／SCA、23文件ASCII全通过。测试含微秒同时间分页、授权先limit、当前policy缺失、三语义／直接比率／实际派生依赖／站级电耗未知、历史重放policy变化、写后撤权及SQL故障／并发唯一性／不可变审计及跨租户FK。日志tmp/job-recovery-{unit,db,types,prisma,build,http,guards,ascii,staged-scan,browser}.log；最终扫描／提交与运行SHA见aggregate-job-supervision检查点。为构建已核验并停本仓63333 Next PID1848；PG专用58874和合成63334服务收尾需核验停止，仅随机合同库。

I09聚合队列监控恢复子项已完；报告生成／导出队列监控恢复、历史报告传播、真实机器provider／宿主、I11配置及I08对象分布／分层规模仍待，不能称全部调度上线。下一包可推进报告任务监控或配置面板。真实来源／平台注册／Beta／11万3倍突发／安全恢复／UAT与生产批准仍缺，五项1–3本地完成、4–5active；没有push／PR／远端CI／真实接入／外部部署或上线，bs-moss复用，陕西／费用预留／退服P2不变。

## 报告任务持久监控与结果跳转（2026-11-03）

前一goal turn为实质progress：f3053820fe6ea29688724f4635976fd2358639ef聚合工作台包已提交clean，aggregate-job-supervision检查点绑定483单测／277PG／20HTTP／107篇／56表及实际63333 SHA，BUILD_ID cIB64TILgYdP-YHOFJ6WS、session7886。PG和63334均已停。只读release-preflight实际仍缺app／stack私有文件、远端源码和build／beta／prod环境；未执行远端变更。当前turn继续实质progress，不标blocked／complete、不重建goal／heartbeat、不spawn。

设计218／实施540。新增ReportJobStore规则／PgReportJobStore／独立授权门面、实际RP组合根、GET /api/report-jobs与/{id}?kind和/operations/reports工作台。reports.jobs.view只入权限种子不分role，owner／generate／export／execute不隐含；运维查看者可不同于登记worker，但原worker执行主体绑定不改。SQL生成按原登记完整scope、导出按历史报告requiredScope先过滤再limit，六位微秒requested_at＋C排序ID键集分页，游标绑定kind／status、lookahead亦末次授权。只读RR返回前原／当前主体、租户、权益、显式权限、有效期及完整必要scope重验。

复用生成job／scan／schedule配置与导出job及持久报告校验，生成成功核对原模板／周期／摘要及原登记scope；详情最多5条连续attempt，校验失败分类和精确结果／制品。任务无独立持久租约，不造“执行中”；到期ready／delayed、终态及登记换版保留原与当前修订。旧结果revision与执行时currentRevision分别显示；导出不具有历史head信息，currentRevision=null，不编造最新。监控不读HTML、不宣称当前可下载，打开正式报告重新验权及发布／freshness。错误／损坏不能冒充空态。

正式页面双队列／状态／分页／宽详情／时间线／精确报告链接，无默认任务。/reports显式report＋revision严格解析（大整数不Number化，重复／非法拒绝），登录returnTo保留合法链接；无参数仍无默认。窄屏跨工作区导航保留。空库只加独立权限与4历史索引，仍56表，Prisma标量镜像／CLI沿上包已验证，无迁移／依赖升级。

最终487单测／284实际PG（283子项＋父项，新增7）／双层类型／生产build／20HTTP全过；109篇编号／56表镜像／交付／SCA、24文件ASCII通过。PG测试两队列微秒同时间分页、隐藏设备先limit、原登记完整scope／查看者主体、物理站开关、5次失败、精确旧结果与执行时新head、并发暂停换版RR、各阶段末次撤权和无关范围缩小、损坏／SQL错误。初轮新夹具假设存在单上行导出但实际不存在，改取真实既有服务级导出的完整原scope作为独立基准，未放宽条件；随后284全过，再补高时间隐藏设备、旧结果／新head及常量复用最终284仍全过。

CUA隐藏tab9通过实际React＋独立63334合成接口检查无默认选择、双队列切换、空态筛选、精确9007199254740993链接与9007199254740994分开显示、5次storage失败和移动导航；1440及390×844实际client375无横溢，浏览器无warn／error。artifacts/report-job-monitor-qa含generation-desktop.png、export-mobile.png；viewport已reset、tab已close，没有操作用户主地图。合成fixture不替代平台／来源／UAT。专用PG58874仅随机合同库、最终284后收尾已stop，63334合成服务已核验停止。

日志tmp/report-job-monitor-{unit,db,types,build,http,guards,ascii,staged-scan,browser}.log；最终SHA／扫描／运行版本见report-job-inspection检查点。构建前已核验并停本仓63333 Next PID24172，收尾恢复新SHA。报告队列受审恢复、历史报告变化传播、I11配置和I08分布规模仍待，不能称全部正式调度或上线。平台token-exchange service模式无用户sub，再确认aud=vxture通道token不能充当产品测量C1；真实机器provider／宿主需权威契约。

真实来源／平台注册／Beta／11万3倍突发／安全恢复／UAT及生产批准仍缺；原五项全部范围active，1–3本地完成、4–5未完成。没有push／PR／远端CI／真实接入／外部部署或上线，bs-moss复用，陕西演示／费用仅预留／退服P2不变。

## 用量报告周期切换位置统一（2026-11-03）

用户插入UI优化：日／周／月按钮组在三个报告页面位置不同。仅为日报与周月报上下文增加共享mw-report-context，固定范围minmax(0,1fr)／周期auto／运营商100px三列，避免原auto margin与calendar flex差异；窄屏范围独占一行，按钮固定下一行左侧。报告header操作区最小28px，下载链接异步加载不再推动按钮。没有业务计数／接口／DDL改变，原未提交worker-host包保留且尚未收尾，不宣称整包已交付。

生产构建、双层类型与20HTTP通过，3个UI源文件ASCII、diff check通过。CUA在63333真实React页面切换三周期：桌面1280x720三个按钮组均x1009/y171.6667/w76.3333/h23.3333；390x844均x63.6667/y206.6667，document宽390、scroll宽390。周报加载前后坐标不变。artifacts/report-control-alignment-qa含desktop.png、mobile.png、alignment.json；临时tab17已关闭、viewport已reset，未改用户主tab筛选。日志tmp/report-control-alignment-{build,types,http}.log。63333当前session68634，APP_VERSION=bsmoss-local-report-alignment，基于3c573c8加当前工作区构建，不能冒充clean commit。无远端push／部署／正式上线；原五项目标及worker宿主收尾继续保留。

补充UI要求：周／月报日期区间已合并到区域名称之后，移除报告独立mw-calendar-window行；usage模式保留原有日期展示。周报“陕西省 · 2026-10-19 — 2026-10-25”、月报“陕西省 · 2026-10-01 — 2026-10-31”，同一span不换行且title可查看完整范围。最新生产构建通过，CUA周／月实际单行均12px高、独立日期行0；390宽文本client/scroll均302px且nowrap，无裁剪／换行。证据inline-window-{desktop,mobile}.png及inline-window.json在既有QA目录；临时tab19已close／viewport reset（tab18被外部移除后按真实空清单重开），63333 session84030恢复，版本bsmoss-local-report-inline-window；当前仍工作区构建，未提交／未部署。

后台宿主收尾独立进展：显式--no-deps排除DB/Redis依赖重建、env-update将既有etc也收紧0700，补up失败不推进指针测试；重建bundle后5制品/脚本冒烟全过，128篇／61表／交付／SCA守卫过。540单测、354实际PG为先前同包日志，专用PG58874已经stop。2026-11-03T01:51只读远端预检仍缺源码、build/beta/prod环境及私有配置，本机无Linux Docker；未远端变更。前一goal turn是报告对齐实质progress，本turn有上述交付修复及日期UI实质progress，不标blocked/complete。宿主文档/清单/扫描/提交/检查点尚待收尾。

## 当前交付包收尾（2026-11-03，用户指定执行第1步）

用户只授权当前包收尾，不恢复已清除goal或已删除bs-moss heartbeat。18bc61f为已提交报告布局，后台宿主包在此继续审阅。对比原失败日志：Git Bash脚本30秒到期、降级观察10秒到期；并发单测/类型复核虽未再次失败，但相同脚本约5秒升到19秒。保持产品10秒身份请求截止，测试观察改performance单调30秒并检查进程提前退出，外层45秒；合成shell等待60秒、外层75秒。TCP即时resetAndDestroy与静默连接分别验证，静默分支实际约10.7秒后degraded；失败计数>=1且成功步0，不将观察恰好首轮当业务保证。

修改后并行540单测／双层类型／6制品及脚本冒烟通过（tmp/worker-host-final-{unit,types,smoke,bundle}.log）；脚本负载下21.6秒。354实际PG再次全通过，含结果写入abort到COMMIT后pool关闭，日志worker-host-final-db；专用58874随机合同库cluster已stop。128篇编号／61表静态镜像／交付／SCA配置守卫通过；无DDL／Prisma变化，不重复未变PrismaCLI。生产构建／20HTTP／ASCII／staged密钥／Git提交和运行SHA以收尾工具及artifacts/formal-checkpoints/worker-process-host.json为准。

宿主严格UUID/固定机器subject/有限lane/绝对路径（validate也核health路径），原子健康、全部lane观察后才running、失败退避不假绿、SIGTERM等待在途事务再关pool。独立CJS及同digest可选Compose、凭据分离、etc0700/JSON0644、on候选validate、off仅两个命名worker、--no-deps不连带重建DB/Redis，up失败不推进指针。无自动赋权、来源补造或报告自动发布。Linux镜像/Compose/POSIX信号仍未实测，不将Windows强制清理算优雅信号通过。

台账补当前收尾与I09/I12托管代码状态，实际平台注册/自受众live签发、机器ACL/登记和目标Linux运行、真实来源、Beta/容量恢复/UAT/生产批准继续未完成；第2步新版六场景验收不自动扩展本次范围。不push/PR/远端CI/外部部署或上线，陕西演示/费用预留/退役P2不变。最终commit/checkpoint可直接读取，无需再改源码以回填SHA。

## 产品顶栏与官方面板（2026-11-03）

用户明确指定先优化header，参照yucer并使用完整vxture Design，未扩大到P02资源台账。设计230／实施660。三栏launcher用Popover＋ShellPanelContent／Row／Section，真实href、当前高亮、选中关闭及窄屏边界；新增观澜观测点／视野／波纹SVG，仅品牌图形色值。ShellHeaderTools沿yucer帮助／消息／配置三项，/settings实际页面复用官方显示偏好和现有模板／任务入口。ShellUserMenu＋ShellPreferencePanel完成头像面板、主题／密度／字号持久化；仅简体中文。服务器投影真实active RP身份，访客无在线点或虚构管理员，真实登录后才显示切换／原生POST登出；无角色或token进入chrome。消息通道未接入，不编造未读数。地图布局独立未改。

540单测／双层类型／Next生产build／21HTTP通过，新增配置页公开但不授予身份的边界检查；134篇编号／61表静态镜像／交付／SCA守卫通过。无DDL／Prisma／依赖变更，不重复PG和worker制品。CUA1280×900三栏、配置跳转、消息抽屉及390×844用户面板／选中关闭通过；偏好切换后刷新仍保留，最后恢复浅色／标准，document宽和scrollWidth均390，warn／error为空，viewport已reset。artifacts/header-qa含截图和checks.json，tmp/header-{unit,types,build,http,guards,ascii,staged-scan}.log留证。真实身份联调未获平台凭据，未声称通过。

最终提交／运行SHA见artifacts/formal-checkpoints/product-header.json；63333先以工作区header-review构建验证，收尾恢复精确提交身份。无push／PR／外部部署或生产上线；P02资源台账仍待，陕西演示／费用预留／退役P2不变，不重建goal／heartbeat或额外聊天。

## 顶栏三条批注修正（2026-11-03）

按用户浏览器批注：页面名及演示标签从右端移入左槽，以ShellHeaderDivider分隔完整品牌区；观澜放大为DS display-xs，系统名称单行heading-1，删除顶栏BS-MOSS。未在品牌内部增加竖线，右侧官方操作组及用户面板保持。787×871实际观澜30px／系统名18px，配置中心x393／演示x457，品牌区末端x368、分隔符x376；390与1280文档宽等于scrollWidth，无横向溢出，浏览器warn／error为空。手机继续隐藏系统名称及页面上下文以保留操作空间，viewport已reset、临时tab24已关闭。

生产构建／双层类型／21HTTP通过，tmp/header-sizing-{build,types,http}.log与artifacts/header-sizing-qa留证；仅排版未重复单测／PG／worker。设计230和实施660同步；最终提交及63333运行身份见artifacts/formal-checkpoints/product-header-sizing.json。无外部部署、依赖、DDL或授权变化。

## 品牌字号收敛与系统名称（2026-11-03）

用户认为观澜30px过大，改用官方ShellProductTitle的20px产品标题；系统名称18px保留。新名称明确为“站址多域运营监管”，同步门户、两个预览页面和共享BRAND.displayName及产品定义；代码bsmoss／BS-MOSS及英文全称未变。生产构建含类型检查通过，tmp/header-brand-size-build.log。CUA787×871核验实际20px、新名称准确、文档宽／scrollWidth均787；截图artifacts/header-sizing-qa/brand-name-final.png，viewport reset、临时tab25关闭。仅字号和名称，未重复业务单测或数据库。无外部部署。最终提交及本地运行以实际Git／health为准。

## 业务应用与配置管理独立域（2026-11-03）

用户要求管理业务单独域，业务侧从header配置icon进入。设计231／实施670，信息结构V0.5。业务launcher／侧栏仅首页、地图、分析、报告；管理域/settings下含管理总览、指标模板、聚合与报告任务，同域launcher／侧栏及存储键独立，提供返回业务。两个任务目录及页面／客户端／样式实际移动settings/operations，修相对引用和登录returnTo；旧operations page仅307兼容。消息抽屉移除任务链接，避免第二套管理入口。API、真实权限／结果报告精确版本链接不变，目录不是授权。地图就地显示工具和个人外观偏好保留；未来来源／规则／角色／审计管理亦归本域，未生成占位页面，不新增网络域名。

541单测（新增导航两域互斥）、双层类型、生产build、22HTTP通过（新增管理前缀／旧307／业务导航隔离），tmp/management-domain-{unit,types,build,http}.log。浏览器1280业务launcher／齿轮进入／独立侧栏／模板任务切换、390管理launcher／报告任务点击关闭／返回业务实际URL / 通过，390与787无横向溢出，warn/error空；artifacts/management-domain-qa，viewport reset、临时tab26/27关闭。无DDL／依赖／授权规则变化，不重复PG或worker测试。初次类型检查发现ShellNavSection要求title，为返回区加业务应用标题后通过；浏览器初次同名按钮定位冲突以aria交集消歧，无产品缺陷。

文档／交付／静态schema／SCA、ASCII／密钥扫描与最终commit／63333运行身份以收尾工具和artifacts/formal-checkpoints/management-domain.json为准。无push／外部部署或生产上线；P02和真实来源／环境／UAT等原依赖继续保留，不恢复goal／heartbeat。

## 业务板块统一收进launcher（2026-11-03）

用户要求业务页面不使用统一导航，板块全部收集launcher。业务域sidebarMode固定hidden、sidebar=null，真正卸载业务侧栏及其占位；首页／地图／分析／报告全局入口继续在业务launcher。配置管理域保留专属侧栏、launcher与齿轮入口。信息结构V0.5、设计231和实施670同步。未改地图独立布局、业务接口或权限。

生产构建（含类型检查）及22HTTP通过，tmp/business-launcher-{build,http}.log。CUA1280实际launcher进入分析／报告均成功、业务mainX=0/mainWidth=1280且nav数0；齿轮进入管理域mainX=256、导航存在，返回业务成功。artifacts/business-launcher-qa含首页／launcher截图及checks.json，viewport reset、临时tab28关闭。此项仅布局不重复单测／PG。最终Git提交及运行health可核对；无外部部署。

## Launcher入口卡与间距（2026-11-03）

接续a232d1e，用户要求条目间距、整体布局及icon。两域launcher以官方EntryCard替换紧凑ShellPanelRow入口，使用xl面板留白／分组间距、md条目间距和lg入口内边距；保留两栏分组／手机单列，增加简短用途、24px官方图标及当前勾选。管理图标faders／stack／database／calendar，公共portalIcons同步管理侧栏；不加业务侧栏或跨域管理入口。

实际发现ShellPanelContent默认保持顶栏焦点使Tab离开launcher，经官方onOpenAutoFocus槽与首入口ref修复；Tab逐项、Enter进入模板、Escape动画后关闭均通过。1280／787／390实际宽度无横溢，手机四管理入口及返回完整可达，业务分析／管理报告跳转正常、选中关闭；warn／error为空。artifacts/launcher-layout-qa含两域桌面、管理手机截图及checks.json；viewport reset、临时tab29／30关闭。生产build含类型、22HTTP、136篇文档编号、ASCII及diff通过；tmp/launcher-layout-{build,http,docs}.log，源代码仅launcher一处，无DDL／依赖／业务权限变化，不重复PG与单测。设计231／实施670同步。最终提交与63333运行身份以Git／health为准，无外部部署，不恢复goal／heartbeat。

## 顶部双入口、五类业务与决策大屏（2026-11-03）

用户否定旧站网监管／分析报告混组，先给计划后明确开始执行。本批设计232／实施680、信息结构V0.6：业务launcher顶行门户首页／决策大屏、官方Separator水平分割，再分站址资源／运行监管／经营分析／异常核验／报告中心；已实现能力归位、未交付只读规划中无href，无空壳业务页。官方EntryCard／ShellPanel组件及图标保持，宽屏五列、中屏3／2、手机单列且顶行2入口并排，业务无统一侧栏。配置管理齿轮／独立管理导航不变，管理域本身仍显示管理launcher。

新增独立/board而非地图别名，服务器显式preview开关、严格city/hour解析／拒绝重复未知字段，关闭开关不加载或泄漏合成数据。复用queryMap和queryOperatorUsage生成三类时段指标、同小时全省地市比较、当前范围24小时与运营商；同地市／小时更新完整快照，无默认选站。官方面板／指标／图表／控件，独立MapLibre矢量边界／聚合站址，不共享旧工作台Zustand、不请求遥感或在线瓦片；颜色读取DS实际语义变量随主题变，地图相机不改统计范围。下钻保留city/hour，回放2.5秒且返回新快照才推进，地市选择停止。原生全屏及失败提示，页面首版仍有滚动区域。

实际发现MapLibre未分层position覆盖工具类致地图0高，改局部board-map-canvas；--color-primary别名未输出，改真实--primary变量。手机PanelCard操作槽挤压标题，专题改独立工具行；最终390标题22px单行。5项相关单测／门户类型／生产构建含类型／24HTTP／138篇编号／ASCII与diff通过，tmp/business-domains-{unit,types,build,http,guards}.log。CUA1440／787／390分组、顶行双入口、内滚动、无横溢；西安240站／小时18→17／自动回放17→18暂停、报告深链／全屏按钮进入退出／深浅主题都成功。artifacts/business-domains-qa含截图及checks.json，warn/error空、恢复浅色／viewport、tab31关闭。未重复无关PG／worker测试。

P01a本地首版完成，P02站址台账／档案下一批、P03经营独立视图与P04核验仍待；正式大屏读模型及真实来源／环境／UAT仍缺，不能称正式上线。最终commit／扫描／63333运行SHA以Git和health为准；无push／外部部署，不重建goal／heartbeat，陕西／费用预留／退役P2不变。

## 顶层入口尺寸统一（2026-11-03）

用户认可层级，要求门户首页／决策大屏不再放大。业务顶行改用与下方相同响应网格，p-md替代大内距／手机竖排卡片；独立层级和分割线保留。CUA1440所有入口约217.6×77.2px、390均310.7×77.2px，无横溢，证据artifacts/launcher-global-size-qa。生产构建含类型通过，tmp/launcher-global-size-build.log；纯布局不重复业务单测、HTTP及PG，设计232／实施680同步。viewport reset、临时tab32关闭。最终Git与本地health为准，无外部部署，P02仍下一批。

五分组标题精简：用户要求无描述介绍，业务launcher分组标题行移除description，仅图标与站址资源／运行监管／经营分析／异常核验／报告中心名称，功能入口副文保留。生产构建含类型通过（tmp/launcher-group-title-build.log），CUA1440核对五行文本仅名称，截图artifacts/launcher-group-title-qa/desktop.png；viewport reset、tab33关闭。设计232同步，纯文案展示未重复业务测试，无外部部署。

## 站址管理与全宽业务工作台（2026-11-03）

用户要求推进站址管理，强调强业务视角／可多层，并明确业务页面布满全屏。设计233／实施690／信息结构V0.7。新增/site-registry纯规则和独立demo-store、/sites全宽台账与关系视图、/sites/[id]六层档案（总览、资源设备、服务关系、运行状态、经营用量、资料来源）；launcher／首页入口和地图双面板统一档案双向链接。站址与运营商关系独立计数，稳定资源编码和共用设施／运营商设备归属；时段状态与日周月累计分开，经营总量、总量／日均环比、历史四周同小时参考波动和运营商明细复用原规则，单站HTML直接导出对应站址周期。台账返回保留列表筛选及分页，档案展示全站关系，不把列表运营商过滤当权限。

桌面header下宽高100%，地域／台账内滚动、分页底部；首页／大屏及正式分析／报告移除最大宽度，管理域未改。手机实际发现宽表固定操作列挤压站名，最终改官方ListCard列表＋MetricListCard摘要，档案宽表保留内部滚动。无自建控件、依赖或token；中文文案显式覆盖官方英文默认。严格参数拒绝未知／重复／非陕西或错配县／非法枚举及数字，预览关闭台账与档案不加载合成模型，正式API匿名仍401。

9相关单测、双层类型、最终生产构建和26HTTP通过，140篇编号与交付守卫通过；日志tmp/site-registry-{unit,types,build,http,guards}.log。CUA1440实际main／workspace均x0、y48、1440×852，分页底部876；787／390无文档横溢。地域县筛选／检索、关系下钻、行内展开、排序分页、空态重置、六层／小时／日周月／经营指标、真实HTML下载、地图双向及launcher均验证。1920首页和大屏内容约1904.7（滚动条留宽）、maxWidth none；浏览器warn/error空。artifacts/site-registry-qa含台账／档案桌面手机、经营截图与checks.json；下载文件约622756字节，仅合成数据。viewport已reset、临时tab34关闭。最终提交／运行SHA以Git和health收尾为准。

P02仅陕西演示首版完成，正式资源管理仍需真实主档及权属／验收资料、服务有效期和受审版本、设备来源与生命周期、维护导入及变更审计。不提供伪造成功的新建／编辑／审批，不写正式证据。无DDL／Prisma／迁移／费用或退役影响开发，不重复无关PG合同。平台真实授权来源、Beta／容量恢复／UAT／生产批准仍缺，未push或外部部署上线，不重建goal／自动任务或聊天。

## 站址台账标题与地域树批注（2026-11-03）

用户批注重复大标题浪费空间、县级字小且过挤。取消/sites的重复ViewHeader／演示数据标识，header独立承载域名称与演示标识；公共域名称桌面heading-2 16px／foreground／semibold，手机text-label 14px，保留业务识别，系统名与演示标签手机隐藏。地域日期及地图入口合为一行小工具区，树直接从header下起排。省市县14px正文，区县Button xl 32px替代sm 20px，保持gap、缩进导线、选中高亮及aria-pressed。无数据规则／权限／依赖／DDL变化。

最终生产build含类型、26HTTP、140篇编号及两源码ASCII／diff通过；tmp/site-layout-{build,http,docs}.log。CUA1042×871表格顶部487.06降到412.44，区县实际14px／32px；787与390无横溢。手机初轮标题16px因不足半像素省略，改14px后完整显示；县级筛选联动、范围地图链接及787配置管理顶栏兼容通过，warn/error空。artifacts/site-layout-qa含desktop.jpg、medium.jpg、mobile.jpg、checks.json；viewport已reset、临时tab36关闭。设计230／233、实施690同步，纯布局未重复业务／PG测试。最终Git与63333运行身份以工具及health为准，无push／外部部署，不重建自动任务或goal。

## 资源概况收起与压缩（2026-11-03）

用户认为四张统计卡无需常驻。/sites使用官方Collapsible默认收起，触发按钮与日期／地图同行；展开以MetricListCard紧凑显示四项。单位放数值旁，完整四字名称避免手机省略；手机地图入口保留可访问名称的图标。查询key重挂载后收起，不新增存储偏好；范围计数不变。

最终build含类型、26HTTP、140编号、源码ASCII／diff通过；tmp/site-summary-{build,http,docs}.log。1042表格顶部412.44→258.09，增加154.34px；787／390无横溢，鼠标／Enter／Space开合及省市统计一致。移动初轮长标签截断，缩短名称并将单位放数值后实际完整；筛选导航后首次操作遇到浏览器目标失效，读取新DOM再操作成功，非产品错误。artifacts/site-summary-qa收起展开桌面手机截图及checks；viewport reset、tab37关闭、warn/error空。设计233／实施690同步，无业务／PG重复测试、依赖／DDL／权限变化或外部部署。不恢复goal／自动任务。

## 系统字号统一与站址工具行整理（2026-11-03）

用户批注系统名应同功能域字号、列表头乱且高。chrome系统名改heading-2 16px／semibold（去font-brand），功能域同档，观澜20px保留。台账头部上下文行地域日期＋小时／概况／地图；业务行切换＋搜索＋运营商＋筛选／重置，数量只留分页，删除主体说明。SiteFilters使用官方Popover和单选NativeSelect组装草稿，五维一次应用，换市清县，Escape取消后重开恢复；清空草稿需应用。手机三行业务工具，概况与地图图标，日期完整。新增文件filters.tsx，未引新依赖或基础原语。

最终build含类型、26HTTP、140编号、四源码ASCII／diff通过，tmp/site-toolbar-{build,http,docs}.log。CUA1042工具24.23px、列表顶258.09→152.23；两名称实测16px，配置域同档；787／390无横溢。组合筛选、取消、清空、搜索、重置及小时／运营商／关系切换保留通过；自动UI初轮连续操作未等待路由导致观察旧状态，已逐步等待精确URL确认，无产品逻辑变化。手机city/county/scene一次应用保留telecom／relations／hour17，日期113px无裁切。artifacts/site-toolbar-qa桌面手机／筛选截图与checks，warn/error空、viewport reset／tab38关闭。首轮构建重置图标拼错被类型拦截，改官方refresh后通过。Python别名不可用，改原生PowerShell文件编辑；没有安装工具。设计230／233及实施690更新，最终Git／health以收尾工具为准；无push／外部部署，不恢复goal或自动任务。

## 站址检索、站点类型与刷新（2026-11-03）

用户要求先分析后三条批注落地。采用官方InputGroup／Addon／Input，查询放大镜在框内可点击，回车同form；桌面公开overlay-md宽度token实测224px，手机整行。SiteQuery／SiteRecord增加siteType严格枚举all／ground／rooftop，地面站／楼面站与已有塔房模型一致，不捏造室分或微站；与业务场景分维，参与站址／关系交集、计数、分页、链接，档案总览显示。外放运营商移入六条件筛选弹层，草稿一次应用／取消／清空原语义保留。

原小时是2026-10-25合成运行快照，不是同步时刻。台账移除小时下拉，只读源时点；手动刷新通过router.refresh重新请求模型，页面层读取后生成readAt并按北京时间显示，不在客户端点击即报成功，不改变源日期，不触发或宣称上游采集。旧hour深链兼容、地图和档案保留历史分析。刷新保留当前类型／地市／运营商／page2和搜索草稿，实测readAt从12:31:21.599Z更新到12:31:21.812Z。

10项相关单测、双层类型、最终生产构建、26HTTP和140文档编号通过，tmp/site-controls-{unit,types,build,http,docs}.log。CUA1042／787搜索224px、无横溢，390原数据时点被挤压，收紧官方图标Button手机内距后日期client／scrollWidth均148完整显示。类型与运营商交集、手机4关系过滤为电信1关系、ground检索楼面站为空、Enter和框内按钮查询、档案类型及返回上下文／重置通过。artifacts/site-controls-qa含桌面／中屏／手机／筛选截图和checks，warn/error空；viewport reset、临时tab39关闭。无DDL／依赖／权限／真实接入变化，不重复PG合同；设计233／实施690／信息结构同步。最终commit与63333运行身份以Git及health为准，无push／外部部署或自动任务。

## 站址域字号统一（2026-11-03）

用户认为整个页面字号乱，统一检查台账、共享header、筛选浮层及六层档案。实测主要是同类主数据12／14、操作12与输入14混用，档案18标题。站址局部CSS使用官方body／label／heading-2字号行高字重token：12辅助、14正文操作、16标题、20既有品牌与关键读数；主表数据提升14、按钮名称字重500、辅助常规，档案标题18→16。header已是16系统／域名及20品牌无需改；状态徽章保留12，不改全局token／DS包。筛选portalled内容独立site-filter-panel作用域。手机刷新HH:mm，秒数保留title／aria，源时点仍完整不受压。

生产build含类型、26HTTP、140文档编号、ASCII及diff通过，tmp/site-typography-{build,http,docs}.log。CUA1042／787／390无横溢，390日期client／scrollWidth均148；浮层标签／选择／按钮14、标题16；台账表头／地域／负载14，档案总览／资源／经营只有12／14／16／20四档。artifacts/site-typography-qa含四页面截图与checks，warn/error空，viewport reset、tab40关闭。一次同名资源设备按钮定位冲突，限定档案分层navigation后验证成功，无业务失败。纯排版无DDL／依赖／权限或数据改动，不重复业务单测及PG；最终commit与63333身份以Git／health为准，无push或外部部署。

## 行内服务关系四卡同行（2026-11-03）

用户批注展开四家应同一行，太窄才弹性换行。expandedContent从固定sm2／xl3列改flex-wrap，子卡basis／min-width为公开overlay-sm（标准160px）、等分余量，纵向排列运营商／业务类型／服务档案，保留14／12字号和官方Button。初轮继承宽表949.9导致第4卡在视窗外，修列表container-type:inline-size、展开宽min(100%,100cqw)，按实际可见空间排布。

最终build含类型、140编号、ASCII及diff通过，tmp/site-relations-layout-{build,docs}.log。CUA1042展开721.3px、4卡各164.8且同top、最右986在列表1018内；660自然3＋1，5关系1042自然4＋1，无丢项及页面横溢。档案入口DEMO-00946?tab=services及当前页签实际成功。artifacts/site-relations-layout-qa含desktop／narrow／five截图与checks，warn/error空；viewport reset、tab41关闭。纯布局无数据／权限／DDL／依赖改动，不重复业务单测／HTTP／PG。设计233／实施690同步，最终Git／63333身份以实际工具为准，无push／外部部署或自动任务。

## 透明操作列与三竖点ActionMenu（2026-11-03）

用户要求操作列背景透明与所在行一致、操作按钮统一三竖点＋panel。站址／关系／档案运营商明细三个rowActions改发布版官方ActionMenu，手机ListCard.actions同步；台账／关系菜单有已有档案、运行状态、经营用量，档案菜单保留原运营商小时地图入口。无虚假编辑／删除动作。site-action-table局部取消操作格sticky遮罩（透明锁列会与滚动内容穿透叠加），随表横滚；进一步将hover背景移到tr、同行td全透明，消除hover仍有操作白块问题，不改全局token／DS包。

最终build含类型、140编号、ASCII／diff通过；tmp/site-actions-{build,docs}.log。CUA1440透明TH／TD、hover整行accent且9格均透明；1042菜单可达、右界1002，390无横溢、面板右界286。台账runtime／business、关系services保留view、档案mobile小时地图深链、手机菜单和Enter／Escape通过。artifacts/site-actions-qa含四截图和checks，warn/error空、viewport reset、tab42关闭。首次中屏退场动画未完即点击引发观察null，核对closed后重开等待visible成功，无产品失败。无数据／权限／DDL／依赖变化，不重复业务／PG；设计233／实施690同步。最终Git／63333以实际health为准，无push或外部部署。

## 站址工作区底色、地域收放与运营商负载（2026-11-03）

用户指定DEMO-00037档案参照优化台账，并补充运营商重复档案按钮。地域树改普通flex流中的独立veil面板，四周lg24px／间距24px、圆角语义描边；内容及列表取消白底外框，沿用官方workbench淡蓝灰底，header保持独立bg-card，无新增地图／瓦片／颜色或全局token。面包屑前桌面收放按钮，官方Breadcrumb省市县及上级链接保留排序筛选；稳定SiteRegistry外层保留收放状态，查询key内层仍重置草稿与展开。窄屏地域仍从筛选进入，不显示无效侧栏按钮；县级中屏收紧刷新／地图文字防止与日期重叠，手机自然两行保留完整源时点。

运营商名称用官方Button asChild承接原服务档案链接，去掉重复动作；底部小时／负载百分比及官方Progress。当前页operatorLoads由既有siteHour按站址＋运营商＋小时投影，不用全站负载或份额冒充，不受运营商筛选／关系列表分页截断；新一致性测试覆盖0／12／18时、第二页及空结果，逐项对照档案，相关9项通过。最终build含类型、26HTTP、140编号、ASCII／diff检查日志在tmp/site-workspace-*。

CUA1440面板x24／y72／256×804，主区透明；收起后主区x24／宽1392／右1416，筛选保持收起、Enter／Space开合通过。1042省市县不重叠，四运营商各162px同top299.77、右界992.66在列表内，值87.2／90.2／93.2／96.1%；名称实际进入DEMO-00037服务页签并保留排序。初轮新留白导致四卡差少量空间，展开内距md→sm后四卡同行。787／390无文档横溢；浅深主题上下表面区分、表格透明，恢复浅色。artifacts/site-workspace-qa保存展开／收起／县／主题／中屏／手机／运营商截图及checks.json，warn/error空、viewport reset、临时tab43／44关闭。首次县级等待URL因参数排序不同超时，核对实际URL及DOM后确认正确，无产品导航失败。

设计233／实施690同步，最终提交／63333身份以Git和health为准。无权限、业务计数、DDL、依赖或真实接入变化，未重复PG／worker；无push、外部部署、goal或自动任务。

## 台账时段负载进度条（2026-11-03）

用户要求列表时段负载沿用运营商卡片进度条，数字缩小淡化。registry本地loadIndicator组合复用官方Progress，桌面列和手机卡片同步；百分比body-small／muted-foreground、上方右对齐，手机保留时段负载标签。值仍是既有站址used／capacity×100，不新增阈值或数据规则，排序／宽度／其他布局不变。

生产build含类型通过（tmp/site-list-load-build.log），140编号／ASCII／diff收尾检查；纯展示不重复业务单测、HTTP、PG。CUA1440实测12px／muted色、官方8px条高，首值62.9%对应62.94237；点击时段负载实际URL /sites?sort=load，20行原始值升序正确；390文档无横溢且20条手机进度条可用。artifacts/site-list-load-qa含桌面／手机及checks，warn/error空、viewport reset、临时tab46关闭。设计233／实施690同步，最终commit与63333运行身份以Git／health为准；无外部部署或依赖变更。

## 地域面板省级汇总与统一收放（2026-11-03）

用户批注陕西省未对齐且无需选择态，改面板标题map-pin＋陕西·资源＋右对齐1080全省总数，删除树中重复省级Button，直接从地市开始；全省返回保留内容面包屑／筛选入口，地域数字含义不变。收放改官方ShellIconButton／sidebar，与配置域ShellSidebarNav相同；非active。实测基础按钮对aria-expanded=true仍填底色，局部site-region-toggle仅在非hover且非focus-visible覆盖透明，保留键盘环和交互反馈，不改全局token或DS包。

生产build含类型通过（tmp/site-region-heading-build.log）、140编号／源码ASCII／diff检查；CUA1042展开与收起常态均rgba(0,0,0,0)，鼠标及Enter／Space收放、刷新保持通过；选西安后标题仍1080，面包屑实际返回/sites。artifacts/site-region-heading-qa含desktop.png／checks.json，warn/error空、viewport reset、临时tab47关闭。设计233／实施690同步，无数据／权限／DDL／依赖变化，纯布局未重复业务单测、HTTP或PG。最终Git／63333以health为准，无push或外部部署。

## 站址域隐藏滚动条（2026-11-03）

用户要求地域树隐藏滚动条、列表隐藏或极细，统一隐藏原生条。site-region-scroll／台账site-table-scroll／内部DataTable overflow-x-auto使用scrollbar-width:none＋WebKit伪元素display:none；移除stable gutter，保持原overflow及横向滚动。树和列表新增命名region、tabIndex=0与官方border-width-medium／ring的focus-visible轮廓，键盘可达；仅台账局部，不影响档案或全局。

生产build含类型（tmp/site-scroll-build.log）、140编号、源码ASCII／diff通过。CUA1042两区scrollbarWidth none／webkit none、gutter auto／overflow auto；树653高内容1027，列表655高内容1894，表格内宽714内容961保持横向空间。树PageDown到374且列表0，列表PageDown到573.33且树374，Home两者归0；文档宽1042无溢出。artifacts/site-scroll-qa含desktop.png／checks，warn/error空、viewport reset、临时tab48关闭。纯布局不重复业务／HTTP／PG，设计233／实施690同步，无依赖／DDL／权限变化。最终commit及63333以Git／health为准，无push或外部部署。

## 分页尺寸与间距源头修正（2026-11-04）

用户要求分析本页还是DS并彻底修正。原DS数字Button md左右16px，数字39–42px／箭头24px、gap4px；站址14px覆盖叠加。上游D:/MyWebSite/vxture/vxture-design官方Pagination改min-w-control-md／px-2xs／tabular-nums、gap-xs，加pagination／pagination-pages数据槽，更新Unreleased与三位数键盘回归。DS未发布，无包版本改动；产品仍消费发布伞包15／UI12，site-registry-pagination旧版局部兼容样式镜像修复，检测新版槽后不生效、升级验证后移除。分页恢复官方label-small12px，业务字号不改。

DS18项相关测试／类型／构建DTS／类名守卫／ESLint通过，产品build含类型通过。首次新增测试错误使用Testing Library不支持exact选项，已由类型拦截并修正通过。CUA1042单数字24px／gap8px；54末页禁用正确，Enter上一页53；关系196末页三位数32.67px不溢，Space195保留关系视图；390无横溢且342px分页完整，1440正常。证据artifacts/site-pagination-qa、tmp/site-pagination-build.log和DS.tmp/pagination-fix-*。设计233／实施690同步，最终commit／health见收尾；无push、依赖／DDL／权限变化或外部发布，不建goal／自动任务。
## 操作行、接通率、资源图标与双时间（2026-11-04）

四条用户批注落地：切换补官方building／users，地域资源标题改building；视图左侧、搜索与类型／筛选／重置右侧，sm上下留白、md组距／sm动作距，中宽搜索160／宽屏224、窄平板两行手机三行。接通率与台账负载共用局部ratioIndicator＋官方Progress，12px淡数字，原connected／attempts口径，空分母仅缺值。时间直接标数据截至＋完整日期，刷新按钮始终刷新于HH:mm，完整readAt保留dateTime／title，pending刷新中，无冒充上游同步。

build含类型、140编号／ASCII／diff通过；CUA1042操作行46.09px、搜索右置，默认接通率99.3%／99.2727实际进度且右界997.33在列表1018内，初版固定列宽导致裁切已移除。县筛选、检索SX-DEMO-001为4关系、刷新readAt35.261→45.918秒而数据截至不变、键盘切换成功；1440／1042／787／660／390无文档横溢。artifacts/site-toolbar-polish-qa含桌面、宽屏台账／关系、中屏／手机截图和checks；warn/error空、viewport reset／tab50关闭。设计233／实施690同步，无业务／权限／依赖／DDL变化，不重复PG或实现镜像测试。最终Git与63333health以收尾为准，无push、发布、goal或自动任务。
## 单一数据截至与动态快照分析（2026-11-04）

用户去掉刷新时间：registry删除readAt／readTime，page删除new Date透传，仅数据截至＋官方图标刷新，pending禁用旋转保留。build含类型通过tmp/site-data-time-build.log；CUA点击刷新后context只有1个time、按钮无文字，截图artifacts/site-data-time-qa/desktop.png，tab51关闭。

追加用户要求分析截至应当前刷新后的时间：查明registryDemo仍DEMO_DATE固定2026-10-25、q.hour样本，刷新仅重读。已解释截至应取成功数据快照有效时间，有新数据才推进，不应直接套电脑时间；动态演示需要同步推进快照和指标，真实来源用来源水位。本轮仅分析该模型问题，尚未实现动态快照，不要后续误认为已完成。其他地图／档案历史周期保持原模型，无权限／依赖／DDL变更，无外部发布。
## 独立业务分析与地图双向入口（2026-11-04）

用户明确多个功能域不应直接进入地图；新增设计234／实施700，P03陕西演示首版。容量质量/capacity、运行能效/efficiency（能效／供电）、运营商用量/operator-usage（时日周月）、用量报告/usage-reports（日周月、环比、版本与HTML）均全宽无地图，launcher／首页入口归位。地图原专题／运营商／日报／周月报继续保留，新增独立分析链接；统一links保留省内地域、运营商、小时／周期、检索与全部选区类型，普通往返不选站，行操作可明确定位。

复用原合成领域服务及阈值，时点状态与累计量不混算；小时总量只算所选小时，趋势说明全天24小时。未分摊运营商电耗为空、能效未知，空态／零分母不补零。报告复用已有usage快照避免重复整月计算，客户端不带无用地图点位副本；手机用官方MetricListCard紧凑摘要，桌面MetricGrid，地市对比宽屏两列。DS伞包、语义token和官方组件不变，分页用同上游修复的本域旧版兼容CSS，无依赖／DDL／权限变动。

17相关单测、双层类型、最终生产构建、28HTTP及142文档编号／交付守卫通过（tmp/business-analysis-*）。HTTP核对四域开关关闭不加载样例、严格筛选及无地图DOM；纠正站址旧HTTP仍断言读取时间增长的过期用例，现唯一源时间同版重读不变。首轮新属性放ShellPageContainer被其丢弃，改原生外层承载data标记和aria-busy；JSX中文属性改JS字符串表达式，类型误用MetricListCard.items改正确metrics后通过。

CUA1440／1042／787／390无文档横溢，四页无地图canvas；launcher直达、容量分页21起／严重空态／判定口径、能效mobile未知和供电切换、经营周月／短信切换、报告日周月、区县运营商17时检索与圆形选区双向保持、三点菜单地图显式站址定位均验证。月报实际下载D:/Downloads/bsmoss-DEMO-MONTH-8c9527a423e0a1446a7d.html（24689字节），编号、检索、圆形选区吻合，报告本期与上期30／31天及日均环比可读。窄屏宽表仅内部横滚。artifacts/business-analysis-qa含桌面／手机截图和checks.json；warn/error空，viewport已reset、临时tab52关闭。初轮全省月报计算耗时较长，后续去重计算并收紧传输；本地演示不视为11万容量验收。

正式/analysis及/reports原授权不变；四独立页预览关闭只显示未开放。真实来源、平台注册、正式业务读模型、容量／恢复／UAT及生产批准继续待办，无外部部署／push或生产上线，不恢复goal／自动任务。

## 站网地图提升全局入口（2026-11-04）

用户批注把站网地图放到决策大屏后面：launcher顶行依次门户首页／决策大屏／站网地图，从运行监管分组移除地图；官方EntryCard尺寸、原用途说明、图标及响应式网格沿用。map目录顺序调整，预览关闭仍无地图链接；管理域不变。导航两项既有回归同步顺序及去重并通过，最终生产build含类型通过tmp/launcher-map-top-build.log。CUA1042三卡同行、业务分组地图0项；390首次变更viewport即时测量命中Radix尚未重定位尺寸，重新在该尺寸打开确认实际卡片310.67px／x32、单列顺序正确。点击进入/product-preview?hour=18，无默认site，warn/error空；截图artifacts/launcher-map-top-qa/desktop.png及mobile.png，viewport已reset，tab53／54关闭。设计232／实施680及信息结构同步；纯目录调整不重复业务／PG测试，无权限／依赖／DDL变化，无外部部署。

## 规划入口卡片对齐（2026-11-04）

用户批注用量核验／核验记录与其他入口不齐，需保留规划中标记。原因是规划项原用ShellPanelRow，已统一为官方EntryCard，沿用图标、p-md、边框、背景及间距，meta使用官方neutral StatusBadge。规划项无href／onClick，aria-disabled=true且tabIndex=-1，保留文字可读，不开放业务功能。

生产build含类型通过tmp/launcher-planned-card-build.log；CUA1042卡片同宽304.67px、高约77.3px且首行对齐，390卡片310.67px、文档无横溢。强制点击规划项不导航且面板保持打开；工具对禁用链接直接press被拦截，改验正常Tab从运营商用量直接到报告中心、跳过两个规划项。warn/error空，截图artifacts/launcher-planned-card-qa/desktop.png及mobile.png，viewport已reset、tab55关闭。设计232／实施680同步，无依赖／权限／DDL变化，无push或外部部署；63333最终版本以health为准。

## 总体检查与批次重排（2026-11-04）

用户要求按3个通用＋5类10专业检查进展并规划批次。新增70-workplan/50-product-batch-plan.md，30台账顶部和00入口同步。核实9演示可用（3通用＋6专业）、2正式工作区已有本地实现但当前未开放（/analysis、/reports）、2规划中（用量核验、核验记录）；不把HTTP200计业务完成，不按入口数推生产完成率。当前业务基线5850ac7、health ok；11项相关既有单测及11URL检查证据tmp/product-progress-unit.log／http.json。本次纯规划未改页面，无需重做构建或视觉QA，不声称全量回归。

排序B01核验闭环→B02周期分析／报告中心显式隔离演示→B03资源／运行深化及快照刷新语义→B04通用收口六场景客户演示→B05配置治理→B06真实来源／正式读模型→B07 Beta／容量恢复／UAT／生产试点。下一任务B01-01详细设计为ready，尚未设计或实现；规划入口继续禁用，人工核验不改原始测量，演示记录与正式账本隔离。来源／平台／Linux／容量安全恢复／业务签认与生产批准仍待，不恢复goal、自动任务或外部发布。运行页面无变更，63333保留5850ac7业务构建；后续规划提交SHA可与其不同。

## B01-01核验业务与交互设计完成（2026-11-04）

用户“开始”接续上一轮明确的B01详细设计。新增规格90／设计235／实施710，规格索引、计划50及台账30／入口00同步。两个独立模块共用唯一对象／证据版本／追加事件：业务波动、连续3小时真实零量、缺数、基线不足分开；待核验→待复核→已复核，支持退回／重开，证据变化单列且旧依据不能直接复核。拟定usage-review列表／详情及review-history；全宽无地图，官方DS、紧凑工具行、独立完整详情和标准三点菜单。演示拟采用IndexedDB事务／CAS、固定demo-visitor、独立数据集和会话归档；正式权限、PG及真实来源接B06，均只是契约，尚未实现。

查明规格60至少3有效参考与evaluateWave只收4样本冲突，已修共用算法接受3或4，分母仍2、四样本值不变，STATION_PERIOD_VERSION升v2；原单测把3样本视为不足的过期断言改2样本，增3样本中位数／双门槛／边界／零基线／53位外精度验证。15单站波动与报告单测、双层类型、生产build、28门户HTTP、146编号文档、源码ASCII及diff通过，日志tmp/usage-verification-design-{unit,types,build,http}.log。未改页面布局不重复CUA；无DDL／权限／依赖改动或PG重跑。B01-01完成、B01总体in_progress，下一切片B01-02实现有实际数据的列表与详情；B01-03至05及两个新入口仍待实现，launcher保持规划中，不冒充整批完成。最终Git／63333 SHA以收尾health为准；无push或外部部署，不恢复自动任务。

## B01-02用量核验列表与只读证据（2026-11-04）

用户“继续，下一步”接续B01。实施720完成/usage-review列表及[id]详情、B01-03证据读取，preview开启后开放launcher用量核验；核验记录保持规划中。独立可复现陕西场景集review-scenarios-v1共180条，日60／周120／月180，分类突增／突降／从零新增／连续3小时零／缺数／不足。纯规则复用evaluateWave，校验4个因果历史槽、3／4有效基线、整数计数及时间连续性；缺数／无效服务／间隙打断零量，成员突降不重复列出。严格范围交集先于分页，未知或超范围详情404，未知／重复／伪造参数拒绝；关闭preview不读取场景、不回退正式错误。

详情展示原始计数、逐窗有效量／质量／完成标记、四周参考及有效数量、门槛、规则／基线／映射／服务关系版本及SHA256；BigInt保留原量和分母2，图表近似显示独立单位，缺数不补零。样例不修改地图／报告测量，地图只作物理定位；同版刷新水位固定11月1日00:00，不用电脑时间冒充新数据。当前全部待核验，待复核／已复核真实空态；原因确认／复核／历史／IndexedDB事务CAS未实现，下一B01-04，再B01-05完整双向上下文；正式权限／PG在B06。任务矩阵变10演示＋2正式待接＋1规划，不计生产完成率。

23相关单测、双层类型、最终生产构建、30门户HTTP、147编号及交付守卫、15源码ASCII／diff通过，日志tmp/usage-review-*。首轮build发现client导入server query带node:crypto，已拆client-safe links修正。CUA1042／787／390列表与1440／390详情无横溢，分页page2返回、连续零3成员、隔离候选原值保留但有效空、2/4基线、县／运营商／月／检索／刷新保持、已复核空态、launcher键盘及记录禁用通过；warn/error空。截图artifacts/usage-review-qa，viewport收尾reset、临时tab56关闭，最终Git／63333运行身份以收尾工具及health为准。无DB／权限／依赖改动，不重复PG；未push、真实接入、外部部署或上线，不恢复goal／自动任务。

## 页面内容外边距统一12px（2026-11-04）

用户要求整体页面padding从24收敛12并使用DS token。新增局部product-page-inset，消费calc(var(--space-lg) / 2)，标准密度实测12；ShellPageContainer显式套该类，台账／档案／核验及错误空态同步。旧正式分析／模板根padding、报告／任务列表padding及详情外margin各断点同值，不改卡片内距、header、launcher或地图全画布，不覆写DS token。实施650补记。编辑脚本曾因PowerShell单项数组展开误作字符替换，立即diff发现，仅恢复本轮三文件后用精确补丁修正；最终diff和生产build类型均通过，无残留错误。

生产构建含类型通过tmp/page-inset-build.log；纯布局不重复业务／PG／接口测试。CUA1042首页／台账／档案两层／容量／核验／配置／报告空态及390核验实际padding均12px，文档宽等视口、warn/error空。artifacts/page-inset-qa含desktop／sites／mobile及checks.json；viewport已reset、临时tab57关闭。147文档编号、19源码ASCII／diff和提交扫描收尾；本地Git及63333最终SHA以health为准，无依赖／权限／数据或真实部署变化，未push／外部上线，不恢复自动任务。

## 页面留白恢复24px（2026-11-04，覆盖上一条12px偏好）

用户查看后要求统一24px。product-page-inset及旧分析／报告／模板／任务的同批外留白全部改用DS var(--space-lg)，不再除2；标准密度24px，保留统一容器、断点一致及地图／header／组件内距边界。实施650明确当前24并保留历史记录。生产build含类型通过tmp/page-inset-24-build.log，CUA1042／390实测24px且无文档横溢、warn/error空。截图和checks在artifacts/page-inset-24-qa，viewport已reset、临时tab58关闭。纯布局无新增测试／业务／依赖／权限／DB变化，文档编号／diff／提交扫描收尾，无外部部署或push，最终运行SHA见health。

## launcher站网地图新标签页（2026-11-04）

用户要求三个通用模块中的站网地图newtab打开。只给launcher全局卡片id=map传官方EntryCard原生target=_blank及rel=noopener noreferrer，原href／自动收起保持；首页与大屏target为空，其他业务页地图下钻未改。设计232／实施680同步。生产构建含类型通过tmp/launcher-map-newtab-build.log；CUA从/sites?view=relations点击实际生成新tab60到/product-preview?hour=18，原tab59 URL及关系视图保留、launcher收起，地图正常呈现无默认站址。三全局卡片DOM属性逐项确认，证据artifacts/launcher-map-newtab-qa，测试tab59／60已关闭，用户tab45保留。纯原生链接变更无新增测试／权限／依赖／数据或DB改动；文档编号／diff／提交扫描收尾，最终63333SHA以health为准，无push或外部部署。

## 全站地图入口审计及新标签页统一（2026-11-04）

用户要求统计全部地图入口并判断必要性。按独立源码交互位置21处，删除门户页头地图／状态观察通用详情／快捷地图卡片3处与档案来源页签地图调查1处，剩17＝launcher1＋业务上下文14＋指标配置／版权辅助2。共享分析组件按实际路由展开原25／剩21，循环数据行不计功能入口；完整分项见实施730，设计232同步。首页快捷区宽屏改3列，档案运营商菜单改“地图时段用量”。原生链接target=_blank及noopener noreferrer；官方ActionMenu无href接口，三个业务菜单和大屏点位回调同步window.open＋noopener,noreferrer。保留现有参数构造、预览开关和默认无选站。

build含类型（tmp/map-entry-audit-build.log）、148编号／ASCII／diff通过。CUA实际普通区域链接、档案运营商菜单Enter、容量行菜单与核验行菜单各开新tab且来源不变、目标参数正确；逐页锚点属性全通过：首页15条数据下钻／通用0，大屏9数据链接、能效／用量／报告各1、档案资料1、核验详情1、辅助各1、launcher1。大屏canvas点位仅源码／构建验证，未实际点测。warn/error空，截图artifacts/map-entry-audit-qa/{launcher,map}.png及checks.json，临时tab61至65关闭、用户45保留；两个菜单即时tab列表尚未更新，下一次状态读取已确认新tab，无产品失败。核验同站多线索按钮名重复导致工具严格定位拦截，改限定首行成功。无权限／依赖／数据／DDL改动，不重复业务或PG测试。最终本地Git／63333身份以health为准，无push、外部部署、goal或自动任务。

## 正式业务命名与环境标识收敛（2026-11-04）

用户要求除tag外页面／标题／板块不得出现“演示”，按正式系统设计实现。规格50追加明确约束、实施740记录。全站TS／TSX字符串AST核查仅剩门户chrome“演示”与地图header“演示数据”两处tag；门户去首页／大屏／档案重复tag，窄屏header保留。launcher／首页用量报告统一命名、站址资源、访客、地图使用帮助／精简视图、检索／图例／空态／错误／规则／资料／报告正文均业务化。核验仅保留只读实际状态和证据入口，来源版本、缺数、未接入、位置待核验、草稿／复核与合成属性仍如实显示；内部demo ID／模式／API／来源版本／证据及预览开关不改，不表示真实接入或生产就绪。费用／退役／地域范围不改。

最终build含类型、导航及日报／单站报告13项既有测试、149编号／源码ASCII／diff通过，tmp/business-copy-{build,unit,docs}.log。CUA15路由／页签状态前13仅header一次环境标识、正文0／属性0，辅助页0；launcher0、用户面板访客、地图帮助0且独立header保留；390报告唯一tag／文档无横溢，viewport reset。warn/error空，artifacts/business-copy-qa含launcher／report／map-help／mobile与checks，临时tab66关闭，用户45保留。首轮快速goto即时DOM为空未作为证据，逐页domSnapshot后重测通过。文案脚本两次严格断言发现子串先替换／原句误写，受影响文件未写入，修正后通过完整源码扫描和构建。无新增实现镜像测试、无PG／DDL／权限／依赖变更，无push／外部部署、goal或自动任务；最终63333身份以Git与health为准。

## 决策分析命名统一（2026-11-04）

用户将“决策大屏”改为“决策分析”。navigation／home／board page与view／network-map共5文件同步页面、入口、功能域及无障碍名称；模块board和/board路由、地图newtab与全部原功能不改。规格50／实施740同步。生产构建含类型通过tmp/decision-analysis-name-build.log；CUA首页与launcher名称正确、实际点击进入/board，header与H1均决策分析，旧名0、warn/error空；截图artifacts/decision-analysis-name-qa/page.png，临时tab67关闭，用户45保留。纯命名不新增镜像单测或重复业务／PG验证；ASCII／diff／149编号收尾。最终Git和63333身份以health为准，无push／外部部署、goal或自动任务。

## 运行总览命名、header同色与launcher外框（2026-11-04）

用户将门户首页改运行总览，系统名称与功能域字色都浅色一致；追加launcher图标大小不变、外轮廓及hover扩大。navigation／chrome／地图返回链接统一运行总览，功能域使用与系统名称相同DS text-muted-foreground。ShellIconButton仅补size-control-2xl rounded-lg，原Icon lg不变。规格50／实施740同步。最终build含类型、149编号、ASCII／diff通过，tmp/overview-header-{build,docs}.log。CUA按钮40×40、图标24×24、圆角10px；两名称computed色同为oklch(0.556 0 0)，hover命中且官方accent有填色。鼠标／Escape／Enter开合和launcher运行总览跳转正确，390按钮40且无文档横溢；warn/error空。证据artifacts/overview-header-qa/{header,mobile}.png与checks.json，viewport reset／tab68关闭，用户45保留。纯布局文案不新增镜像单测或重复业务／PG；无依赖／权限／数据／DDL变化，Git／63333版本以health为准，无push／外部部署、goal或自动任务。

## 运行总览提升首批（2026-11-04）

用户确认七板块方案并要求执行，首批实施750：陕西省市县URL联动／服务端严格校验、同范围资源及三域摘要、运行参数备用供电与温度≥35°C计数、重点站址前置与统一运行档案下钻、三指标趋势及运营商数量／单位／占比／排序同步、地市负载／接通率切换。去重复标题／决策按钮／快捷目录，保留SR h1与DS 24px，窄屏四项资源收为官方MetricListCard。电耗全日累计、18:00状态分开；刷新不冒充新来源水位，运行计数独立于地图点位上限。无站群时趋势及结构用空态，不画零量峰值；首页没有地图入口，本期报告只保留同范围已有入口。

新增4契约＋既有5分析测试共9通过，最终生产build含类型、完整30门户HTTP、150文档编号、5源码ASCII和diff通过，tmp/overview-stage1-*。初次契约误引用registry.total改实际summary.sites后通过；HTTP首轮发现历史断言仍要求旧决策大屏／核验场景样例和已删除首页地图入口，按现行产品规则修正并补范围断言，最终30全通过；不计首轮失败为成功。补丁两次因重复目标／上下文未匹配被工具拒绝，无文件半写，拆分精确补丁后通过。

CUA实际验证流量／通话／短信趋势与结构，市240及雁塔县16座与全部业务href保范围，进入SX-DEMO-006运行档案返回，刷新保持窗口，换市清县，空县杨陵无统计对象／服务关系、非法省市可重置；地市接通率切换、1042／390无文档横溢、24px、warn/error空。证据artifacts/overview-stage1-qa/{overview,desktop,mobile,empty}.png与checks.json，viewport已reset、临时tab69已关闭，用户tab保留。

规格50／台账30／计划50同步最新用户优先事项。下一批是重点事项原因与证据、同源核验摘要及真实报告动态；再指标扩展、可比周期及显示配置。B01人工确认／复核／记录和B04整批均未完成；无新增费用／退役、权限／依赖／DDL，无PG重跑、真实接入、外部部署、push、goal或自动任务。最终Git及63333身份以收尾health为准。

## 运行总览第二批证据与周期报告（2026-11-04）

用户“继续下一项”并明确使用演示数据、要求数据维度齐备且支撑展示。实施760：重点关注按既有capacity／power／efficiency规则独立统计，严重优先前五；提供触发项／当前值／连续小时／截至18:00历史趋势／运营商流量占比及质量／来源规则版本和证据键，容量趋势全宽切换接通与负载。运行状态关注360与专题536／180／113为独立定义，帮助说明不相加。备用供电及温度不诊断故障，不把命中当确认原因。

核验摘要直读实施720独立数据集：全省日60条、10站，业务40／质量10／不足10，突增／突降／从零新增／连续3小时零／缺数／基线不足各10；摘要样本分散不同城市、运营商及指标，链接真实详情，截止11月1日不冒充运行快照。报告复用既有日周月引擎，三项业务总量／总量与日均环比、峰值小时／站群加权质量、电耗／温度／备用供电唯一站数及站时／样本、版本／完整页／HTML一致。新增reportPeriod严格URL校验，换地域保周期，仅影响报告卡；日核验及首页日累计不随周月报告暗改。草稿待复核如实显示，无虚构归档、发布或已复核。

全省月初算12.1秒、周3.2秒；构建新增prepare-overview-reports，从同引擎生成约10KB确定性省级摘要并入库；版本含场景／日历／模板／比较，运行时不匹配报错，子范围继续实时算同引擎。优化后日／周／月首页模型576／515／485ms。14数据及分析契约、双层类型、最终生产build、31门户HTTP、151编号文档、交付守卫及源码ASCII／diff通过；日志tmp/overview-stage2-*。新增测试精确对账省级摘要及引擎ID，关闭预览不输出缓存合成报告。

CUA1280／1042／390无文档横溢，三专题／容量维度、六类核验实际详情、三周期、县16站周报／换地域保周期／空县均验证。手机弹窗初验被grid自动最小宽度撑到614，修复单列及token视口留白，复验358宽／343内部无横溢；通过官方label ReactNode换行修复截断，表格仅内部滚动。月报实际下载D:/Downloads/bsmoss-DEMO-MONTH-e0198bae245f89fd428a.html，44399字节且ID窗口吻合。证据artifacts/overview-stage2-qa；warn/error空，viewport reset／临时tab70关闭，用户tab45保留。两次工具定位失配分别为县计数猜错及返回后专题重置，读当前DOM纠正，不是业务失败。

规格50／台账30／计划50／入口00同步；下一批扩展三类指标、可比周期变化和显示配置。B01人工闭环、B04整批及正式读模型／真实来源／平台注册／容量恢复／UAT／生产批准仍待，无依赖／权限／DDL／PG变化、不做旧库迁移，无push、外部部署、goal或自动任务。最终Git与63333身份以收尾工具health为准，不称生产上线。

## 运行总览第三批指标与显示配置（2026-11-04）

用户“继续下一项”接续第二批及数据维度齐备要求。实施770扩展24项首页读投影：经营8／运营7／运行9。复用calendarSampler比较10月25与24日同站群，日累计与18时点分开；比率按分子分母加权并比较百分点、计数／量比较增减率或原单位差值，零基期与空／缺样不可比。日报当前／昨日总量、接通／负载及电耗／温度／备用供电逐项对账；全日备用供电180唯一站／540站时去重。报告周月切换不暗改首页日比较，电耗不分摊运营商。核心metricCode生命周期仍planned，资源负载不冒充真实PRB，未造设备在线率／SOC等无来源明细。

三域默认各3项，全部指标官方Dialog展示当前／昨日／变化／窗口／有效应有站时和版本。配置独立/settings/overview，header齿轮后管理导航／管理总览及指标明细进入，业务三通用＋五类十专业不变。每类2–4项、顺序／合法单位／保存／恢复默认，localStorage严格版本／键／归类／去重／单位校验，损坏回默认并可保存修复，存储拒绝提示失败；当前浏览器个人偏好，不写正式模板／权限／报告。跨标签页同步有实现，本批未单独UI点测，不宣称已验。

17项相关契约、双层类型、生产build含类型、31HTTP通过；缺快照置未知后重跑6指标契约通过，最后布局修复后再次生产build成功。152文档编号、交付守卫、16源码ASCII与diff通过，日志tmp/overview-stage3-*。初轮DS类型误用PanelCard缺children／ViewHeader actions改action后通过；手机四项GiB长值初验被截，改官方value ReactNode按千位分组可换行，复验558,547.81 scrollWidth=clientWidth=66。分段控件外加flex避免空框拉满，配置在有管理栏时1280两列、2xl三列。无新原语／依赖／全局token改写。

CUA1280／390无文档横溢，三类8／7／9明细、加项／排序／GiB单位／保存／刷新保持、4项禁第5／2项禁移除、恢复默认保存均通过；雁塔16站58服务／384日站时、空县—与不可比。运行参数明细59374.4kWh对59248.5、能效.106对.109；弹窗343px内部无外溢。artifacts/overview-stage3-qa含首页／明细／配置／空态／手机及checks.json；warn/error空，viewport reset、测试tab71关闭、测试偏好恢复默认，用户tab45保留。

台账30／计划50／入口00同步第三批完成，下一切片B01-04原因确认／复核／历史，再B01-05跨域。B01整批、B04六场景、正式工作区显式演示贯通和真实来源／平台注册／Linux／容量恢复／UAT／生产批准仍待；无DDL／PG变化、不做旧库迁移，无push、外部部署、goal或自动任务。最终本地Git及63333身份以收尾health为准，不称生产上线。

## 三域摘要卡纵向统一（2026-11-04）

用户批注首页三卡混乱，要求三个数字纵向、三卡一致。核对DS12 MetricListCard定义固定2–4列且无纵向参数，改本页为官方PanelCard＋PanelList／PanelItem＋LabeledValue。每指标单独一行，左侧统一标签／单位及18px官方主数值，右侧两行昨日口径／变化；三卡同标题、全日／时点说明、虚线分隔及底部操作。保持原lg三列、窄屏一列、语义色顶边、24px页面留白；不改DS包／内部CSS／原语，数值和个人配置／筛选逻辑不变。实施770追加本次排布覆盖。

生产build含类型通过tmp/overview-metric-rows-build.log。CUA1280／1042／904／390已验无文档横溢及主数值截断；1042三卡高376.5px，各自三个数值y392.80／463.26／533.72一致。手机完整读数、8项经营明细及切9项运行明细成功，warn/error空；截图及checks在artifacts/overview-metric-rows-qa，viewport reset、临时tab73关闭，用户页保留，个人偏好未改。纯布局不新增镜像测试／不重复业务或PG回归；编号文档／ASCII／diff及提交扫描收尾，无依赖／权限／数据／DDL／真实接入变化、无push或外部部署。下一业务批仍B01-04，不以本次布局修正推进状态。

## 快照时间集中与分析决策定位（2026-11-04）

用户先问重复时间及18点固定，后明确保留快照合理、系统属于分析决策且不做实时监控。已将此定位记入规格10，实施770追加覆盖。首页只在页首显示“分析快照 2026-10-25 18:00”，title说明状态时点及日累计00–24时口径；移除三卡description、重点关注及地市比较重复小时。明细弹窗／证据与周期报告保留必要独立时间依据。刷新同版不推进水位，原固定日期／18点、完整读模型、报告／核验和个人显示配置不改。

用户澄清前曾本地尝试当前北京时间小时选择及自动刷新，尚未启动该版预览；已完整移除clock helper、effect、服务／page参数与相关试验测试，最终仅布局文案及对应HTTP断言。试验单测因比较报告downloadHref小时不同而失败，不计最终结果；试验构建完成但被最终快照构建替代。无自动时段、轮询或墙钟来源推进残留。

最终生产build含类型及31HTTP全通过tmp/overview-snapshot-time-{build,http}.log；CUA1280／904／390无文档横溢，三卡0次18:00、手动重读快照不变、运营7项明细保留统计窗口；warn/error空。证据artifacts/overview-snapshot-time-qa含desktop／width904／mobile及checks，viewport reset、临时tab74关闭、用户页保留。152文档编号、源码ASCII／diff与提交扫描收尾；无依赖／权限／数据／DDL变更、不重复PG或新增布局镜像测试，无push／外部部署／生产上线。下一业务切片仍B01-04。

## 用量趋势图填充与鼠标跟随提示（2026-11-04）

用户要求完整用量分析链接上移、图表占满高度，以及数值提示跟随鼠标。实施770追加：官方Card／CardContent／SectionHeader组合替换本卡PanelCard；操作区含原指标切换及分析链接，窄屏换行，无底部链接。DS BarChart当前固定80px绘图区及右上角读数、无tooltip接口，本页用既有ECharts6专用UsageTrend适配，不改DS／依赖。颜色字体间距圆角从DS计算样式读取，避免rem／calc原始token解析错误。最小高度DS192＋80＝272px、flex自适应，ResizeObserver／主题观察及销毁清理；指针提示边界避让、Home／End／左右键和SR读数，失焦隐藏，24时数据及单位／来源快照不变。

最终生产build含类型通过tmp/overview-usage-chart-build.log。CUA1280／904／390绘图区272px、无文档横溢；同一10点柱原生点击两处移动指针，提示y519.98变480.98，右缘23点提示在图内；通话End读23:00／67.37万分钟、短信左键读18:00／12.83万条，完整分析实际进入operator-usage并保持范围／小时。warn/error空，artifacts/overview-usage-chart-qa含tooltip／width904／mobile及checks，viewport reset／临时tab75关闭。未使用合成事件或浏览器状态注入。152编号、源码ASCII／diff及提交扫描收尾；纯布局不重复PG／业务测试，无数据／权限／DDL／依赖改动、无push／外部部署／生产上线，下一业务切片仍B01-04；最终63333身份见health。

## 趋势卡适配高度、短入口与地市八列比较（2026-11-04）

用户连续批注：趋势卡过高需随运营商卡、完整分析文字过长去icon按钮化、地市负载／接通率无需切换、扩展流量通话短信分列。实施770追加覆盖：图表取消272px最小高度，存在图表的趋势卡局部contain:size，父网格auto-rows-fr由运营商自然内容决定两卡等高；上下排列同高、并排顶底齐。入口官方outline小号按钮“用量分析”无icon，原参数不改。删除regionMetric状态与切换，地市八列含资源负载／接通率两条同样进度，以及时段流量GiB／通话万分钟／短信万条三列，列名和单位两行、按流量排序，城市名单不换行，DS表格内部横滚。

最终生产构建含类型通过tmp/overview-usage-height-build.log；152编号、源码ASCII／diff与提交扫描收尾。CUA1280／904两卡均370.18px、图226.96px，390图190.96px且两卡仍370.18；切换通话／End读数及短入口实际跳转保持范围。地市10行8列20条进度，西安62.6%／98.5%及9362.5GiB／29.43万分钟／2.85万条；直接查询既有summary原量10052894975199bytes／17657381seconds／28478sms换算相符。904表内部775／884px，390实际横滚至634.67、文档390无横溢；城市nowrap。首轮空杨陵区发现EmptyState被压到卡外，改仅有图表时尺寸包含；最终空态两卡298.65px，client=scroll=296无溢出。warn/error空，artifacts/overview-usage-height-qa含desktop／mobile／overview／city-table／city-mobile／empty与两份checks；viewport reset、临时tab76／77关闭，用户页保留。布局修正后不重复PG或新增镜像测试；无事实／权限／DDL／依赖变化、无push／外部部署／上线，下一业务仍B01-04，最终Git及63333身份见health。

## 地市用量表头单行（2026-11-04）

用户要求列名称和单位保持一行。home三项表头改为DS原生字符串“流量 / GiB”“通话 / 万分钟”“短信 / 万条”，覆盖上一条两行排布；无需新增CSS或token。数据、单位换算、八列顺序和表内横滚保持。最终生产构建含类型通过tmp/overview-city-header-build.log；CUA904三个表头均nowrap、38.125px高、无子级换行元素，表内775／896px、文档904无横溢；1280截图与checks在artifacts/overview-city-header-qa，warn/error空，viewport reset、临时tab78关闭。152编号／源码ASCII／diff和提交扫描收尾；纯显示修正不重复业务／PG或新增镜像测试，无依赖／权限／事实／DDL变化，无push／外部上线，下一业务仍B01-04，最终63333身份以health为准。

## 运行总览恢复内容区标题（2026-11-04）

用户明确header功能域提示不能替代常态标题。首页用官方ViewHeader恢复可见H1“运行总览”，替换sr-only标题；与地域／快照操作组成可换行首行，不增加描述／重复tag。未开放数据时也有同标题。规格50覆盖先前去大标题决定，实施770追加。生产build含类型通过tmp/overview-title-build.log；CUA904／390 H1均18px、72×25.2px、x24／y72可见，无文档横溢，warn/error空。截图及checks在artifacts/overview-title-qa，viewport reset、临时tab79关闭，用户页保留。152编号／ASCII／diff和提交扫描收尾；纯布局不重复PG／业务或新增镜像测试，无依赖／权限／事实／DDL变化、无push／外部上线，下一业务仍B01-04，最终63333身份见health。

## 运行总览响应式水平页面留白（2026-11-04）

用户同意在24px内容内距外增加左右页面留白。首页两分支增加局部overview-page-gutter，48rem起padding-inline=space-lg＋space-md，80rem起space-lg＋space-xl；手机沿用space-lg，垂直不变。标准密度合计56／40／24px，不改共享token／其他页面／header／地图。规格50及实施770同步。生产build含类型通过tmp/overview-gutter-build.log，152编号通过。CUA1280／904／390 computed padding分别24px 56px／24px 40px／24px，标题x56／40／24，均无文档横溢、warn/error空。artifacts/overview-gutter-qa含desktop／width904／mobile及checks；viewport reset、临时tab80关闭、用户页保留。源码ASCII／diff与提交扫描收尾，纯布局不新增镜像测试或重复业务／PG；无事实／权限／依赖／DDL变化、无push／外部上线，下一业务仍B01-04；最终63333身份见health。

## 全站与二级页面布局统一（2026-11-04）

用户授权按已确认留白逻辑全面优化页面板块及二级页。实施780、规格50覆盖首页限定：共享product-page-inset采用DS space-lg基础、48rem起额外space-md、80rem起额外space-xl，标准水平24／40／56px、垂直24px，全宽；产品局部组合变量，不改DS token。业务分析／台账／核验补常态ViewHeader H1及换行操作；档案页首与正文同级对齐，正文隐藏原生滚动条保留可聚焦region与滚动，修正15px宽差。旧正式分析／报告／模板／任务根布局应用共享内距，详情不叠外边距，字号与字体收敛DS角色；未接入／登录分支使用官方组件业务组合WorkspaceAvailability，原门槛不改。业务窄屏与档案资源／运行卡新增MetricRowsCard（官方PanelCard／PanelList／PanelItem／LabeledValue组合），修正统计大数省略。版权辅助页用官方卡片，指标辅助页仅外留白；地图全画布、header／launcher／浮层独立。

最终生产build含类型、31项HTTP、153文档编号通过，tmp/page-layout-{build,http,docs}.log；33源码ASCII及diff通过。CUA20路由／视图×1280／904／390共60组无页面横溢、唯一可见H1／无内距嵌套，实际内距56／40／24；六档案页签×两档12次以URL及aria-current确认，页首正文宽一致；390实际日周月URL／选中／窗口／下载同步，周月长数字完整。1042台账收起后x40全宽展开；核验列表内部滚动分页、详情滚动和非法筛选可重置；地图canvas1／共享内距0／无默认选站，warn/error空。证据artifacts/page-layout-qa含checks.json及各页截图。首轮发现数字省略和档案滚动条宽差后修复重验；周期工具等待两次超时，随后URL及aria状态确认正常，早期旧周期快照不算成功。无真实凭据，正式工作区仅验门槛页及构建，不声称真实授权后联调。最终63333以Git和health为准，1920指标辅助页与父区等宽、无最大宽度限制；测试tab81已关闭／viewport已恢复，用户tab保留。

本批仅布局与可读性，不推进B01／B04业务完成状态；下一业务仍B01-04原因确认／复核／记录。陕西范围、快照分析、费用预留、退役P2、新产品无旧库迁移保持；无依赖／权限／事实／DDL变化，不重复PG；无push／外部部署／生产上线、新聊天／goal／重复自动任务。


## 页面标题区统一（2026-11-05）

用户要求全面规范标题／副标题／标题到主操作及相关细节。实施790、规格50追加。新增PageHeading作为官方DS ViewHeader业务组合，navigation／title＋description＋secondary／actions／context／toolbar稳定槽位；H1 heading-1、描述body muted，DS细虚线和sm／md／lg间距；宽屏左右、窄屏操作左对齐换行。Button default仅主操作、outline地图／关联、ghost刷新／全屏，md／icon-md标准24px。覆盖业务／配置／档案／核验证据及辅助页；报告和任务H1移至整体顶部、原生标题按钮／输入改DS，旧CSS排除标题后代；未接入／登录分支保留模块标题，状态入卡。台账侧栏按钮仍面包屑前、地图newtab，地图画布保持独立，24／40／56水平内距不变。

生产build含类型通过tmp/page-heading-build.log、31HTTP通过tmp/page-heading-http.log。初始非DS refresh-cw名称已修正refresh；档案脚本误定位已从本批前HEAD恢复后限定标题区重做，最终服务卡diff无改变。CUA20路由×1280／904／390共60组，无页面／标题横溢，H1 18px、描述14px、操作按钮24px、地图链接_blank；实际1042侧栏及概况开关、台账切换、周报告URL／aria、档案经营tab／返回成功。新开地图tab83 canvas1／共享标题0／site空；warn/error空，viewport恢复、82／83临时tab关闭、用户原页保留。证据artifacts/page-heading-qa。授权工作区仅门槛页＋编译，不声称真实登录联调；最终受权工作区标签／模板名小修不改门户可见布局。

无数据／权限／DDL／依赖变化，不重复PG／新增布局镜像单测；无push／外部部署／生产上线／新聊天或自动任务。下一业务仍B01-04，陕西／快照分析／费用预留／退役P2／无旧库迁移不变。最终63333身份以Git和health收尾为准。


## 标题区布局重排（2026-11-05）

用户指出信息已统一、布局未设计。承认上批堆叠松散后直接改共享PageHeading／globals为两层：左标题＋副标题，右上下文＋操作横向成组垂直居中；下层筛选，返回导航在上。工具组内容自适应，窄屏全宽换行，分隔前space-md，页面56／40／24及DS字体／按钮不改。实施790及规格50追加覆盖旧排布。

生产build含类型通过tmp/page-heading-layout-build.log。CUA20×1280／904／390共60组无页面／标题／工具横溢；首页桌面155.75降至113.96px、手机153.96；额外看1042侧栏台账、904报告日期与长操作、390档案。刷新快照不变、warn/error空；artifacts/page-heading-layout-qa保存overview／report／mobile和checks，viewport恢复、tab84关闭、用户页保留。纯共享布局不重复31HTTP／PG／镜像单测，无数据／权限／依赖／DDL／生产上线变化，下一业务仍B01-04。最终63333身份见health。


## 系统通用区域选择器（2026-11-05）

用户要求省市县三级级联、搜索、单组件完整路径回显，并确认定义系统公共组件。实施800、规格50追加。新增portal/region-selector及纯region-selection契约，官方DS Button／Popover／Command业务组合；受控最小目录＋cityId／countyId＋onChange，无router／地图／store依赖、无DS包／基础原语／全局token覆盖。桌面三级分列、窄屏省在上及市县双列；全省／全市显式提交，选城市只浏览区县、取消不提交；搜索名称／编码／完整路径及分隔词，结果全路径、空态、键盘、焦点恢复，重新打开自动定位已选区县。按钮显示陕西省·西安市·雁塔区，宽度受限时title和aria保留全路径；浮层两侧留白及滚动尺寸用DS语义token。当前仍只陕西，最小契约可扩展目录。

接入总览、容量／能效／运营商／周期报告、核验、站址筛选、决策分析和站网地图共9个视图。站址嵌套只改草稿、父层应用后提交，地域计一个条件。既有市县变化清理空间选区／比较等逻辑保留。决策分析新增严格county参数，指标／24时趋势／运营商／镜头／地图newtab链接带同范围；全市对比保持独立口径，县级明确标注且点城市回全域。地图全画布保留、无默认选站。

生产build含类型通过tmp/region-selector-build.log；7项规则／决策测试通过（包含24时县级与queryMap逐点一致、跨市及伪参数拒绝），31HTTP通过tmp/region-selector-http.log；155文档编号通过。CUA默认1280、1042和390实际验证：西安→雁塔URL与16站／58服务、全市清县／全省重置、浏览宝鸡后Escape原值不变且焦点恢复、名称／编码／分词／空结果、Enter实际切至宝鸡、长列表周至可选；六分析页面逐页选雁塔URL和范围正确，手机文档390无横溢、最终popup358px。站址子浮层选雁塔时URL未改、父应用后变city／county；地图异步完成16站及同范围指标、canvas1、site空，决策地图所有链接_blank带县。最终重新打开已选县可见，warn/error空；artifacts/region-selector-qa含cascade／search／mobile及checks.json；viewport已恢复、临时tab85关闭、用户原页保留。

源码ASCII／diff及提交检查收尾，未新增依赖／权限／DDL／事实口径，不重复PG；无push／外部部署／生产上线／新聊天或自动任务。下一业务仍B01-04，费用预留、退役P2、快照分析和无旧库迁移保持。最终63333身份以本批Git及health为准。


## 标题区矩阵布局定稿（2026-11-05）

用户用草图指定：标题＋区域左上、时间右上；副标题左下、全局按钮右下；虚线以下才是内容操作行与正文。本批覆盖前两版布局：PageHeading新增region公共槽位通过官方ViewHeader secondary承载，title-row grid两列；右侧context／actions纵向上下对齐、actions底沿与副标题齐，虚线移到title-row，toolbar在其后。窄屏按内容换行，右工具组独立一行；无地域／时间不造占位。全部采用DS字／间距／按钮／细线，页面56／40／24保持，未覆盖DS组件内部CSS或token。

首页、四业务分析、核验、决策分析将区域从内容筛选行提升标题旁，去重复范围；站址面包屑及侧栏开关在标题旁、时间独立；档案／核验详情地域由返回导航移至region，档案右上补同源快照、小时选择不再重复日期。系统仍为快照分析，右上沿用分析快照／数据截至，不用墙钟作为刷新数据时间。实施790及规格50同步。

最终生产build含类型通过tmp/page-heading-grid-build.log；CUA20路由×1280／904／390共60组无页面／标题／工具横溢，toolbar均在虚线下。首页桌面标题与区域y72／72.59，来源时间y72，操作底沿129.29与副标题底沿129.29一致；904雁塔周报告同排、全局按钮下排靠右。月切换后选宝鸡保持period=month、county=all，导出同范围月参数。1042站址收起面板成功、内容展开；详情经营用量切换及hour12后URL／选中／右上快照均12点。手机390完整雁塔路径同标题行，无横溢；首页重读仍2026-10-25 18:00。warn/error空，证据artifacts/page-heading-grid-qa含overview／report／sites／detail／mobile及checks。初次详情查询“经营分析”无匹配，按实际“经营用量”重验成功；异步初始旧URL／未选月不当作成功。viewport恢复、临时tab86关闭，用户tab72保留。

纯布局不重复已通过31HTTP／PG、不新增镜像单测。155编号／源码ASCII／diff与提交扫描收尾。无依赖／权限／数据／DDL变化，无push／外部部署／生产上线、新聊天或自动任务；下一业务仍B01-04，陕西／费用预留／退役P2／无旧库迁移保持。最终63333身份见Git及health。


## 区域触发器常态弱化并保留图标（2026-11-05）

用户要求常态不显示边线／下拉箭头，仅hover／active显示，并随后明确前置区域icon要保留。最终公共RegionSelector使用DS ghost按钮，前置city图标常驻，箭头opacity0占位、透明边框；hover／active／focus-visible／data-state=open显示control-border及箭头，官方聚焦／展开／禁用反馈保留，未改CSS／token／依赖。此前本地一度移除图标、未提交，经用户纠正恢复并重建；实施800及规格50以保留图标为准。

最终生产build含类型通过tmp/region-selector-quiet-build.log。CUA常态icon1／arrow0／border与bg透明；展开icon1／arrow1／control-border可见，前后同121.33×24px及同坐标，无抖动。图标恢复前已验证Escape关闭后hover及键盘focus反馈／搜索雁塔联动URL；恢复图标后复核常态／展开及手机390长路径，icon1／arrow0且文档390无横溢。warn/error空，artifacts/region-selector-quiet-qa的normal／mobile／checks均已覆盖为保留图标的最终版。viewport恢复、测试tab87／88关闭，用户tab72保留。纯样式不新增镜像单测／不重复业务HTTP或PG；155文档编号／ASCII／diff和提交扫描收尾，无数据／权限／DDL／上线状态变化。最终63333以本批Git及health为准。

## 区域触发器对称留白（2026-11-05）

用户指出隐藏下拉箭头后右侧空白偏多，并询问背景色。本批覆盖上一条箭头占位策略：公共RegionSelector常态继续透明底，保留city图标；hover／展开采用官方ghost淡底。箭头改DS xs绝对定位在既有右内距，取消文档流占位，按钮按图标＋文字及对称px-md定宽，无新增CSS／token覆盖／业务查询变化。实施800同步。

生产build含类型已通过tmp/region-selector-inset-build.log，155文档编号通过tmp/region-selector-inset-docs.log。CUA常态左右可见内容内距均16.67px，padding各16px，icon1／arrow0／底边透明；展开arrow1／官方淡底，前后同95.33px宽。390长路径“陕西省·西安市·雁塔区”左右内距仍16.67px、宽174.61px，文档宽390无横溢，warn/error空。截图artifacts/region-selector-inset-qa含normal／open／mobile；viewport恢复、临时tab89关闭、用户tab72保留。纯样式不新增镜像单测／不重复业务HTTP或PG；无数据／权限／DDL／依赖／上线状态变化，最终63333以本批Git和health收尾为准。

## 区域常态淡底与箭头独立展开（2026-11-05）

用户纠正上批理解：隐藏箭头不占位是为了常态背景留白对称，显示箭头需要舒展空间，并非挤进原内距。本批覆盖上一条透明底／绝对定位／等宽策略：公共选择器采用DS bg-muted常态淡底，city图标保留；箭头常态hidden，hover／active／focus-visible／展开时block进入文档流，sm图标＋gap-sm自然增宽，外侧仍px-md对称。规格50和实施800同步，不改DS内部样式／token／筛选逻辑。

生产build含类型通过tmp/region-selector-reveal-build.log，155编号通过。CUA常态background非透明、箭头display:none、宽95.33px／左右内距16.67px；展开宽121.33px、16px箭头与文字间隔10px、外侧内距仍16.67px；Escape收起成功。390长路径常态174.61px、展开200.61px／文字完整／间隔10px，文档宽390无横溢；warn/error空。证据artifacts/region-selector-reveal-qa含normal／open／hover／mobile及checks.json。viewport恢复，临时tab90关闭、用户原页保留。纯样式不重复业务HTTP／PG、不新增镜像单测，无依赖／权限／数据／DDL／外部上线状态变化，最终63333身份见Git及health。

## 工作区与正文双层留白全局修正（2026-11-05）

用户批准全局修正外层8–16px、正文左右约48px／顶部8–16px／DS底部安全区。实施810及规格50覆盖旧单层24／40／56px规则。新增ProductWorkspace结构组合；ProductChrome中header仍用ShellViewport，配置导航用官方ShellSidebarFrame／ShellSidebarNav放入外框槽。外框桌面space-md16／手机space-xs8；正文独立滚动且透明，product-page-inset左右clamp(space-md,4cqi,space-3xl)随实际正文宽度16–48，顶部16／小容器8，末尾space-6xl标准80（用户所称70按已同意DS token落地），不改DS token或内部CSS。

站址树移除旧共享正文padding；右侧独立容器计算cqi，收起后自然展开。档案根只保留一层内距，标题及正文同级对齐、去标题白底；底部80在滚动正文末尾，不在页首重复。普通业务／二级／核验／配置和门槛页共享新框架；指标辅助内容与版权页补外框，地图不套框。无查询／数据／权限／依赖／DDL变化。

生产build含类型通过tmp/workspace-layers-build.log、31HTTP通过tmp/workspace-layers-http.log、156编号通过tmp/workspace-layers-docs.log。CUA20页面×1280／904／390共60组，无文档／正文／标题横溢，唯一可见H1，无嵌套正文padding；总览1280外16／内16 48 80，390外8／内8 16 80。1042地域面板x16顶64底855，四周外安全距16；正文宽754内30.16，收起宽1010内40.4。业务与配置侧栏开关、page2与aria、服务关系切换、档案经营用量URL／aria均成功。档案标题正文x56.40一致，正文滚到底1272.67且底80；总览实际末项至根底80；核验表内滚动分页距底80；390台账卡片纵滚5412可达分页。地图等异步canvas出现后1、外框／正文内距0、site空；warn/error空。证据artifacts/workspace-layers-qa含60组checks和站址／总览／配置／档案截图。viewport恢复、验证tab关闭、用户原页保留；不可聚焦标题和同名入口的初始定位失败不计成功，均改按可聚焦链接／region和限定页签复核。

纯全局布局不新增镜像单测／重复PG，无push／外部部署／生产上线／新聊天／自动任务；下一业务仍B01-04，陕西／快照分析／费用预留／退役P2／无旧库迁移保持。最终63333身份以本批Git及health为准。

## 站址地域面板开关重新归位（2026-11-05）

用户指出标题与地域之间的收起按钮不合理。按钮改放陕西·资源标题栏最右侧，官方ShellIconButton／sidebar图标沿用；标题及全省数量同排。收起后左侧只剩41.33px方形展开入口、自适应高度，正文占其余宽度，页面标题旁只留地域面包屑。两态同一个button保留焦点，aria-controls固定tree节点，树hidden不卸载；县级选择和URL不变，窄屏沿用筛选无需侧栏入口。实施810追加覆盖原标题内按钮策略。

生产build含类型通过tmp/site-region-toggle-build.log、156文档编号通过tmp/site-region-toggle-docs.log。CUA1042按钮24px且insidePanel=true／insideHeading=false、标题栏无横溢；收起树hidden／焦点保留、面板41.33方形，Enter重新展开，雁塔aria-pressed=true／city县URL不变。实际切服务关系成功，同县参数保持；1280／904／390无文档或标题横溢，窄屏面板隐藏且标题无残留开关。warn/error空，artifacts/site-region-toggle-qa含expanded／collapsed／checks。viewport恢复、临时tab94关闭、用户页保留。源码ASCII／diff／提交扫描收尾，纯结构布局不新增镜像单测或重复31HTTP／PG；无业务数据／权限／DDL／依赖／外部上线变化，最终63333身份见Git及health。

## 地域收起态仅显示图标（2026-11-05）

用户要求收起后不显示按钮外壳。本批将地域aside的背景／边框／圆角／裁剪仅放在展开分支，收起透明无边线，只留sidebar图标及原点击热区，官方hover／focus反馈和切换逻辑不变。实施810补充。生产build含类型通过tmp/site-region-bare-icon-build.log，156编号通过tmp/site-region-bare-icon-docs.log；CUA1042常态aside底透明／border0／radius0、按钮底透明，无文档横溢，Enter可重新展开，warn/error空。截图及checks在artifacts/site-region-bare-icon-qa，viewport恢复、临时tab95关闭、用户页保留。纯外观不新增镜像单测／重复HTTP或PG，无数据／权限／依赖／DDL／外部上线变化；最终63333身份见Git与health。

## 地域收起态浮动半隐藏把手与零占宽（2026-11-05）

用户指出裸图标容器仍占宽，随后要求浮动侧边半隐藏效果。本批覆盖上一条收起占位：资源工作区行设relative，收起aside绝对定位于左缘垂直中部，DS40×至少48px、左移space-md16，沿工作区裁剪露出右侧24px；hover／focus-within向内完整滑出，官方按钮热区、DS淡底边线圆角阴影和减弱动态偏好保留。不参与flex分配，标题和正文恢复无侧栏时正常留白。展开态资源面板及button节点不变，筛选、URL和键盘上下文保持。实施810补充本次覆盖；半隐藏浮动把手替代此前用户纠正中的裸图标外观。

先完成取消占位的中间构建tmp/site-region-no-reservation-build.log，再按最新浮动要求完成最终生产构建含类型tmp/site-region-edge-dock-build.log；最终只以后者为准，156文档编号tmp/site-region-edge-dock-docs.log通过。CUA1042收起正文1010=工作区1010，titleX56.40／内距40.4不再额外40；idle transform(-16,-24)、dock40×48，focus完成transform(0,-24)完整露出。Enter重展开、雁塔选中和URL保留；切服务关系后仍收起、同县参数不变。1280正文1248=工作区1248；904／390隐藏把手、正文872／374无占位，三档无文档横溢，warn/error空。证据artifacts/site-region-edge-dock-qa含idle／focus／checks；动效初始中间矩阵不计最终状态，待正常观察确认终点。viewport恢复、验证tab96关闭、用户页保留。纯布局不新增镜像单测／重复HTTP或PG，无数据／权限／DDL／依赖／外部上线变化；最终63333身份见Git与health。

## 地域收起入口左上窄条（2026-11-05）

用户要求收起不保留图标，仅窄条，且位置靠上。本批覆盖此前居中半隐藏策略：top使用space-md、横向平移自身宽减space-2xs，仅露4px；常态按钮透明，hover／focus-within完整滑入并显示图标，按钮铺满把手支持窄边点击。展开面板、同一按钮DOM、县级筛选及URL保持，正文零占宽。

生产构建含类型tmp/site-region-slim-edge-build.log通过；CUA1042正文1010=工作区1010、窄条4px／top80／按钮opacity0，无横溢。窄条直接点击成功；键盘聚焦稳定后opacity1／translateX0，Enter展开成功，雁塔及URL保持，warn/error空。一次Tab定位未回到入口不计成功，按官方按钮聚焦重验；缩放过渡截图已由稳定截图覆盖。证据artifacts/site-region-slim-edge-qa/idle.png，viewport恢复、临时tab97关闭、用户页保留。实施810同步。纯外观不新增镜像单测／重复HTTP或PG，无数据／权限／DDL／依赖／外部上线变化，下一业务仍B01-04；最终63333身份见Git及health。

## 浏览器边缘感应与收起无顿挫（2026-11-05）

用户要求真正浏览器边界、鼠标贴边即可唤出、取消多层外壳，以及关闭不先显示完整按钮再缩回。本批覆盖容器内窄条：RegionEdgeDock通过body portal固定left0，DS header-md以下至视口底部、space-md16px透明感应区；常态按钮仅露4px且隐藏图标，贴边从上方滑出单个官方Button＋chevron-right，无外框／阴影／多重按钮。关闭直接挂载translateX-36／transition:none，无focus-within回弹；仅唤出用DS150ms。键盘关闭转交焦点但保持收起，Enter重开后焦点回面板开关。资源树hidden保留及URL／县筛选维持，窄屏入口隐藏，正文零占宽。

生产构建含类型tmp/site-region-viewport-edge-build.log通过；首轮ShellIconButton的onClick契约不接受事件，已改官方Button并重建通过。CUA1280／1042 portal直属body、感应区left0/top48/宽16、按钮窄条right4/top80/40×48；1042正文1010=工作区1010。x1,y350贴边可唤出上方按钮，终态left0/icon1，透明感应层无背景／边框／阴影；关闭立即false/-36/0s，键盘关闭focused=true且仍false/-36/0s，Enter重开成功并保留雁塔URL。服务关系切换保持收起及县参数；390隐藏入口无横溢，warn/error空。截图artifacts/site-region-viewport-edge-qa含idle/revealed，viewport恢复、临时tab98关闭、用户页保留。实施810同步，纯UI不新增镜像测试或重复HTTP/PG；无数据／权限／依赖／DDL／外部上线变化，下一业务仍B01-04，最终63333身份见Git及health。

## Header全局区域与跨板块记忆（2026-11-05）

用户批准区域提升header替换功能域名称，页面H1／副标题保留。新增region-scope纯规则、region-preference服务端按请求缓存及身份隔离、useHeaderRegion同步URL/cookie。总览／决策／台账／四分析／核验列表服务端无参数先继承记忆后生成数据，显式URL含all优先，非法参数继续原校验；launcher和品牌链接带区域，URL规范化含city/county。第一方一年cookie，正式用户sub/组织/工作空间摘要隔离，预览访客独立。正式目录不拿合成资源替代授权目录；正式/analysis及/reports继续门槛，仅保留区域上下文，行政地域读模型过滤未接入不宣称完成。

页面去重复区域组件／站址面包屑及筛选内地域；地域树与header同步，业务重置保留区域。详情保留对象归属、header改区返回列表。独立地图共享记忆和组件，无参数新tab继承，首次摘要也按区域生成，避免全省闪现；换区清选区／对比／站址，默认不选站。决策改区停止回放。窄屏优先品牌／区域／配置／用户，长路径截断并完整弹层展示；功能名只留页面标题。

最终生产build含类型tmp/header-region-build.log通过；16相关单测tmp/header-region-unit.log及32HTTP tmp/header-region-http.log通过（新增cookie首屏／显式优先／全省重置／非法父子回归），无重复PG。CUA雁塔跨launcher到容量实际16站，刷新同县；10无参数入口均同县，配置宝鸡后回台账140、树长安62、业务重置仍同县；蓝田档案固定归属不影响全局、切全省回1080列表。新地图雁塔首次16站/0.68TiB且无site、改宝鸡后总览继承。1280/904/390×5页15组无文档／header横溢，每页1H1／1选择器，warn/error空。证据artifacts/header-region-qa/sites.png为最终新tab完整header，checks.json含范围与布局；复用tab的capacity截图顶栏绘制缺失不作为视觉成功，保留诊断。搜索初次名称不匹配，按实际combobox名称重验成功。viewport恢复，临时99/100/101/102关闭、用户tab72/93保留。

实施820、规格50同步。无新依赖／DDL／权限／事实来源变更，无push／外部部署／生产上线／新聊天／自动任务；下一业务仍B01-04，陕西／费用预留／退役P2／无旧库迁移保持。最终63333身份见Git及health。

## 区域选择全状态移除下拉箭头（2026-11-05）

用户要求整体不要箭头。公共RegionSelector直接删除触发器chevron-down节点及专用group，常态／悬停／聚焦／按下／展开均不再显示或占位；区域图标、文字、DS淡底及交互轮廓保留，级联弹层内的下级指示保持。规格50及实施800同步覆盖旧策略。

生产构建含类型通过tmp/region-selector-no-arrow-build.log；CUA常态／展开／Escape收起均仅1个区域svg，宽174.61px不变、左右padding16px对称；展开截图artifacts/region-selector-no-arrow-qa/open.png。搜索框role定位无匹配后按已验证触发器发送Escape成功，验证tab103已关闭、用户原页保留。纯外观不新增镜像单测或重复业务HTTP／PG；无依赖／权限／DDL／业务事实／外部部署变化。

## 控制台风格四按钮组（2026-11-05）

用户要求参考console.vxture.com/zh-CN修订Header按钮组及组件间距，固定主题／消息／帮助／配置四项。线上参考跳登录，转查本地平台ConsoleHeader同源实现，复用发布DS ShellIconGroup／ShellThemeToggle／ShellIconButton／Button／Drawer，头像独立。组内gap-2xs4px、头像间gap-md16、24px按钮／16px图标；品牌与区域及槽间gap-xs，桌面外24／手机8、Header48。窄屏四项不隐藏，区域可收缩截断，保留图标和完整title／无障碍名。原工具组件固定帮助先于消息，因此产品组合官方部件满足用户顺序。消息仍未接入提示，帮助原站_blank、配置/settings。

发现刷新后实际深色而官方偏好context仍服务端缺省，根Providers首次浏览器挂载后重建官方ThemeProvider，使既有持久偏好与图标／账户面板一致；未新增偏好键。最终build含类型tmp/header-button-group-build.log及32HTTP tmp/header-button-group-http.log全通过。CUA390／904／1280三档无文档横溢、四项尺寸和间距一致；深色刷新／浅色刷新、消息开关、配置跳转、账户偏好一致、帮助_blank验证通过，warn/error空。初次窄屏遮挡已修，初次主题恢复失败不计成功。artifacts/header-button-group-qa含desktop／mobile及checks，viewport恢复、临时参考与验证页清理，用户原页保留。

规格50／实施660同步，无依赖／权限／DDL／业务数据口径变更，无push／外部部署／生产上线；下一业务仍B01-04。

## Header工具32px外轮廓／16px图标（2026-11-05）

用户纠正四工具按钮外轮廓应32px，随后明确内部图案16px。仅在四个官方按钮className统一size-control-xl，保留icon-md配方与sm图标，点击区域32×32、图标16×16；组内4px及头像间16px保持。初次control-lg实测28px已纠正为control-xl，未把该中间结果计成功。规格50及实施660同步覆盖先前24px结论。

最终生产build含类型tmp/header-tools-32-build.log通过，157编号通过。CUA1280／904／390逐项四按钮均32×32、svg16×16、文档无横溢；消息实际开关成功，warn/error空，截图和实测checks在artifacts/header-tools-32-qa。刷新初始化时一轮手机隐藏过渡0尺寸已丢弃，实际可见后复核32／16。viewport恢复、108／109临时页关闭，用户页保留。纯尺寸不新增镜像单测或重复HTTP／PG；无依赖／权限／DDL／业务数据变化，无push或外部部署。

Customer-use feedback 2026-11-07: keep filter labels accessible but visually hidden, operator left/time tools right, source watermark to seconds, selection normalized to whole hour. Keep administrative-code ascending regional order explicit. Verify built preview after restart; native datetime presentation follows browser locale.

Customer-use rows 2026-11-07: operator/region labels use foreground, numbers primary; station header simplified, operator/resource columns centered, official ActionMenu in rowActions. Nonmodal DS Dialog anchored right allows same-row toggle and continuous other-row switching. DS locked versions match yucer 15.0.0/12.0.0; installed Pagination already uses icon-only navigation. Registry latest query unavailable without auth.

Pagination correction 2026-11-07: customer-use must match sites pagination compatibility geometry (24px number buttons, 8px gaps and auxiliary type). Extracted portal/pagination.css consumed by both pages; icon-only verification alone was insufficient.

Customer-use action trigger 2026-11-07: measured DS ActionMenu default 24px target/16px glyph; user requests 32px target/24px glyph. Scoped customer-use table override uses control-xl/control-md tokens.

Customer-use 2026-11-07: operatorCount exact 1..5 counts full occupancy and intersects filters. OperatorIdentity uses official website favicons plus names. Period input follows hour/date/ISO week/month. Single available snapshot is selected as nearest valid data for any requested period; preserve period, disclose snapshot time, disable adjacent navigation at catalog boundaries. No historical aggregation invented.

Customer-use occupancy facets 2026-11-07: replace dropdown with visible all/1..5 count buttons above table; counts use region/operator/search scope before occupancy selection, so categories remain comparable. Table headers shortened to station name, region, resident operators, related resources, actions.

Customer-use controls 2026-11-08: occupancy is one compact sliding SegmentedControl using Phosphor 1..5 pip icons from the existing icon family, counts retained and accessible labels/tooltips explain cardinality. Table uses DS indexStart (64px centered sequence column), 32px station icon spanning the two-line title; ViewModeSwitch sits first in the operation row and real ListCardGrid shares filters/pagination/details. Keep Workspace identity across query navigation; sync search from query so card mode persists through filtering/page changes.

Customer-use outside dismissal 2026-11-08: nonmodal station detail dismisses on unrelated outside interaction; preserve interactions on station rows/cards and their owned portaled action menus so row switching keeps the same panel. Date input precedes period selection and uses native content sizing instead of fixed 26ch. Verified blank/header dismissal, continuous row/card switching, menu details, and hour/day/week/month positions/widths after production rebuild/restart.

Customer-use visual refinement 2026-11-08: occupancy sliding thumb shares surface-selected-hover with the list/cards switch for clear selection. Station row glyph changes from 32px blue building to 16px foreground map-pin (supersedes the earlier 32px station-icon instruction); cards use the same map-pin identity.

Customer-use card refinement 2026-11-08: remove card sequence numbers; map-pin uses a 40px tinted icon box; station code followed by small regional address in description, wrapping on narrow screens. Operator identities and right resource count share one row aligned with title text. Cards use one column below 48rem. Pagination has 16px top/bottom padding and countLabel starts with total prefix. Production build/restart, title/meta x alignment, no card/page overflow at 390px, detail opening and pagination spacing verified.

Customer-use summary and distribution 2026-11-08: replace three oversized KPI tiles with a compact 38px inline station/device summary; hide service-relation metric (station x operator associations, not contracts). Operator rows include scoped device-ID-deduplicated totals alongside site counts; shared equipment may occur in multiple operator totals. Both distribution grids use matching 48px rows and 8px gaps. Six model tests and production build passed; restarted 63333 preview and reloaded user tabs. CUA 1042 confirmed all five row bounds match exactly; 675/390 no page/operator overflow. Evidence artifacts/customer-use-qa/compact-summary-aligned.jpg; viewport reset.

Customer-use toolbar metrics 2026-11-08: move station/device totals into filter toolbar; use 16px DS building/database glyphs followed by values and units, keeping metric meaning in title/accessibility labels. Operator selector aligns to far right. At 1280 all controls occupy one row; narrower layouts put date/period tools below metrics plus operator. Removed separate summary row. Production build passed after correcting unsupported tower glyph to building; restarted preview and reloaded both user tabs. CUA 475 screenshot artifacts/customer-use-qa/toolbar-inline-metrics-475.jpg; 390/475/1280 no horizontal overflow, right edges match, 1280 all top coordinates equal. Viewport reset.

Customer-use toolbar typography 2026-11-08: user requests bold totals and period labels with consistent remaining text. Measured prior controls all 14px but mixed 20.77/22.1px line heights and 400/500/600 weights. Scoped toolbar now shares DS body font family/14px/22.1px/400; summary strong values and all hour/day/week/month options use DS bold 700. Native datetime edit inherits same font. Production build/restart passed; CUA computed styles confirmed both numbers and all four options 700, units/operator/date/reset 400 with identical size/family/line height; 475 no overflow. Evidence artifacts/customer-use-qa/toolbar-typography-475.jpg. Viewport reset and user tabs refreshed.

Customer-use regional return 2026-11-08: city/county panels expose one official ghost Button with left arrow and Return to parent label in PanelCard action slot, 32px target; county clears county only, city clears city/county, preserves all business query filters and resets page1. Province root omits return. County terminal fallback changed from oversized multiline CTA inside fixed 48px grid row to the same name/progress/count row (selected county count, 100% when nonzero). Shared regional row uses minmax label/auto values to prevent long names overflowing. Build/restart passed. CUA province-city-Chang'an-county-city-province links verified, 10 cities restored, county62/progress100, 475 panel fully contains48px row, 390 no document/panel/row overflow. Screenshot artifacts/customer-use-qa/region-county-return-475.jpg; viewport reset, user tabs reloaded/preserved.

Customer-use page size and occupancy geometry 2026-11-08: enable official Pagination built-in page-size control before page navigation, choices10/20/50/100 default20, accessible Chinese labels. Validate pageSize in customer-use model, retain in business links, reset page1 on size change, use value for list/card slices and sequence offsets. Seven model tests passed including invalid/repeated sizes and unchanged summary/facets. Occupancy sliding pseudo-element now occupies the same CSS grid cell as buttons with exact shared dimensions, uniform4px padding, outer radius-lg10px and concentric inner6px, auto button height instead of h-full; preserves animated thumb and selected palette. Pagination wrapping gap reduced to DS8px vertical/16px horizontal. Final build/restart passed. CUA50 ->50 rows, next ->12 with first index51, refresh keeps50; changing10 resets page1/index1, cards10 then20 and list persistence verified. 475/1042 screenshots page-size-475.jpg and occupancy-insets-1042.jpg under artifacts/customer-use-qa; four measured button edge gaps4.67px including border, thumb/button22.67px height69.09px width match, 390 no page or pagination overflow. User tabs refreshed, viewport reset.

Customer-use operator order 2026-11-08: user supersedes far-right placement; move existing operator Select into time tools directly before date input. Remove stale grid column rules for selector, retain summary left and one control group right on wide screens, wrapping in same DOM order on narrow screens. Production build/restart passed, user tabs reloaded. CUA475 operator/date same row in requested order,1280 same row/order confirmed,390 no overflow; evidence artifacts/customer-use-qa/operator-before-date-475.jpg. Viewport reset.

Customer-use full control audit 2026-11-08: measured query500 vs reset400, parent-return12px vs filters14px, operator options/menu12px, logo options uneven33.79/41.12px and detail close16px wide. Normalize business toolbar/search/parent-return/related-link/options/row menu to DS body14px/400/22.1px, selected table toggles600; preserve totals+period700, station titles14px600, operator/region labels14px500, compact pagination12px500 per sites contract. Select content scoped class, all six options now32px and inline wrapper flex removes logo baseline height; selected/option logos16px. Row-menu styling scoped via page trigger open state and body:has; no global overrides. Detail close target32x32/icon16. Production build/restart passed; CUA computed styles verified exact heights/weights/options/menu/close, list/card title semantics,1042 and475/390 no overflow. Evidence artifacts/customer-use-qa/control-audit-options-1042.jpg and control-audit-options-475.jpg. Initial viewport changes targeted an inactive tab; discarded incorrectly labeled captures and rechecked475/390 on active auditMobile before final screenshot. User tabs refreshed and preserved, viewport reset.
Customer-use action row spacing 2026-11-08: approved unified row contract implemented across top analysis filters, table tools and pagination: min-height48px, vertical padding8px, wrap gap8px/group separation16px. Functional groups own8px control gaps without edge padding; operator/date and period/paired arrows have explicit wrappers, paired arrows stay together. Consolidated obsolete search/grid/breakpoint rules; view switch gap8px, occupancy retains4px inset and independent horizontal scrolling without scrollbar-added row height. Pagination size selector32px; existing24px page buttons centered in32px area. Table panel removes duplicate bottom padding; narrow panel header/content use16px shared horizontal padding to contain280px full page navigation at390px. Existing typography and business behavior preserved.
Final production build including type checks passed (tmp/customer-use-spacing-build.log), preview63333 restarted and both user tabs reloaded. CUA1280/1042 measured all three rows48px/padding8/gap8x16 and identical table/footer x/width;475 table filters32px and both footer groups32px separated8px, arrows same y;390 page navigation280px contained in308.67px shared content width with no document overflow. Page size10 and20, occupancy5 count66, actual card/list10 records, station search and detail open/outside-close verified; console warn/error empty. Evidence artifacts/customer-use-qa/action-row-spacing-1042.png plus full-page capture. Viewport reset and temporary tab closed. Pure layout, no added mirror tests or dependency/DS publication changes.
Customer-use grouping and global reset icons 2026-11-08: user corrected grouping to operator | period selection | reset. Date, hour/day/week/month segmented control and paired navigation arrows now share period group (8px internal gaps,16px between three groups,8px wrap). Arrows and reset use DS icon-xl32px targets with16px glyphs. Date picker32px target starts at input left edge; glyph measured8px from input left/top/bottom, input padding-left32/right8. Period group may wrap date and navigation subgroup at390 while keeping arrows together.
Global composed ResetButton uses official DS Button/Icon/Next Link, shared32px/16px geometry and operation-specific aria-label/title, no visible text.17 JSX usages cover customer-use, sites, usage-review, invalid-query recovery pages, legacy metrics defaults, map display/topic/overview defaults, overview preferences and analysis template defaults. Map locate/reset already icon-only retains its locator identity. Scoped compatibility geometry protects the existing isolated legacy skins; no DS package publication. Initial two build attempts exposed DS discriminated ButtonProps incompatibility; corrected wrapper to native ButtonHTMLAttributes plus restricted ghost/outline variants. tsc passed, final production build/type checks passed in tmp/customer-use-icon-reset-build.log,63333 restarted and both user tabs refreshed.
QA475 confirms three groups, period date/navigation8px and reset16px, three square buttons32/glyph16, date insets8 each.1280 hour mode one48px row with three groups,390 day/hour no overflow; period wraps to72px keeping navigation32px. Sites, usage-review, invalid-query link, legacy metrics defaults, map layer/summary defaults and overview settings measured32/16 with empty visible text and accessible labels. Source AST audit17 migrated/zero text reset/default buttons. Customer other operator7 -> reset62 keeps610100/610116, periodhour -> resetday; invalid query reset returns customer use. Console warn/error empty on final customer page. Evidence artifacts/customer-use-qa/three-groups-reset-475.png and three-groups-reset-1280.png. Temporary tab closed, viewport reset, both user pages preserved. Spec50 updated. No new mirror tests for styling; no business data/permissions/DDL/dependencies/deployment changes.

Customer-use heading and search 2026-11-08: shared customerUseIcon plugs-connected replaces the people glyph in launcher maps, business module and customer page including unavailable states. Public PageHeading accepts optional official IconName and delegates48px icon to DS ViewHeader. Table search uses DS InputGroup with16px magnifier,32px field and ResetButton,300ms trailing debounce, immediate Enter, IME composition guard and pending-timer cancellation. Query navigation replaces URL without scrolling; draft guard prevents older query responses replacing newer input. Table reset clears occupancy/search/page/view/selection, retaining region/operator/period/asOf/pageSize.
Type check,9 navigation/model tests and final production build including types passed (tmp/customer-use-heading-search-build.log);63333 restarted and both user tabs reloaded. CUA search DEMO-00009 returned1 without Enter and retained focus; Enter DEMO-00011 returned1. Reset restored62, list and all occupancy while keeping610100/610116/week/pageSize10; resetting immediately after typing cancelled the queued query.475 measured48px heading glyph,32px search/reset and16px glyphs;390/475/1280 no page overflow. Launcher and heading SVG path matched; console warnings/errors empty. Evidence artifacts/customer-use-qa/heading-search-1280.png. Viewport restored, temporary QA tab closed, both user pages preserved. No dependency/DDL/permission changes or external deployment.

Customer-use card padding correction 2026-11-08: user reported unequal panel edges. Removed the local customer-use-table-panel padding-bottom:0 override, restoring official PanelCard32px top/bottom; pagination keeps its independent8px operation-row padding. This supersedes the earlier spacing entry's zero-bottom decision. Production build/types passed tmp/customer-use-card-padding-build.log,63333 restarted and user tabs reloaded. CUA475 and1280 measured32px top/bottom;475 footer-to-panel edge32.67px including border and no document overflow. Evidence artifacts/customer-use-qa/card-bottom-padding-475.png. Temporary tab closed, viewport reset and both user tabs preserved. Pure one-rule style correction; no mirror tests or dependency changes.

## Operator identity configuration and supplied presets (2026-11-08)

Implemented approved six-party configuration at /settings/operators under configuration/business parameters: tower, mobile, unicom, telecom, broadcast, other; full and short names, raster logo upload/preview, cancel, restore per-party defaults. Shared provider supplies names/logos to business pages, filters and map; immutable report snapshots retain their original evidence. Tower remains excluded from the five-operator occupancy count. Business chart uses one 40px independent logo column across both lines; inline marks are 1em. Removed duplicate inline logo from chart labels during final visual QA.

Persistence is server filesystem, workspace-hashed directory with atomic rename, exclusive write lock and optimistic revision, separate from .next. Production requires BSMOSS_OPERATOR_IDENTITIES_DIR persistent shared volume; local preview defaults to portals/app/private/operator-identities. Added independent admin.operators.view/edit baseline permission declarations without applying DDL. Formal requests use existing entitlement/session/workspace policies, exact Origin/no-store/bounded JSON. Uploaded PNG/JPEG/WebP <=512KB is decoded by direct sharp0.35.5 dependency, dimension bounded, re-encoded PNG <=512px and stripped of metadata; no remote/user SVG. Other tabs notified and focus/interval refresh read server state. Preview maintenance remains explicitly enabled, no SSO and loopback binding.

User supplied artwork in D:/MyWebSite supersedes earlier downloaded presets: tower201b6fb55b30a559.webp, mobilechina-mobile-png-logo-8448.png, unicom0762.HK.png red mark, telecomchina-telecom-logo-png_seeklogo-557716.png, otherothers.webp latest circular version updated16:09. Broadnet retained prior source. Removed baked checkerboard/white backgrounds where present, normalized all six to512x512 transparent canvas with32px equal canvas insets and preserved aspect ratio; public PNGs plus existing SVG paths wrapping embedded PNG for stable saved defaults. README documents source/processing; originals unchanged. tmp/operator-preset-sources.json records hashes and tmp/operator-presets-square.png is contact sheet.

41 focused tests passed in tmp/operator-identities-tests-final.log (rules, raster re-encoding, workspace persistence/concurrency/revocation/independent permission, access/management/navigation/customer-use). Final production build/types passed tmp/operator-identities-build-final-qa.log, docs numbering212 passed tmp/operator-identities-docs.log,63333 restarted with preview on. CUA saved temporary Mobile full/short name and uploaded PNG, observed no-refresh customer-tab update and unchanged62sites/536devices; restarted server, reloaded configuration and verified persisted custom values, then restored default and saved. Cancelled subsequent edit leaves default intact.475/390 config dialog fits without horizontal overflow;1280 six logos loaded and natural512x512, business475 width475 and exactly5 chart logos40x40, inline table12px follows12px text. Console warn/error empty. Evidence artifacts/customer-use-qa/operator-logos-475.png and operator-configuration-1280.png. Viewport reset, customer user tabs and configuration deliverable preserved. No external deployment, push or database application.

## Operator flat list and custom providers (2026-11-08)

User requested removing the single Card and supporting additional operator service providers. /settings/operators now shows a semantic flat ul/li list with no outer border/background or duplicate subject header/description, retaining logo, short/full name and32px edit actions. Page heading contains Add provider32px/14px action. Official Dialog handles create/edit; generated provider_UUIDhex stable identity, default generic logo, name/logo editing, cancel, per-preset restore or custom logo-only restore. Explicit button types prevent accidental form submission during cancel/reset/reload. Max100 records; normalized case-insensitive duplicate full/short names denied, original six required and unreplaceable through create. Provider records persist with same workspace isolation, lock/revision and independent edit permission. Shared OperatorLogo/Name support custom records and safe generic fallback; source-bound five-code query menus intentionally remain limited to supported source relationships, so catalog addition alone does not invent data or invalidate existing query parsers.

Six identity tests pass tmp/operator-providers-tests.log, including new create/edit/reopen/workspace/duplicate/limit/invalid-code cases and authorized service create followed by revoked update. Final build/types passed tmp/operator-providers-build-final.log, docs numbering212 passed tmp/operator-providers-docs.log;63333 restarted with default persistence root. CUA isolated ephemeral server50689 with tmp/operator-provider-qa-de5f20d99da44a11ab50395f34ad9dcc verified create7th record, reload persistence, reopen/edit, duplicate Mobile error, custom PNG upload and saved edit. Actual63333 remains6 records, no test entries. Isolated QA tab/server closed/stopped, files retained only under ignored tmp. CUA475 final list transparent border0, add32px14px, no horizontal overflow;390 dialog fits/rows7 in isolated QA,1280 final six rows/no overflow. Console warn/error empty. Evidence artifacts/customer-use-qa/operator-providers-flat-475.png and operator-provider-create-390.png; viewport reset, temporary tabs closed, original three tabs preserved and config page refreshed. Specs50 supersede fixed-six-only statement. No DDL applied, dependencies unchanged, no push or external deployment.

## Customer-use logo spacing and card address footer (2026-11-08)

User feedback applied locally: operator chart logo/column32px instead of40, column gap16px instead of12;48px rows and existing alignment retained. Scoped operator links suppress underline including hover/focus-visible, primary-hover text color keeps normal foreground/keyboard outline. Existing ListCard composition now shows only station code below title, meta wrapper aligns with title using shared icon/spacing tokens; operator/resources row remains above address footer, which has16px map-pin, region text, shallow dashed top divider and12px top spacing. No shared logo sizing or table layout changes.

Production build/types passed tmp/customer-use-logo-card-build.log and63333 restarted, both original customer tabs reloaded. CUA475 computed all5 logos32px/gap16/row48, no underline; card address below metrics, dashed border,16px icon. Screenshot artifacts/customer-use-qa/operator-logo-spacing-475.png and card-location-footer-475.png.390/475/1280 no document/card overflow;390 operator labels wrap inside metric row while resource remains right. Desktop card0009 ->0011 detail switch verified after state settles; initial immediate snapshot still0009 discarded. Keyboard-focused Telecom reached exact primary-hover rgb23,64,212 with no underline after transition. Console warn/error empty. Viewport reset, temporary24 closed and original3 tabs retained. Specs50 updated; pure layout change, no new mirror tests or dependency/data/permissions/DDL changes, no external deployment/push.

## Site analysis baseline and sharing migration (2026-11-08)

User approved extracting customer-use conventions and implementing sharing. New site-analysis workspace/model/summary/scoped CSS compose installed official DS15 components. Domain wrappers supply presentation, metrics and overview render slots; shared workspace imports no customer-use or sharing business calculations. Customer-use retains its route/query compatibility,32px operator logos,16px gaps, foreground hover-only links and dashed address footer. Shared operation rows use minimum48px,8px vertical padding,8px internal/16px group gaps,32px controls; narrow pagination now keeps total/page-size together and navigation on its own second row instead of three rows.

Sharing at /sharing is active in business navigation and Launcher with one shared icon identity. Legacy /capacity and all other pending destinations remain available. Pure sharing rules deduplicate station IDs and provider relations, merge duplicate station records, exclude tower/blank providers, count occupied >=1 and shared >=2, and return null for empty ratio denominators. Actual custom-provider relationships count; catalog entries alone do not. Region/operator/snapshot defines the cohort; search and exact tenant count affect details only. Provider scope preserves full-site tenancy. Current local snapshot has1080 occupied/shared sites,100% sharing,3.61 average tenancy and0/60/1020 sites in1/2/3+ categories. No lease availability, capacity opportunities or historical trends are invented; formal non-preview mode remains data-not-connected.

17 customer-use/sharing/navigation/region tests passed in tmp/site-analysis-tests.log. Standalone type check and final production build including types passed in tmp/site-analysis-sharing-build-final.log;63333 restarted with final output and original customer pages refreshed. CUA province -> Xi'an240 -> Chang'an62 -> parent returns verified. Tenant count5 gives4 details while cohort stays62; live station search gives1, reset restores62; pageSize10 and next page gives10 rows starting11. List/cards work; detail switching preserves dialog DOM ID, same-card click and outside-heading click close. Launcher actual navigation and heading icon equality verified, pending destinations retained.

CUA both pages at390/475/1042/1280 had no document/control/region overflow. Desktop analysis/table/pagination rows48px; narrow pagination88px. Customer logos32px and62sites/536devices preserved. Console warnings/errors empty. Evidence artifacts/site-analysis-qa/checks.json, customer-pagination-475.png and sharing-overview-1280.png. Viewport reset, temporary26 closed, sharing25 retained and original customer tabs refreshed/preserved. Spec50 and implementation262 record contracts and boundaries. No dependency/DS publication/DDL application/permission changes, commit, push or external deployment in this migration.

## P3 monitoring coverage (2026-11-08)

User explicitly approved P3 monitoring; prior customer-use/sharing are P1/P2. /monitoring activates the runtime group's first module; waveform identity is shared by Launcher/page and all legacy pending destinations remain. Strictly uses existing site-analysis CSS/workspace; no monitoring-specific stylesheet or new primitives. Added generic query/reset/facet/card/detail slots and optional resource column; default P1/P2 behavior retained. Extracted common distribution/region overview consumed by P2/P3 and removed P2's redundant structure stylesheet. Installed DS15 remains unchanged. Initial type check caught unsupported radio icon, null-only navigation types and unsupported SegmentedControl style prop; corrected to official waveform, widened time bounds and put inherited facet variables on the existing outer wrapper before successful build.

Pure monitoring rules distinguish valid records (including zero), confirmed expected-but-missing, explicitly unconnected and unknown; absence never proves offline. Physical stations and timestamps deduplicate. Coverage requires a fully known applicability denominator and displays -- otherwise. Preview uses existing physical supply/temperature/energy observations for24 hours on2026-10-25; provider selection limits station cohort without allocating physical energy. No connection inventory/applicability/frequency evidence is invented, no completeness or online rate calculated. Cohort summaries/regions stay independent of table search/status. Hour steps use actual records; day/week/month include only existing in-window observations; missing periods select nearest valid record. Source watermark remains independent of selected latest record.

22 model/rule/navigation/region tests passed (tmp/p3-monitoring-tests.log), covering state boundaries/zero/invalid data/dedup/unknown denominator/time bounds/nearest periods/cohort reconciliation and physical operator scope. Production build with types passed tmp/p3-monitoring-build.log including /monitoring;63333 restarted and existing customer/sharing pages refreshed. Source ASCII, diff whitespace and214 numbered docs passed. No source changes after build except an additional dedup test assertion and docs.

CUA province1080 -> Xi'an240 -> Chang'an62 -> city -> province verified. Missing-state selection shows0 details while cohort stays62; live and Enter search return1; table reset restores62. Detail shows24 records per metric for day, connection unknown and actual latest23:00. Hour23 ->22 updates data and forward boundary; earlier requested2026-01-01 resolves00 with previous disabled, next ->01. WeekW43/month2026-10 native inputs verified. PageSize10/page2 has10 cards starting0055 (list sequence11); cards0055 ->0059 preserve dialog DOM ID, repeat closes. Outside heading closes; initial click timeout already closed the panel, confirmed from fresh DOM. Provider Mobile retains physical energy records. Launcher actual navigation toP1/P2/P3 works and heading/entry SVG equality true.

All3 pages at390/475/1042/1280 have no document overflow; desktop operation/table/pagination rows48px,8px vertical padding and8/16px gaps. P3 narrow table/footer88px, P1 logos32px and P2 distribution0/60/1020 retained. P3 actual475 cards fit389px with dashed address footer. Initial pre-hydration card click had no effect; fresh DOM confirmed unchecked, then actual hydrated action passed. Some inactive-tab/resize captures were stale; discarded and replaced using active temporary30 at475, measured actual dimensions before final screenshot. Final overview1280 and cards475 evidence plus checks.json under artifacts/p3-monitoring-qa; console warn/error empty. Viewport reset, temporary27/28/30 closed, P3 deliverable29 retained, original user tabs preserved. Spec50 and implementation263 updated. No new dependency, permission, DDL application, database migration, commit, push or external deployment.

## P3 unified runtime monitoring (2026-11-08)

User approved combining monitoring coverage, current runtime and alarm/fault evidence in one page, with details expanded rather than forced category pages. /monitoring and Launcher now use Run Monitoring; runtime navigation has monitoring plus planned Trend Review. Legacy pending destinations remain. Strictly reused site-analysis workspace/CSS and official DS15; generic optional overview lead/footer and hideOperatorColumn composition slots only, no P3 CSS, package or permission changes.

New runtime-rules applies existing versioned reference thresholds: battery supply is warning/attention, temperature35/40C and physical energy intensity0.15/0.30kWh/GiB. Exact endpoint sample determines current state; stale/missing never becomes normal. Period concerns use only window records; hourly window cannot include future data. Current and period counts separate, dataIncomplete counts independently even when other indicators trigger concern. Rule runs join consecutive hours only; missing/invalid samples never prove clearance. Formal alarm evidence distinguishes unknown source null from confirmed empty0 and respects historical as-of/open intervals, deduplicated IDs. Actual source is absent, so UI shows --/pending rather than fabricated0 or rule events as faults.

Page includes compact scope/current/period/alarm/data metrics; readable rules-generated runtime summary, three signal distributions with current/period numbers, period-concern regional comparison, expandable coverage. Main table has prioritized current severe/warning stations, primary concern, source alarm status and observed timestamp/metrics. Shared cards and continuous side panel show raw current values, threshold evidence, rule-hit segments, deterministic review suggestions and expandable hour charts/table/coverage. No LLM has been connected or claimed; source synthetic preview is disclosed in notes. Series are attached only for visible page station IDs. Old recordState links still supported; runtimeFilter/search do not change cohort overview. Trend Review remains planned for cross-period recurrence and persistence, not a separate page for the current-hour chart.

28 focused rule/model/navigation/region and P1/P2 tests passed tmp/p3-runtime-tests.log. Final production build/types passed tmp/p3-runtime-build-final.log; fixed a JSX literal escape caught in browser before final build, then restarted63333 and reloaded deliverable/customer/sharing pages.214 docs numbering and ASCII checks passed; diff check has no whitespace errors. No source edits after final build.

CUA confirmed current filter582 details with province1080 unchanged; province1080 -> Xi'an240 -> Chang'an62 -> city/province returns; first immediate post-navigation read6 was stale and discarded, final explicit URL610116 and62 confirmed. Runtime current severity order changes at22 vs23 hours. Hour23 ->22 yields exact22 readings and one-hour clue only; no future hour included. Day detail has24 records; charts have correct Chinese names. Sidepanel0009 ->0027 preserves same dialog ID, repeated row closes, heading/outside closes. Day battery clues and intensity reference values shown transparently.390/475 no document or card/control overflow;475 sidepanel448/scroll433 fits, charts/records expand. Desktop1280 operation/table/pagination rows48px,8px vertical padding,8/16px gaps. P1 Chang'an62sites536devices and P2 province1080/100%/3.61 retained. Launcher shows runtime2 entries, monitoring active and trend planned, legacy pending section intact. Browser warn/error empty. Screenshot artifacts/p3-runtime-qa/overview-1280.png. Viewport reset, temporary QA tab closed, P3 tab29 plus sharing25 and operator20 deliverables preserved; original user tabs retained. No DDL, commit, push or external deployment.

## P3 compact overview refinements (2026-11-09)

Applied browser comments to runtime overview: dynamic as-of/current/severe/period summary is now the Run Attention card subtitle with existing filter links; generic subtitle and repeated lead removed. Three same-library Phosphor icons (battery, thermometer, lightning) use independent32px columns and16px gaps matching operator distribution. Bottom review/alarm-source message sits after a shallow dashed divider. Shared overview supports optional icon/meta row content and ReactNode subtitle without changing P2 defaults.

User corrected the initial expandable evidence implementation: final version has NO per-signal details/second click. Direct right-aligned single line below each progress bar shows trigger/threshold and observed station count. Battery has trigger battery, temperature35/40C, intensity0.15/0.30; intensity unit kWh/GiB and short boundaries appear in hover/focus Tooltip. Observed counts are recorded stations, not an invented coverage percentage. Removed verbose paragraphs and folding controls. Single shared DS Tooltip on entire top summary replaces per-item native titles; all labels/counts and short definitions show together. Period abnormal is no longer an independent top metric: four metrics remain plus a plain muted note after them, included in the same Tooltip. Shared optional metricsNote and metric.description keep other pages unchanged by default.

Final production Next build/types passed tmp/p3-feedback-final-qa-build.log using already prepared unchanged assets; earlier full pipeline passed tmp/p3-feedback-build.log. Source ASCII/raw JSX escape and whitespace checks passed,214 docs numbering passed tmp/p3-feedback-final-docs.log. Final compact separator is ASCII pipe, replacing a raw JSX escape caught in browser QA. Restarted63333 preview and reloaded original monitoring tab29. Pure layout/content changes, no new mirror tests, business data/calculation/permissions/dependency unchanged.

CUA final390 has4 stats plus period note; all3 metadata lines24px high, no folds, no document overflow.984 all3 icons32px, metadata right edges match content right edge; brief intensity Tooltip shows units/bounds without a click; summary Tooltip has4 values plus short definitions and period note. Warn/error console empty. Earlier common-summary regression confirmed P1 Chang'an62sites536devices with5logos32px, P2 province1080/100%/3.61 and3 unchanged no-icon distribution rows. Screenshot artifacts/p3-runtime-qa/compact-overview-984.png is final deliverable; earlier summary-tooltip-984 raster did not capture the transient overlay and should not be used as overlay evidence. Viewport reset, temporary feedback QA tab closed, original tab29 retained. No commit/push/DDL/external deployment.


## P3 severity and monitored station share (2026-11-09)

Removed the operator control only for monitoring via optional shared composition. Monitoring normalizes legacy operator/operatorCount/sharing inputs to all so hidden tenancy inputs cannot silently narrow physical-site data; P1/P2 retain their filters. Signal summaries now count period warning/critical exclusively per station+signal using highest clue severity, retaining separate current top summary/table semantics. Battery has warning only; temperature and intensity show explicit colored warning/critical thresholds. Shared official Progress supports optional semantic orange/red segments, with a scoped fill-width/transform composition ensuring segment proportions match counts rather than a translated full-width gradient. No P3 stylesheet, new primitive or dependency.

Direct metadata now shows monitored station count and percent of current regional station total, using valid in-period observations: supply type, finite temperature, or computable energy intensity with positive bytes. No observations =0%, empty cohort =unknown; this observed regional share is distinct from applicability-based coverage/online/completeness. Short Tooltip explains highest-level dedup and denominator, no expansion. Province day counts: battery warning180; temperature warning180/critical0; intensity warning415/critical665. All3 monitored1080/1080.

29 focused rule/model/P1/P2/navigation/region tests passed tmp/p3-severity-tests.log, standalone types passed tmp/p3-severity-types.log, production build/types passed tmp/p3-severity-build.log;214 numbered docs passed tmp/p3-severity-docs.log.63333 restarted and original monitoring29 reloaded. CUA984 verified no operator control, semantic text colors and exact fill widths/gradient break38.4259% for415/1080. Legacy other/count5 county URL still62sites, hour23 intensity warning25/critical6, all3 monitored62/62. Actual previous-hour click canonicalizes operator all, hour22 temperature warning11 and intensity20/3. Day click gives intensity22/40 across62. A subsequent immediate parent-click read was stale and is not evidence of parent completion.390 actual fresh raster has no document or metadata overflow; screenshot taken immediately on resizing was transient/stale and discarded. Shared P2 operator selector retained,1080/1080/100%/3.61 and distribution0/60/1020; P1 county62sites536devices. Console warning/error empty. Evidence artifacts/p3-runtime-qa/severity-984.png and severity-390.png; viewport reset, temporary33 closed, original29 retained. No source changes after final build, no DDL, commit, push or external deployment.


## P3 configurable runtime parameters (2026-11-09)

User authorized moving thresholds into configuration. Existing /settings/rules now provides a flat Runtime Monitoring Parameters form: battery attention switch, temperature warning/critical and energy-intensity warning/critical fields. Official DS inputs/switch/buttons, shared ResetButton, semantic colors and32px same-family icons only; no new stylesheet/primitives/dependencies. Save, cancel to saved, and restore-default draft requiring save. Rule catalog retains other6 built-in definitions below; its filter/search moved into that section. Monitoring card links to parameter section. Default35/40C,0.15/0.30kWh/GiB and battery on restored after QA; persisted configuration is now revision2. Other legacy topic/map rules and immutable reports remain their built-in baselines.

New pure parameters validation rejects non-finite/non-numeric/incomplete/extra/forged-workspace fields, non-increasing severity, nonpositive intensity, and below-absolute-zero temperature. Workspace file store uses hashed paths, exclusive lock, expected revision, commit-time authorization recheck, fsync/temp/atomic rename and server timestamps/subject. Root BSMOSS_MONITORING_PARAMETERS_DIR required formally, preview private/monitoring-parameters; existing corrupt files fail closed. New independent admin.analysis_rules.view/edit permissions declared in baseline only, no DDL applied/automatic grants. HTTP exact-origin JSON8KB, RP identity/entitlement/workspace, private no-store/VaryCookie; explicit loopback no-OIDC preview maintenance only.

Monitoring loads one validated server snapshot and injects it into pure assessRuntime/reviewRuntime: current/period summaries, regional counts, facets, ordered rows, detailed context and policy version agree. Shared dynamic labels replace hardcoded notes/tooltips/detail thresholds. Previously observed selected times are re-evaluated with current parameters without changing observations. Same-tab event/BroadcastChannel/focus/visibility/60s revision poll requests server router.refresh rather than separately changing client labels. Errors never silently substitute defaults.

39 focused rules/model/catalog/P1/P2/navigation/region tests passed tmp/p3-parameters-tests.log;23 access/operator regression tests passed tmp/p3-parameters-access-tests.log. New cases cover custom boundary equality/battery disable, unchanged observations, full model recalculation, workspace isolation/reopen, concurrency/stale/revocation/corruption and independent permissions/entitlement. Standalone types and initial build passed; final production build/types passed tmp/p3-parameters-final-build.log after fixing unequal input widths found in browser. No source edits after final build.214 docs numbering passed. Live HTTP checks tmp/p3-parameters-http-tests.log confirmed wrong origin403, wrong MIME415, query/ordering/forgedworkspace400, stale409, oversized413; all rejected writes left saved config unchanged. Initial exact Vary header assertion was too strict because Next adds RSC values; corrected assertion verifies Cookie membership.

63333 restarted with final build. CUA actual invalid45/40 save blocked and cancel restored35. Saved r1 temperature30/32, intensity100/101 and battery off; already-open monitoring tab29 automatically showed temperature periodwarning360/critical720, current180, battery0, intensity0. Row ordering changed, so attempted old0009 no longer on first page; fresh DOM identified0010. Its33.6C current critical and detail30/32,100/101 plus battery-off message matched. Reload form and actual service restart retained r1; verified fresh monitoring after restart. Restore defaults changed draft only, monitoring stayed custom until Save; saved r2 restored battery180/temp180/0/intensity415/665. Field widths all205.33 at984 and155.33 at390; no document overflow, icons32. Config and monitoring console warnings/errors empty. Final screenshots artifacts/p3-runtime-qa/parameters-1280.png and parameters-390.png. Viewport reset; original29 and new config34 marked deliverables. No external deployment, commit, push, permission assignment or DDL application.


## P3 regional correspondence and filter feedback (2026-11-09)

Reproduced actual filter clicks before edits: current582 and data0 did update URL and footer. All/period both1080 and current-priority sorting keep first rows identical, obscured by icon-only controls. Added desktop short labels, compact icon/count mobile alternative, pending and completed full filter/count live status. Facet transitions cancel queued search timer and carry current draft so stale debounce cannot overwrite a newer filter; page resets1. Shared optional width/result slots preserve other business compositions.

Regional overview now has exclusive period warning/critical across all signals per station, highest severity and recovered period hits retained; dedup regional sums reconcile to province. Existing periodAbnormal preserved, new periodLevels computed before client series stripping. Orange/red Progress uses local physical station denominator rather than max city. Short focus/hover Tooltip lists signal warning/critical, period unique/total and current concern/severe; overlapping types never summed. Follow-up user requested shorter card: names and warning/critical now one top row, progress below, total only in tooltip. Shared detailed-row/tooltip composition, no P3 stylesheet/new primitive/dependency.

29 focused runtime/model/region/P1/P2 tests passed tmp/p3-regions-filters-tests.log, including cross-signal overlap, recovered severe hits, exact facet sets and regional signal/severity reconciliation. Final production build/types passed tmp/p3-regions-filters-final-build.log, ASCII/raw JSX checks clean;214 docs numbering passed.63333 restarted final build and original monitoring tab29 refreshed. No code changes after final build.

CUA actual all/current/period/data =1080/582/1080/0, URL+selected state+live status+footer consistent. Lastpage54 -> current resets1; immediate search DEMO-00009 + period preserves search and yields1. Province -> Xi an -> Chang an shows22warning/40critical,62records; parent returns city then province.984/1280 all10 regional headings22.09px and rows58.09px, numbers above bars.390 no document overflow and all regional rows58.09px; compact facet can scroll within operation group, data0 click selected and empty state correct. Tooltip keyboard focus confirmed signal detail. P2 standard10 region rows/zero detailed rows and1080/1080/100%/3.61 retained; P1 Chang an62sites536devices retained. Console warnings/errors empty. Final screenshot artifacts/p3-runtime-qa/regions-filters-compact-984.png. Temporary tab35 closed, viewport reset, monitoring29/config34 preserved. No parameter writes, permission changes, DDL application, commit, push or external deployment.


## P3 visible regional totals restored (2026-11-09)

User clarified totals must remain visible after moving severity numbers above bars. Restored monitoring region value to periodAbnormal plus station unit, blue at far right of the same heading row after orange warning/red critical. No extra row, shared composition already supported value. This supersedes prior tooltip-only total decision. No calculation/filter/configuration changes. Production build/types passed tmp/p3-region-total-build.log; restarted63333 and reloaded original monitoring29 with runtimeFilter=current preserved. CUA984/1280/390 all10 headings22.09px, rows58.09px, no row or document overflow; Xi an94+146=240, other totals visible blue. Console warn/error empty. Screenshot artifacts/p3-runtime-qa/region-total-984.png. Viewport reset, original29/config34 marked deliverables. Specs50 and implementation263 updated. No new mirror tests for one display-value restoration. No commit/push/DDL/external deployment.


## P3 summary severity and total separator (2026-11-09)

User requested regional total format pipe + total prefix and current top count split. Region value now neutral separator/prefix with blue count: warning94 critical146 | total240sites. Current582 summary replaced by orange warning418 and red critical164, mutually exclusive current levels, both with short visible labels and matching icon colors; current table facet remains582 combined. Shared AnalysisMetric optional shortLabel/tone applies only when supplied; summary tooltip includes current-hour definitions and warning excludes critical. No calculation/config changes.

14 runtime/model tests passed tmp/p3-summary-levels-tests.log; production build/types passed tmp/p3-summary-levels-final-build.log;214 docs numbering and ASCII/raw JSX checks passed. Initial browser1280 caught wrap after total prefix, fixed existing region gaps to8px and prevented within-severity wrapping, rebuilt and restarted final63333. No source changes after final build. CUA984 current418/164 semantic icon/text colors and single summary tooltip verified. Final1280 and390 all10 regional headings22.09px/rows58.09px with full42px three-character names and no overflow,390document390. Current filter/query retained after reload, parameters unchanged. Console warn/error empty. Final screenshot artifacts/p3-runtime-qa/summary-levels-region-total-1280.png shows both changes. Viewport reset, original29/config34 retained. No new primitive/dependency/DDL/commit/push/external deployment.


## P3 matching runtime facets and common gap (2026-11-09)

User requested detail choices correspond to top metrics and4-8px internal group gap. Added runtimeFilter warning/critical matching exact current levels, retained current legacy combined582 semantics with conditional7th total option. Standard group6: all1080, warning418, critical164, source alarmsunknown-- disabled, data0, period1080. Alarm source still not invented. Warning/critical icon/label/count semantic colors match summary. Short visible labels all/attention/severe/alarm/missing/period, full accessible names and live result retained. Oldcurrent label now explicitly combined.

Common site-analysis occupancy SegmentedControl now4px column-gap,4px inset,32px height; slider translate includes item width+gap and supports7th legacy slot. Existing content gaps remain4px. No DS package/global token changes. Initial six long labels exceeded equal cell width; final short labels fit101px cells and636px group at984. Compatibility7th group may scroll, narrow groups retain existing scroll strategy.

29 focused runtime/model/P1/P2/region tests passed tmp/p3-facet-correspondence-tests.log, including exact level row sets and warning+critical=current, county/hour variation. Final production build/types tmp/p3-facet-correspondence-compact-build.log passed; ASCII/raw JSX and214doc checks passed.63333 restarted finalbuild and original29 reloaded keepingcurrent. No source edits after finalbuild.

CUA actual warning418/severe164/data0/period1080 and footer/status/URL agree, unknown alarm disabled. Slider settled alignment error<0.01px including legacy7th; item gaps4px, internal gap4px, inset4px and height32. Final984 all6labels/counts fit;1280/390 no document overflow, mobile32px and hidden shortlabels, exact data0 verified. Keyboard right warning->critical->data skips disabledunknown alarm. P1 county5operators->4rows and P2 province5operators->66rows via Space, both32/4; P2 summary1080/1080/100%/3.61 intact. A browser shadow-target click error on P1 was recovered by fresh state and keyboard, not treated as app failure. One immediate P3click before hydration leftall; retried after actual snapshot and verified. Console warn/error empty on finalQA. Screenshot artifacts/p3-runtime-qa/facet-correspondence-gap-984.png. Temporary36closed, viewport reset, original29/config34 preserved. No parameters/permissions/DDL/commit/push/external deployment.


## Remove unsolicited runtime filter status row (2026-11-09)

User identified standalone currentfilter/count status paragraph as outside agreed layout. Acknowledged it was agent-added and removed visible row, resultLabel shared slot/caller, and now-unused transition wrapper. Kept facet selection, query race cancellation/draft forwarding and footer totals. This supersedes all prior notes specifying a visible result/status line; no replacement row. Spec50 and implementation263 corrected.

Production build/types passed tmp/p3-remove-status-build.log;214 docs and ASCII/raw JSX checks passed.63333 restarted and original29 refreshed. Browser confirmed tabletools.nextElementSibling is table wrapper and0status rows, originalcurrent footer582 still correct; clicked warning actual footer418/checkedtrue and0status.984 screenshot artifacts/p3-runtime-qa/remove-extra-status-984.png,390 no page overflow and0status, warn/error empty. Viewport reset, original29/config34 kept. Pure layout removal, no new mirror tests or calculation/config/DS/permission/DDL changes. No commit/push/external deployment.


## P4 capacity migration (2026-11-09)

User deferred Trend Review until future LLM integration and approved Capacity next. /capacity now uses site-analysis workspace/CSS and official DS15; launcher bearing routes here and gauge identity matches heading. No standalone demand/quality pages. Legacy history=1 and map selection retain prior workflows. Formal mode remains source-pending. No new CSS/dependencies/primitives/permissions/DDL. Shared overview optional regionAction/labelContent preserves defaults; shared observed time-window extracted from monitoring with compatibility export. Removed duplicate list empty-state paragraph, card empty state preserved.

Pure capacity model reuses capacityObservation/summarizeCapacity/evaluateTopic, full site cohort, latest valid hourly snapshot, exact weighted counters. Details/search/facets independent of overview; all/high/connection/both/unknown facets, risk ordering, visible-page-only24h sequences. DataUnknown counts either missing denominator independently. Operator slices use actual service counters; shared physical station counts never summed. Synthetic normalized units are not rentable capacity; failed calls do not prove bottleneck/lost traffic. Existing static85/95load and98/95connection rules unchanged, not claimed configurable. Overview3signal rows, region/provider switch, one24h chart, full list/cards with continuous sidepanel. Table ratios use2decimal maximum to avoid apparent98percent threshold contradiction; orange/red threshold labels.

40 focused model/rule/navigation/region/P1/P2/P3 tests passed tmp/p4-tests.log. Standalone types and full production pipeline passed tmp/p4-build.log; final display refinements built/types passed tmp/p4-final-build.log,63333 restarted. Docs215 numbering passed. No code changes after finalbuild. No commit/push/external deployment.

CUA verified306lowconnection,0high; searchSX-DEMO-001=>1 with1080overview preserved; province1080->Xi'an240->Chang'an62 and returns; provider comparison.23->22->23hour step changes source values. PageSize10/page2 gives10rows starting11; cards work. Detail0356->0776 keepsDialogID,repeat closes; desktopoutsideheading closes.390drawer fits390andscroll375. Native datetime fill with seconds caused malformed-value tool error; no successful manual-date-query claim. A first prehydration click and immediate post-navigation reads were stale; actual checked state/footer waits confirm final actions.

Measured active QA tab38 at390/475/984/1280: no document/region overflow;1280 all3actionrows48px,padding8px,gap8/16. Earlier nonactive-tab batch returned1280for every request and was discarded. Evidence artifacts/p4-capacity-qa/checks.json and overview-1280.png. Regression P1county62/536,P2province1080/100percent/3.61,P3attention418critical164and0status rows retained; consolewarn/error empty. Viewport reset,temporary38closed,capacity37marked deliverable. Earlier turns'29/34 tabs were absent in this turn's browser inventory.

## P4 severity colors restored (2026-11-09)

User reported missing progress/number colors. Added pure capacityMetricLevel using existing threshold directions, signal-specific exclusive warning/critical counts in summarizeCapacity (additive return fields only). Capacity overview now uses common orange/red segmented progress and matching counts, default23h lowconnection304warning+2critical=306. Both uses highest per-site severity. Existing counters/threshold values/unknown handling unchanged. Metric spans in list/cards/detail/raw hourly table use shared capacityMetricClass; normal neutral, missing muted. Region load number/progress gets optional shared progressTone at aggregate load threshold; total staysblue. Facet risk-category counts orange. No new primitives, dependencies or module stylesheet; other overview callers retain defaults. Configuration remains proposed, not implemented.

17 focused capacity/domain/model/monitoring/common model tests passed tmp/p4-colors-tests.log (new boundary, overlap, severitypartition and regionalconservation checks); full production build/types passed tmp/p4-colors-build.log.9changed source filesASCIIclean.63333restarted finalbuild explicitpreview. CUA original37 confirms gradient304/306orange2/306red,94.57red95.58orange,detail/card94.57red.390viewport distribution rows229pxscroll229 and no documentoverflow. Resetviewport/reloaded/listview; finalconsolewarn/error0. Screenshot artifacts/p4-capacity-qa/colors-1280.png; original37deliverable. No configurationwrites/permissions/DDL/commit/push/externaldeployment.

## P4 capacity parameters implemented (2026-11-09)

User challenged omission of prior system-config request; acknowledged and implemented without another approval round. /settings/rules now has flat capacity2row/4threshold editor next to P3, removed duplicate capacity readonly catalog entries. Load>=85/95 default,connection<98/95; finite0<value<=100,loadwarning<critical,connectioncritical<warning. Save/cancel/restoredefaults draft,revision/time,independent existing admin.analysis_rules.view/edit. New domains/capacity validation/store/service/http,workspacehash/filelock/revision/atomicwrite/commit-time authorization,BSMOSS_CAPACITY_PARAMETERS_DIR formal or preview private/capacity-parameters. APIs /api/management/capacity-parameters and readonly /api/capacity-parameters. No new grants/DDL. Config errors fail closed.

capacityModel injects one configuration into all pure observations/assessment/aggregates/24h series/facets/order; workspace overview/detail numbers/colors/rulelabels consume same server snapshot. capacityMetricLevel moved to pure parameter domain; legacy map-rules default signatures compatible, no global constant mutation. Old map/history/report workflows retain builtins, reports immutable. Added shared site-analysis/parameter-refresh, P3 wrapper preserves original event exports; same-tab/BroadcastChannel/focus/visibility/60s revision reload. No new CSS/primitives/dependencies.

34 focused tests tmp/p4-parameters-tests.log,standalone types tmp/p4-parameters-types.log,fullproductionbuild tmp/p4-parameters-build.log passed,215docsnumbered,capacitysourceASCII. Actual HTTP rejection origin403,mime415,query/order/forgedworkspace400,stale409,oversize413 and unchangedconfiguration tmp/p4-parameters-http-tests.log.63333restartedfinalbuild,no subsequent source edits.

CUA config39 customr1load10/20connection1.1/1 actualsave -> existingcapacity37 auto1003high(463warning540critical)/0low,facet0works,detail0107red45.53pluscustomlabels. Reload+serviceRestartkept10/r1/1003. RestoredefaultdraftdidnotapplyuntilSave,r2restores0high306low(304/2). Monitoringconfigurationr2unchanged.390fields155.33equal,doc390;1280fields205.33equal. Finalconsolewarn/error0. Screenshot artifacts/p4-capacity-qa/parameters-1280.png; viewportreset;37/39deliverables. One combined restart command rejected by execution policy; split ordinary read and verified existing server restart succeeded, no permission request required. No commit/push/DDL/grants/externaldeployment.

## P4 compact signal label (2026-11-09)

User requested three-character label consistency. Changed only capacity overview both signal label from four-character dual-item-hit to three-character dual-hit (Chinese UI escaped). No metric/filter/configuration or calculation changes. Production rebuild tmp/p4-short-label-build.log for local63333 delivery.

## P4 region risk bars and hourly hover (2026-11-09)

User requested region colors, taller hourly card/mouse-follow numbers, attention tab renamed to three-character need-attention. Region bar now attention/sites with orange warning/red critical mutually exclusive segments; additive levels.attention highest-per-station prevents double counting. Heading retains load, attention total, total sites; severity breakdown tooltip/accessibility avoids clipped names in two-column layout. Shared AnalysisHourlyChart composes official DS BarChart/Tooltip; plot media-xl+media-lg=176px, original readout/keyboard kept. Follow pointer tooltip hour/metric/value, metric remount clears, leave/Escape clears, browser delayed titles removed. Both tooltip and Radix wrapper pointer-events none prevents self-interception found during continuous move QA. Shared chart panel subtitle spans remaining row; xaxis visible labels fixed. No new dependencies/primitives/module CSS or configuration writes.

22 focused rules/parameters/capacity/monitoring tests passed tmp/p4-chart-regions-tests.log. Final production/types tmp/p4-chart-regions-verified-build.log passed,63333 restarted; no source changes after final build.215docs numbering valid. Computer Use native pipe unavailable after retry+reset, used dedicated hidden headless Edge63334 profile tmp/capacity-chart-browser via CDP. Actual390/577/984/1280 no document overflow or truncated region names,176px plot, colored risk bars, tooltip0/8/23hour matched fixed readout, continuous horizontal+vertical movement and boundaries, leave/Escape,loadpercent switch,keyboardHome+Right=>01 passed;0Runtime exceptions. Screenshot artifacts/p4-capacity-qa/hourly-hover-390.png and other widths; checks hourly-checks.json. First Escape test waited less than exit animation, corrected400ms; keyboard test first retained DS hovered cursor override, moved pointer out before focus. No app defect claimed for these harness timing/setup cases. Dedicated browser will be closed, user browser untouched. No commit/push/DDL/external deployment.

Newest user asks analysis only for vertical dashed cursor line and numbers above. Answered feasible and helpful, recommend snapping to active bar center, full plot height, top value with edge avoidance, no horizontal crosshair, hide on leave. This proposal NOT implemented; await user's implementation instruction. Original three requested changes complete.

## P4 snapped hourly cursor and dual-hit terminology (2026-11-09)

User approved dashed vertical cursor implementation, then additionally requested all same-meaning dual-item labels unified to dual-hit. Shared hourly-chart now captures column center/plot top+height relative to chart root, renders pointer-events-none primary dashed line176px, official Tooltip top/center at line start; reserved32px margin above plot separates tooltip from permanent upper-right readout. Same-column movement dedupes state, gaps within plot retain active hour, outside/Escape/metric remount clears. Absolute local anchor handles scrolling naturally. No new primitive/dependency, preserved official DS chart/keyboard. UI names in capacity labels+region/provider tooltip+legacy capacity-panel all use escaped dual-hit; active spec50 and implementation264 replaced older double-item phrases. Remaining two-signal trigger description explains semantics; unrelated bidirectional-flow labels unchanged. No calculations/configuration/query changes.

Production build/types passed tmp/p4-chart-cursor-build.log;63333 restarted finalbuild,no subsequent source edits. Headless dedicated Edge63334 QA widths577/390/984/1280 passed line center<1px,plot top/height match176px,dashed border,top tooltip below fixedreadout and above plot,edge avoidance,stable within-bar movement,metricpercent switch,leave/Escape,Home/Right keyboard. No document/region-name overflow,dual-hit visible,no old double-item text,0runtimeexceptions. Artifacts p4-capacity-qa/hourly-cursor-checks.json and hourly-cursor-{width}.png. All215docs numbering and changed sourceASCII pass. No unnecessary new unit tests for visual/copy-only changes; production+realbrowser verification used. Dedicated browser closed; user browser untouched. No commits/push/DDL/permission/configwrites/externaldeployment. This completes previously proposed cursor feature.

## P4 hide hourly y-axis (2026-11-09)

User questioned irregular/crowded y-axis and suggested removing. Capacity overview now passes official hideAxis to AnalysisHourlyChart; removes y-axis numbers/grid and leftaxispadding without CSS/primitive changes. Hours,176pxplot,relativebars,fixedreadout,snappedcursor/toptooltip/keyboard retained. Other shared chart callers/defaults unchanged. Single display prop only,no unit tests added. Production/types tmp/p4-chart-no-axis-build.log passed;63333 restarted. HeadlessEdge390/577/984/1280 actualaxis absent,paddingleft0,xlabels00/04/08/12/16/20 complete; existingcursor/tooltipboundary/leave/Escape/loadswitch/HomeRight checks passed,0runtimeexceptions,nooverflow. Artifacts p4-capacity-qa/hourly-no-axis-checks.json and hourly-no-axis-{width}.png.215docs numbering passed. Dedicatedbrowserclosed,usersbrowseruntouched. No configwrites/calculation/permissions/DDL/commit/push/externaldeployment.

## P4 period selection now governs whole page (2026-11-09)

User identified inert period choices and required wholepage scope as basic behavior. Previously only lastvalidhour was used; superseded. capacityModel now sums original per-station counters within analysisWindow.times, then same saved-threshold evaluateCapacity classifies period ratios; summarizeCapacity accepts narrow capacity counters and legacy evaluateTopic delegates identical helper. Pure domains/capacity/period.ts sums integer counters and buckets actualtimes. Distinctphysicalsites,weightedratios,nodoublehourcounts. Region/provider summaries,facets,sort,rows/cards,details all sameperiod/config. Chart hour1point/day24hours/weekmonthactualdaily,detailseries samebuckets,detail samples actualhourly source within selectedwindow. Onlyvisiblepage gets series/samples. No invented otherdays; one-daydemo => week/month sameaggregate but coverage1/7,1/31 visible. Day32.94load/259low vs old23h27.82/306;08h30.88/180. Doublehit period means both periodratios triggered,not combining separate hourly flags.

Shared hourlychart optionalformatLabel supports daily dates without colon,existingdefaultpreserved. Onepointchart gets tokenmaxwidth centered. Capacity overview+detail use same shared chart; period title/coverage in overview/chart/detail. Sharedworkspace optionalhideSnapshotNote removes misleading extra lastsnapshot note onlycapacity; othercallersdefaultunchanged. Capacity notes explicitly periodaggregation,tablecaptionperiodsummary. Old history/map paths unchanged. No configwrites.

25 focused capacityperiod/parameters/rules/model+monitoring/common tests passed tmp/p4-full-period-tests.log;20 legacytopic/period tests tmp/p4-full-period-legacy-tests.log passed. Fullproductiontypes tmp/p4-full-period-build.log passed,63333restarted,no subsequent source edits. Newtest initially sampled inapplicableprovider and failed; removed tautologicalhelpertest,kept meaningfulweighting/zero/temporalbucket/modelconservation assertions.215docs andsourceASCIIclean.

ActualheadlessEdge clicks08hour->day->week->month->23hour summaries30.88/180,32.94/259,32.94/259,32.94/259,27.82/306 and chartpoints1/24/1/1/1. Regions/facetsmatch,bothdetailperiodlabel/series and rawrows1or24 confirmed,tooltipdateformatcorrect,livefilteredfooter259->306. Firstfastdayclick+facet race hit oldhour route in test;waitforactualcheckedstatecorrected and passed. QA390/577/984/1280 nooverflow,onepointwidth48centered,0Runtimeexceptions. artifacts/p4-capacity-qa/full-period-checks.json/screenshots full-period-{width}.png. Browserclosed,userbrowseruntouched. No commits/push/DDL/permissions/externaldeployment/newdemoobservations.


## P4 energy-efficiency migration (user current stage numbering, 2026-11-09)

User approved next-stage Running Efficiency after marking previous work P3 complete; latest P4 naming applies to /efficiency, historical capacity implementation264 retains its prior P4 heading. /efficiency main entry now reuses site-analysis workspace/overview/chart/CSS and officialDS15. Launcher runtime group activates efficiency with shared lightning heading icon, removed from pendingmigration. No added CSS/primitives/dependencies. Main physical-energy scope hides provider filter and normalizes old provider queries to all stations; history/mapselection/oldpower topic retain priorflow; formal mode remains sourcepending.

New pure domains/efficiency energyObservation/summarizeEnergy pairs integerWh/bytes at observation boundary, aggregates each station period before threshold classification; totalintensity=sumkWh/sumpairedGiB, never average ratios or include missingenergy traffic. Missing remains null, measuredzero distinct; positiveenergy with zero totaltraffic is separate reviewclue, no wasteclaim. Distinctstationcounts,observedrecordcoverage,evaluablecounts; warning/criticalexclusive, missingmayoverlapvalidsignals. Sharedsaved MonitoringConfiguration intensity thresholds apply all totals/regions/series/facets/order/rows/cards/detail/colors; loads failclosed, existingrefresh kindmonitoring reused. Editor now explains both pages; no new rule/config/API/permissions.

Globalhour/day/week/month window controls wholepage, chart/hourlydevidence; actualsourceonly2026-10-25, daily24points,weekmonthactualoneday with1/7,1/31 coverage. domains/analysis/period extracts pure buckets/caption; capacityTimeBuckets reexport preserves compatibility; capacitymodel return operator retains OperatorFilter type fixing existingtesttypefailure. Onlyvisiblepagerowsgetseries/samples. Overview highintensity/zero/missing plus configurablethresholdfooter, regions energy/intensity comparison and drilldown/back, singleperiodchart, exactfacets/search/pagination/listcards/continuoussidepanel. No power/tempduplication,financial/LLM/SLA scope.

21focusedrules/model/capacity/monitoring/navigationtests passed tmp/p4-efficiency-tests.log; fullproductiontypes tmp/p4-efficiency-build.log passed,63333restartedfinalbuild,sourceASCIIanddiffcheckclean,216docsnumbered. ComputerUse nativepipeunavailable after resetretry; independenthiddenEdge63334CDP tested actualperiod08hour->day->week->month->23hour energyWh2467297/59374424/59374424/59374424/2431071,warningcritical364/149,229/17,229/17,229/17,418/164,chartpoints1/24/1/1/1. Detailperiodandraw1/24recordsagree, rowtogglesclose/switchsameDialogID,charttooltip/dashedcursorwork.

Facetsall/warning/critical/zero/missing matchfooter,searchSX-DEMO-001=>1andreset1080,pageSize10page2index11,province->Xian240->Changan62andback,comparisonmetricandnooperatorfilterverified.390/475/577/984/1280nodocument/regionoverflow/truncatednames,slider32px,1280allthreeactionrows48px,cardsanddrawerfit.0Runtimeexceptions/consolewarningerrors. RegressionP1county62/536,P2province1080/100%/3.61,P3monitoring418/164,capacityday32.94%/259retained. Evidence artifacts/p4-efficiency-qa/checks.json,overview-{width}.png,cards-{390,1280}.png. Specs50andimplementation265updated. No configwrites,permissions,DDL,commit,pushorexternaldeployment.


## P4 monitored sites becomes trailing description (2026-11-09)

User clarified monitoredsites is descriptive context rather than a fifth core metric. Efficiency removes sites metric and supplies shared metricsNote: monitored1,080sites, trailing after four core metrics, muted small text, no icon/strong. No commonCSS/component/calculation changes. Production/types tmp/p4-efficiency-summary-note-build.log passed,63333restarted. Independentheadlessbrowser390/577/1280 verifies4metrics,normal400weight,noicon/nobold,nodocumentoverflow,0Runtimeexceptions. Artifacts p4-efficiency-qa/summary-note-577.png and summary-note-checks.json. Browserclosed. No addedmirrorunittests/configwrites/DDL/commit/push/externaldeployment.


## P4 energy category donut replaces zero rows (2026-11-09)

User approved donut/legend normal-warning-critical based on configured intensity thresholds; no invented high/mid/low bands. Shared site-analysis/AnalysisDonut uses existingECharts lazyPie/SVGRenderer, officialButton/Link legend, DSsemanticRGBcolors resolved from markers, resize/theme refresh/disposal, accessible text and standardheadingfont. Sharedoverview optionalcontent defaults originaldistribution; sharedCSS tokengeometry stacks below480 and pairs above. No DSpackage/newdependency/businessstylesheet. Center/everypercentage denominator=evaluable, normal=evaluable-warning-critical.

energyFilter normal added to model validation/facets/exact rowsets and slider with greencheckicon. Legend/ring links updatefilter/page1 preserving scopes; overview remains independent of tablequery. Footer knownsites/coverage + optionalunassessable, zero/missingboth0 singlecleartext elsecoloredcountfilterlinks, thresholdsandconfigentry retained. Partialmissingmayoverlapknownseverity,zero/whollymissingoutside3segments. No savedconfigwrites/rulechanges.

19focusedenergy/model/capacity/monitoringtests passed tmp/p4-efficiency-donut-tests.log; standalonetypesandfinalproductionbuild tmp/p4-efficiency-donut-types.log,p4-efficiency-donut-final-build.logpassed;63333restartedfinalbuild,no later sourcechanges. Browser390/475/577/984/1280 nooverflow,32pxlegend,SVGsemanticcolorsagree. Actuallegendnormal834/warning229/critical17andfooter/sliderexact,overview1080unchanged; hour08normal567/warning364/critical149->day/week/month834/229/17withnormalfilterupdating. County62->city240,actualsliceonclicknormalworks. P3/capacity3distributionentriesandsharingdefaultpreserved.0Runtime/consolewarnerrors. Artifacts p4-efficiency-qa/donut-checks.json,donut-{width}.png. Docs50/265updated. DedicatedbrowserclosedafterQA,userbrowseruntouched. No config/permission/DDL/commit/push/externaldeployment.

## P5 business usage migration (2026-11-09)

User approved P5 Business Usage after completing P4 efficiency; current stage numbering uses P3 prior capacity/monitoring work, P4 efficiency, P5 business usage. /operator-usage now uses shared SiteAnalysisWorkspace/AnalysisOverview/AnalysisHourlyChart/CSS and official DS15; launcher business group activates business usage and shared chart-bar icon, removed pendingmigration. Four independent totals bytes/voiceSeconds/connected/sms, monitoredsitecount trailingdescription. Operator configuration names/logos reused. No new dependencies/businessCSS/parallelprimitives/thresholds/configwrites/LLM.

New pure domains/business-usage rules wrap existing calendarSource continuous synthetic history2024-11-01 through2026-10-31. Localcalendar dynamic hour/day/weekMonday/month windows, actualdays including February, coverageboundary clamp and disabledsteps, timestamps+08. All globalcontrols apply totals/providers/regions/trend/ranking/rows/cards/details; detailssearch and usagesort independent. Default2026-10-25day, oldhour mapsselectedhour, selection retainslegacyflow, formalno-sourcepending preserved. Weeks/months use exact existingdailyintegerformula, avoid provincehourlyobjectcache. Bytes/up/down decimalstrings with BigInt sums/sort, safeinteger seconds/calls/SMS, displayGiB/hours only. Physicalsitesdistinct, providerrelationsoverlap, contributions use same scope and metric denominator, zero denominator null.

Operator distribution shares/counts/progress, regionusage plus totalphysicalsites/drill/back, compressed ten-thousand values with fulltooltip, one trend switching4metrics, metricselectors32px commonutility. SharedOverview optionalregionClassName defaultsunchanged; P5 two columns except intermediate cardwidths. Table sortedmetricdescending with correspondingcontribution, realtime/Entersearch/IME/reset, pagecapacity/listcards, continuoussidepanel providerbreakdown/updown/attempts/trend/rawintegers. Onlycurrentpage attaches evidence; devices omitted unused. Found crosspage stale detail retained without lazyseries; sharedworkspace now closes selected row if not in currentvisiblepage, same-rowtoggle/continuousrow-switch retained.

42focused rules/model/navigation/legacy tests passed tmp/p5-tests.log, all4periods match oldusage anchors, region/provider/station/series exactconservation, arbitrary2025dates checked against rawhourly, scope/search/order/contribution/lazybounds/dateclamp/exacthugebytes tested; capacity/monitoring/efficiency regressions included. Productiontypes/build tmp/p5-build.log passed,63333 restartedfinalbuild. No source changes after finalbuild.217docsnumbered; sourceASCII and gitdiffcheck pass.

Independent hidden headlessEdge63334 tested390/475/577/984/1042/1280 no documentoverflow orregionnametruncation,32pxfacet, cards/detailfit. Actualhour08/day/week/month points1/24/7/31, bytes24092924763315/599736141363170/4083174098665638/17693161582452974. PreviousSeptember/nextOctober steps, February2025month28days, unicom807stations1provider, provinceXian240Changan62/back,4sorts/realtime search/reset/page10page2/sidepanelcontinuousandtoggle/pagechangeclose, mousecursor/tooltip08 verified.28additional monthmetric/width cases390/640/768/960/984/1042/1280 verify all4metrics nooverflow/truncation, linkedtrendselection,32pxouter30pxinnerbuttons. Final localpagesRuntime/consolewarningerror0. First harness captured Bitwarden welcome-page startup errors before navigation; fixed creating explicit aboutblanktesttab, localpageszero. First2colmidwidthtruncation fixed responsivecolumns. Regressioncustomeruse1080/sharing3.61/monitoring418/capacity259/efficiency229 preserved. Evidence artifacts/p5-business-usage-qa/checks.json,metric-layout-checks.json,overview-{width}.png,cards-{390,1280}.png; docs50/implementation266 updated. No permissions/DDL/commit/push/externaldeployment.

## P5 metric switches move to heading and share slider style (2026-11-09)

User requested operator-distribution metric selector leave data area, use lower slider style and content-based width. AnalysisOverview now accepts optional action and passes officialPanelCard heading action; P5 removes mb-md bodyselector. Distribution/trend/detail selectors reuse common site-analysis-occupancy slider with occupancy-auto modifier; table facet gains optionalautoWidth and P5 removes fixed52ch/42ch. Commoncolors/radius/4pxinset/font/selectedsemibold/32pxouter consistent; content-dependent equalcolumns keep existing movingindicator accurate. Headers show actions inline when enoughwidth (577), otherwise own rightalignedrow within heading. Scoped containerquery applies only heading with autooccupancy, existing non-auto charts keep theirtitlecolumns. No new primitive/dependency/businessCSS/datachanges.

Finalproduction/types tmp/p5-switch-build.log passed,63333 restartedfinalbuild,sourceASCII/whitespace and217docs pass. Actual390/475/577/984/1042/1280 verification: controls inside heading, outside distributionbody, all3 groups samefont/radius/padding/slider/selectioncolor/weight,32pxouter, no labeltruncation/documentoverflow; headerauto~278px vs table358px(iconlabels), narrowheader276pxfit. Distribution/trend bothdirections and keyboardHome, tablevoiceorder passed. FullP5 browserregression tmp/p5-switch-regression.log passed: allperiods1/24/7/31/history/provider/drill/sort/search/paging/continuousdetails/chartcursor, previous5businesspagesnormal,0Runtime/consolewarnings/errors. Evidence artifacts/p5-business-usage-qa/switch-layout.json,switch-{width}.png,checks.json. Implementation266 appended. DedicatedQA browser closed afterfinalchecks,userbrowser untouched. No extra mirrorunit tests for visual-onlychange; no configwrites/DDL/permissions/commit/push/externaldeployment.

## P5 compact numbers and operator row consolidation (2026-11-09)

User requested shares/sitecounts merge upward, summaryunitscompact2decimals, missingselectoricons. Operator row now value+share abovebar, no lower metadata; sitetotal and full originalunit display in officialTooltip. Summary and operatorvalues use purecompactUsage: GiB/TiB/PiB binary, decimalten-thousand/hundred-million for hours/calls/SMS, exactly2decimals and roundingboundarypromotion; rawintegers/tableunits/evidence/contributions unchanged. usageIcons/shortnames shared by summary/all4selectors; icons16px and labels traffic/voice/connected/SMS shortChinese, fullaria retained,32pxauto slider preserved. No newCSS/dependency/primitives or sharedpagebehaviorchange.

5focusedformatter/modeltests tmp/p5-compact-tests.log pass (binaryunits,ten-thousand/hundred-million,zero,precision,roundingboundary,fullperiodconservation),productiontypes/build tmp/p5-compact-build.log pass,63333restartedfinalartifact,no subsequent sourcechanges. ASCII/whitespacepass. Headlessbrowser390/475/577/984/1042/1280 nooverflow/truncation,operators2children(head/bar) andsinglelinevalue/share,allselectors4x16pxicons,defaultsummary545.46TiB/31.22ten-thousandhours/1111.89ten-thousandcalls/180.62ten-thousandSMS. Week3.63PiB/month15.71PiB/month3.27hundred-millionconnected verified, hour/daycorrect. Providertooltip1080sites+246989.88GiB, metricsbothdirections/detailicons/sorts/regionpassed,0Runtime/consoleerrors. ProgramfocusTooltipinitialtest retainedRadixpointerdown suppression; actualmousehoverpassed. Evidence artifacts/p5-business-usage-qa/compact-checks.json,compact-{width}.png;implementation266appended. DedicatedQAbrowserclosedafterchecks,userbrowseruntouched. No config/permission/DDL/commit/push/externaldeployment.

## Shared overview card and five-row alignment (2026-11-09)

User identified P5 operator/region five-row misalignment and requested common-layer fix. AnalysisOverview now assigns common overview-grid/card and distribution-entry classes for every row, icon optional modifier. SharedCSS uses desktop subgrid for paired header/body tracks; first heading row min32px, same divider/bodyorigin. Chart container moved from card to header wrapper because layout containment prevents subgrid inheritance; query now28rem contentwidth preserves old32rem outerwidth responsiveness. Distribution/regions both grid auto rows min64px (48px icon slot+2x8px padding),8px gap/padding, centered text/progress. Removed region p-sm mismatch and detailed-row auto override. Metadata may grow, unequal counts remain natural, stacked cards no reserved paired heading gap. No P5-onlyCSS/newprimitive/dependency/datachanges.

Final production/types tmp/p5-aligned-panels-final-build.log passed,63333 restartedfinalbuild. Actual widths390/475/577/984/1042/1280/1440/1600 nooverflow; all desktoppaired dividers/bodyorigins delta0px,1280/1440/1600 five rows and text/progresspositions delta0px,rows64gap8.1042 region10rows first5aligned and header100.8px not body-difference inflated. Monitoring/capacity/sharing/efficiency475/1280 headers/entrybounds/metadata/donut pass. Sixwidth compactQA with modelvalues/4metric/period/tooltip/detail/sort/drill passed tmp/p5-alignment-regression.log,0Runtime/consoleerrors. Final evidence artifacts/p5-business-usage-qa/alignment-checks.json,alignment-measures.json,aligned-{577,1280}.png. Intermediate liveCSS prototype mutated SSRclasses before hydration once triggeringReact418; final servedsourceQA has no injection and0errors. No newunit tests for visualonlychange. Implementation266updated. No config/permission/DDL/commit/push/externaldeployment.

## P6 report library and explicit generation (2026-11-09)

User approved P6 and clarified center must browse all saved/historical reports without generating every visit; generation is a full workflow. /reports now common site-analysis library, /reports/new separate generation workspace with one continuous conditions->explicit preview->confirm save->read flow. No generation on mount/filter/read/download. Legacy /usage-reports simple preview redirects, old map/history and formal OIDC/task/archive paths retained. Launcher generation points new route; region persistence recognizes new route. Current implementation is explicit browser-local preview, not server archive delivery.

New BusinessReport freezes P5 businessUsageModel exact7 counters, names/source/template, complete station members, operators/regions/series and calendar coverage. Day/week/month real history dates; county has currentcounty region. Deterministic SHA256 full artifact, same family differentbranding versions retained, exact duplicate keeps savedAt. readBusinessReport validates safeintegers/decimalstrings, bytes up+down,7counter conservation across4dimensions,counts/metadata. Standalone escaped tokenstyled HTML/JSON contain allstations. Saved view reads JSON directly; legacy calendar/history fullHTML in sandbox iframe/CSP, originals downloaded unchanged. Existing IndexedDB DB/limits retained, no migration/erasure. Cross-tab/focus reload. Generation POST previewgate/json4096/no-store, no writes. Common officialDS controls32/rows48,gaps8/16,lists/cards/search/reset/pagesizes. Only commonCSS addition tokenbased legacyiframeheight.

20 focused P5/report/navigation/region tests tmp/p6-tests.log passed; final production/types tmp/p6-final-build.log passed,63333 restartedfinalbuild. After build only terminalEOF whitespace normalized in4files, no behavioral edits. SourceASCII/diffcheck and218docsnumbering passed. Spec50 and implementation267 updated.

Dedicated headlessEdge63334/profiletmp/p6-browser actualmainflow4explicitrequests: county mobile day totals matchP5, no saveuntilconfirm, reloadreadwithoutgenerate, duplicatesameSavedAt,Feb2025month28/week7,legacycalendar/history coexist. HTML/JSON actualfiles equalstoredstrings.390/475/577/984/1042/1280/1440 nooverflow; slider32,desktoprows48/padding8/gaps8/16. ExtraQA15validmodelreports: generationnetworkfailure/retry,IDBfailure retains preview/retry,periodchange clears/noauto,brandingfrozenversion2switcheswithoutgenerate,uniquereportIDrealtime search/reset,size10/page2index11/cards,oldentryredirect,32pxheading/reset. FinalRuntime/consolewarningerror0. Evidence artifacts/p6-reports-qa/checks.json,extra-checks.json and screenshots. Downloadharness initially disconnectedBrowser.setDownloadBehavior beforeclick; retainbrowserconnection/backslashpath fixedactualdownload. Searchbydate matchedmonthstarttoo; uniqueID resolved harness expectation. PageSize usesexistingbuttonsgroup,notSelect. These are QA harness corrections, no appworkarounds. DedicatedbrowserclosedafterQA,usersbrowser/storageuntouched. No permission/configwrites/DDL/commit/push/externaldeployment.

## P6 restore rich original report content (2026-11-09)

User recalled old report generator produced much richer content, clarified outputcontent notcontrols. Confirmed initialP6 narrowed to4metric businesssummary while legacyDaily/Calendar hadcomparison/operations/runtime/peaks/ranking/evidence and historyhadYoY/cohorts. Acknowledged regression; keptlibrary/generationflow and upgradedtemplate bsmoss-business-report-v2 withoptional typedanalysis oncompatibleBusinessReportv1schema. Oldsavedv1/calendar/historyremainreadableunchanged; newv2 savedasseparatecontentversion.

Added pureanalysis-rules reusing calendarSource/calendarRates/counterChange/aggregateBusinessUsage/physicalhelpers/classifications. Fixedsamecohort selectedcalendar exactcounts, weightedconnection/load, physicalenergy/temperature/batterysamples, grouphourbusy/extrema, single-sitepeaks/top5,3independentcohortdimensions. Previousnaturalday/week/month and previousyear samecalendar, total/dailychanges, explicitmissing/zero/partialbaseline. Signedexactbytemovementallpositive/negative totals+top5each. Unallocatedproviderenergyremainsnull, nofakefaultduration/diagnosis. analysis-contentshared8chapters+summary acrossofficialDSview andHTMLdownload. Existingdistribution/chart/fullstationtablekept. Newworkspace callsitcomprehensiveoperationsreport anddescribesrichcontent. Readvalidatorrejectsmissingv2analysis/inconsistentcounters/groups/timeline/metadata/boundedfields whilev1accepted.

22focusedtests tmp/p6-rich-tests.log passed, includingoldreportday/week/monthxall/mobilemetric/ranking/peaks/comparisoncongruence,arbitraryFebbaseline31days,missingyear/partialweek,signedmovementconservation,legacyv1/tampering. Temperatureinteger-tenthsaggregationvslegacyfloatingaccumulation tolerance1e-9. Build/types tmp/p6-rich-build.log passed,63333restarted,no subsequentfunctionalsourceedits. FullP6browserflow rerun tmp/p6-rich-qa.log passed7widths/downloadidentity/dedupe/dayweekmonth/legacy and0errors. DedicatedadditionalQA4widths390/577/984/1280 all8chapters+summary,24timerows,nodocoverflow,read0generationrequests,oldv1noaddedchapters,allproviderphysicalenergyshown,0Runtime/consoleerrors. Artifacts p6-rich-qa/checks.json andsummary/comparison/operations/ranking-{width}.png. Spec50/implementation267corrected. Browseronlylocalstorageboundaryunchanged, noCSS/primitives/dependencies/config/permission/DDL/commit/push/deployment. Dedicatedheadlessprofiletmp/p6-rich-browserclosedafterQA,usersbrowserstorageuntouched.


## P7 usage verification workspace (2026-11-09)

User approved P7. /usage-review and /review-history now share a common site-analysis workspace: cases/records switch, open/awaiting_review/closed summary and count slider from same cohort, separate category/kind/metric/reason, real-time/Enter/IME search, 10/20/50/100 paging. Main list opens complete evidence/action/history in continuous nonmodal right panel; blank/Escape/same-row close, other row switches. Legacy standalone detail/event anchors and investigation links retained; records-origin standalone view returns original record scope/page capacity. No forced distribution cards. Launcher verification group removes both preview entries from pending migration.

Analysis-rule editor adds versioned relativeBps and exact string minimumBytes/minimumVoiceSeconds/minimumSms, positive integers, bps1..10000. Baseline4weeks/min3samples and3hourzero method remain fixed. File workspace store follows existing parameter service permissions, isolation/lock/CAS/atomic write/revalidation; env BSMOSS_VERIFICATION_PARAMETERS_DIR, preview defaultprivate/verification-parameters, no formal anonymous fallback. Original scenario measurements remain fixed; r0 originalIDs/digests/records compatible. New evidence freezes parameter snapshot, same-caseID preserved, digest/revision change. Events replay saved policy; changed evidence blocks approve. Submit checks current config. Cases no longer found retain actual historical events/scope/period filters and readonly original evidence. Existing browser DB bsmoss-demo-review-v1 unchanged, manual actions only, demo visitor/browser-only. No map/P5/report source substitution.

45targeted tests tmp/p7-tests.log passed: rules/events/configuration/scope/pagination/retiredhistory/CAS/permission/revocation/navigation/investigation plus existing capacity/monitoring parameters. Finalproduction/types tmp/p7-delivery-build.log pass;63333 restartedfinalbuild and sixrouteHTTP200, userconfigr0 untouched. Finalartifact independent QA7widths390/475/577/984/1042/1280/1440 no doc/dialog overflow; sliders32px/inset4/gap4, desktoprows48/padding8/gap16. Day/week/month60/120/180,10perpagepage2index11/search/reset,6actualactions confirm-return-confirm-approve-reopen-confirm plusanotherconfirm/history/eventdeep/read/configsave/retiredhistory/archive passed. Cross-tab stale draft retained+blocked, continuousdetail/realpointerblankclose/IDBfailure no success orhistoryloss passed. Independent return preservesrecordscope/pagesize. Runtime/consoleerrors0. API403/415/400/409/413; previewoff401/404. FirstQA search fixture used nonexistent site; actualsite corrected/fullrerun. FinalQA uses separate server63335/storagepath/browserprofile, userstorage untouched. Evidence artifacts/p7-review-qa/{checks,extra-checks,return-checks,formal-gate,delivery-health}.json pluslist/detail-{width}.png. 219docsnumbered, ASCII/diffcheck pass; implementation268/spec90/IA50 updated. DedicatedQA service/browser closed atdelivery. No DDL/permission/productionconfig/commit/push/externaldeployment.


## P8 site resources consolidation (2026-11-09)

User approved consolidated site resources plan. /sites now shared site-analysis layout and official DS15, same icon/name in launcher operations group, removed separate pending service-relations and duplicate base entry. Global region only, old tree/edge/legacy sites CSS no longer loaded. One scrolling toolbar with list/cards and sites/relations on left; search/filter/reset on right,32px/body14/48px row and8/16gaps. Search300ms/Enter/IME with draft carry across query transitions; 10/20/50/100 paging strictly parsed and retained through detail/back. Columns index/site/region/type-scene/operators/resources/actions. Old relation view supported same workspace, reset preserves region/hour/pagecapacity. Scope resource counts reuse graph/scope dedupe, province1080/3902/9302.

New preview-only no-store lazy dossier GET gates before reads, rejects duplicated/unknown/prototype params; no formal data fallback. Side panel aborts old reads, same-row toggle/continuous switch/blank/Escape close. Shared SiteDetailContent used fullpage/side: basics, one resource+occupancy table, snapshot runtime, calendar usage summary; equipment/charts/operator breakdown/comparison/source expand. Old6tab links autoopen/scroll corresponding section, services mapsresources. No forcedtab navigation; fullsource/version/validity/unknownstate, originalreports/analysis/review/mapnewtab/investigation retained. Dynamic identity names/logos includingtower. Siteenergy remainsunallocated and formalreadonlypending preserved. No new CSS/dependency/DDL/permissions/measurements/config writes.

23 targeted tests tmp/p8-final-tests.log and production/types tmp/p8-final-build.log pass. Two browser suites35 checks and7widths390/475/577/846/984/1280/1440 nooverflow, controls32/font14/action48, inlineproviderrows. Filter4widths operator/type/apply/reset, page10/page2index11, realtimesearch, card/detail/rowoutside/Escape/device,12hoursnapshot,old6tabs,7existingbusinesspages verified;0Runtime/consoleerrors. artifacts/p8-sites-qa/{checks,extra-checks}.json andscreenshots. Firstharness expectedinteger22sliderinnerheight; actual22.09375officialfontheight, tolerance22..24fixedharness. FinalbuildonlyEOFnormalizationafterbuild, nofunctionalchanges. Implementation269/spec50 updated. Local63333 finalbuild, no commit/push/externaldeployment; dedicatedbrowserseparateusersstorage. Subsequent consolidation dataupdates+aggregation/reportjobsintocenter/overviewpreferences remainsplanning only.

## P8 scope correction: site and device management (2026-11-09)

User rejected analytics added to P8 and explicitly authorized refocusing on sync/manage sites and devices. This supersedes the preceding P8 design. /sites and launcher now Site Devices with sites/devices object switch, list/cards, one shared action row (left views/object, right search/filter/reset), 10/20/50/100 paging. No stats strip, hour/period, relationship ledger, telemetry, runtime/usage/energy/capacity/curves or report/review links. Service relationships only small operator occupancy hint in site facts. Shared site-analysis/DS15 exclusively, no newCSS/primitives/dependencies.

New asset-model projects 1080 physical sites and 9302 unique devices with source facts and parent links, removes all measurement/observation/relationship arrays from client payload. Site filters type/scene/occupancy/maintenance/name order; device category/owner/maintenance/name order; context site devices with clear scope. Local aliases/notes searchable. Old tabs still open base dossier; existing analytical demo-store remains compatible for other consumers. Lazy GET asset contract with abort/stale suppression, no-store/strict query, storageerrors503. Stable queryKey prevents router.refresh after maintenance closing side panel. Device selection shows device facts and parent first; site selection has basic facts/device table/local supplements/sync source.

Source fields immutable. Local preview supplementary alias, site locationNote and maintenance note are genuinely saved with revision CAS/audit. Pure whitelist and audit replay; service validates asset identity and policy; workspace-hashed FileRegistryMaintenanceStore uses lock/fsync/atomic rename and final policy revalidation, corrupt storage refuses overwrite. POST local-preview-only, configured origin/JSON/body limits, no borrowed formal permissions. Conflict retains draft and requires latest read before retry; failed save/cancel do not claim success. BSMOSS_REGISTRY_MAINTENANCE_DIR optional preview persistence path. Formal source/permissions and master-data sync remain unconnected. Existing data-updates is measurement increment pipeline, must not claim asset sync. Source timestamp uses actual demo snapshot2026-10-25 18:00:00, not measurement watermarks. Sync status shows source/version/time, unconnected connector/mapping and null last sync; no fake sync button/success.

28 focused tests tmp/p8-management-tests.log passed inventory uniqueness/pages/parents/filter intersections/aliases/source immutability/legacy-no-analytics/CAS/noop/audit tamper/storage isolation/concurrency/revocation/corruption/HTTP gates; full productiontypes/build tmp/p8-management-build.log passed. Dedicated QA63335 and tmp/p8-management-qa-store, headlessEdge63334/profiletmp/p8-management-browser:27 browser cases passed5 widths390/475/577/984/1440 no overflow,48row/32outer/14font; actual site+device save/reload/search/history, concurrent409 retaineddraft/latest/retry,503 retaineddraft/no success,cancel, menu-maintain, site-device scope/exit, paging/switch/blank/Escape/cards/filter/reset/old links/sync honesty.7 business-page regressions passed,Runtime/console errors0. Initial harness expected slider innerbutton32 but shared32outer has22pxinner due standard inset, corrected assertion; menu uses actual pointerdown, programmaticclick did not open Radix, corrected harness. Evidence artifacts/p8-management-qa/{checks,extra-checks}.json and screenshots. User storage untouched. IA50 and implementation269 rewritten for final scope; docs numbering220. No DDL/formal permission/config/dependency/commit/push/externaldeployment.
Final management build now served on63333, verified exact prior PID15868 before stop; replacement PID15804. Both ledgers and standalone dossier HTTP200; live lazy API site-assets/9devices/unconnected sync/no current telemetry, no QAaliases on livepages. Dedicated QAserver8296 and Edge15140 closed after processidentity checks. Source ASCII and whitespace checks pass.

## P8 remove standalone device ledger and refine site interactions (2026-11-09)

User explicitly rejected standalone device list: devices belong inside sites, delete unused pages too. Supersedes sites/devices switch described above. /sites now only site ledger and shared list/cards; entry/title Site Management. Removed SegmentedControl/object switch, full-device table/cards/filter branches, device-row projection, standalone device detail branch and unused sites/sites.css. No separate device route file existed; retained /sites/[id] because user explicitly requested name clicks open single-site detail. Oldview=devices strictparse then307 canonical site list preserving valid region/search/investigation, clears devicecategory/owner/site/page/maintenance. Source counts and9302 unique devices remain within site dossiers and identity checks, maintenance storage unchanged.

User further requested type/scene contents centered, rowclick sidepanel/nameclick standalone and occupancy column before devices. Implemented centercolumn+centeredtwo-line facts using existingutilities, configured OperatorIdentity logos/names in occupancycolumn; namebutton andcardname routerpush canonical detail, nonaction row still nonmodal side. Devicecount/menu opens same site sidepanel and scrolls resources section, nested device data+save remain. No newCSS/primitives/configwrites/DDL/dependencies. Removed initialDevice branch, existing site detail owns selected device.

28tests tmp/p8-sites-only-tests.log passed updated sitepages/inventorynesteduniqueness/retiredviewnormalization and existingmaintenance/HTTP/navigation/region; productiontypes/build tmp/p8-sites-only-build.log pass. Dedicated QA63335/private tmp/p8-sites-only-qa-store/headlessEdge63334 profiletmp/p8-sites-only-browser,16 cases passed390/475/846/1440 no doc/paneloverflow,48row,centerfacts,operatorsbeforedevice/logos,noobjectswitch,noequipmentledger,actualpointerrowopensside/nameopensdossier,devicecountscroll/nestedmaintenancesave,pagination/cardnames,307cleansdevicequery. Runtime/consoleerrors0. Evidence artifacts/p8-sites-only-qa/checks.json andlistwidthscreenshots. IA50 corrected current scope, implementation269 append supersedingsection. Userstorageuntouched; no commit/push/externaldeploy.
## P8 centralize sync status in Data Updates (2026-11-09)

User confirmed station header sync status belongs in data updates. Removed sites/registry SyncStatus button/Dialog/state/import; heading retains source time; single-site source info retained. /operations/data-updates now shared official AssetSyncStatus table for site/device master data above metric section, both gated and authenticated branches. Two master types truthfully pending/no execution/interface+mappingunconnected; only previewon passes assetSource snapshot/version/time; previewoff null no synthetic source. Existing task APIs/auth/progress/failure/retry untouched; authenticated list title explicitly metric processing tasks, gated branch metric platform/login state. No newCSS/primitives, backend connectors, fake sync runs, permission changes, mutations or data writes.

Build/types tmp/p8-sync-central-build.log pass.10dataavailability/dossier tests tmp/p8-sync-central-tests.log and10task/HTTP/query tests tmp/p8-sync-task-regression.log pass.18CDPbrowser cases390/475/846/1440 no pageoverflow/headeractions, source detail retained,2correctcentralrows/pending/norecords/time,metricgating;0writes/0unauthorizedtaskreads/0Runtimeconsoleerrors,5businesspageregressions. Separate previewoff63336 verifies no scenario version/time in newstatus. QA63335/Edge63334 profiletmp/p8-sync-central-browser; evidence artifacts/p8-sync-central-qa/checks.json andupdates-widthscreenshots. IA50/implementation269 updated. No userstorage/config/DDL/deps/commit/push/deployment.
Final sync centralization served on63333 PID8792 after prior18580 identityverified. Live sites anddataupdatesHTTP200, siteheaderbuttonabsent/centralstatuspresent. DedicatedQAservers3420/12976 andEdge14204 closed with identitychecks.

## P9 simple Data Updates consolidation (2026-11-09)

User approved next stage but explicitly requested simplicity before client-platform integration. Single /operations/data-updates entry keeps master-data site/device pending rows; one metric task card switches received/aggregation using actual independent APIs, no invented parentage/orphan loss/backend workflow/stats/config. Shared DS15/site-analysis actionrow/slider/table/continuous nonmodal side; received result failure chooses aggregation in place; real opaque cursors, aggregation statefilter, existing input retry and aggregate recovery semantics retained incl unknown-result identicalcommand replay. No fake tasks in product preview. Removed separate aggregation launcher and old workspace; legacy page307 preserves validated job. operations.css still used reportjobs, retained. No new businessCSS/deps/permissions/DDL/config/storagewrites/commit/push/deploy.

27focusedtests pass tmp/p9-tests.log, standalonetypes tmp/p9-types.log and finalproductionbuild tmp/p9-delivery-build.log pass. Dedicated QAserver63335/mock empty sessionstore63337 and CDP63334 uniqueprofiletmp/p9-qa-browser, presentation-only intercepted taskfixtures:11checkgroups at390/475/846/1440,32pxgroup/14pxfont/48pxrow/nooverflow, rowtoggle/continuousswitch/blank/Escape, received-to-job/legacydeep/invalid/paging/status-reset,503thenrecover samecommand twice,0Runtimeconsoleerrors. No actual taskwrites; actual gatedAPI503 when integration unconfigured, not synthetic success. Evidence artifacts/p9-data-updates-qa/checks.json. Harness initially expected401 despite unavailable backend503 and used programclick for outsideclose; changed to actual pointer and accepts genuine unavailable refusal. FinalsourceQApassed. Docs221numbered,ASCII/whitespacepass. Final live63333 PID15116 (verified prior8792 before replacement);7pagesHTTP200 and legacy307, centralpending/noexecution preserved. IA50/implementation270 updated.
Final livebrowser4widths nooverflow/pending2rows/noaggregationlink and0errors (live-layout.json); dedicated QAserver/mocksession/Edgeprofile closed after verified process identities, userbrowser untouched.

## P10 report capabilities consolidation (2026-11-09)

User approved next stage with capability consolidation. Launcher now only Reports Center; /reports defaults original local/formal library, center switch library/tasks, generation action retains original complete /reports/new flow. /reports?view=tasks uses officialDS15/site-analysis controls/actionrow/table and continuous nonmodal sidebar. Generation/export APIs, opaque cursors, failure/recovery/unknown-result identicalcommand semantics remain. /reports/tasks307 preserves valid kind/status/job; invalid/duplicate/mixed report identity refuses selection. Removed old jobs layout and no-consumer operations.css. No new workflow/scheduling/stats/config/model/dependency/permission/DDL. Platform result links bind exact report+revision and bypass local preview even when enabled; no denied-access fallback. Scope city/county/operator persists through center/action/history and generation link. Local generated files do not invent platform task records.

37 focused tests tmp/p10-tests.log pass; finalproduction/types tmp/p10-delivery-build.log pass. Prior finalbuild caught transient source edit during compilation (taskHref signature), clean sequential delivery rebuild passed with final files. Dedicated63335/mocksession63337/Edge63334 profiletmp/p10-qa-browser:11taskcheckgroups4widths390/475/846/1440,32group/14font/48row/nooverflow,continuousrow/blank/Escape/status/reset/cursors/legacy/invalid,503samecommand and403freshread,exactrevision2 vs current3,0Runtimeconsoleerrors. All3 recoveryPOSTs intercepted only. Finalscope/history/generationlink/5immutablefiles/8chapters check0generationrequests; harness waits hydrated selector after router transition. Full original P6 flow regression7widths,4explicitgenerations,5savedreports,exactHTMLJSONdownloads,dedupe/dayweekmonth/legacy/8chapters passed0errors. Evidence artifacts/p10-report-centre-qa/{task-checks,final-scope-checks,live-health,live-layout}.json and artifacts/p10-library-regression-qa/checks.json. Live63333 PID26552 on finalbuild; oldPID15116 alreadygone, no unrelatedstop.7pages200,legacy307;actualpendingplatform4widths/no taskAPIreads/0errors.222numbereddocs/ASCII/whitespacepass. IA50/implementation271 updated. DedicatedQA service/browser closed after identitychecks; userstorageuntouched. No commit/push/externaldeployment.

### P10 local launch correction

User reported only headings. PID26552 omitted BSMOSS_PRODUCT_PREVIEW=on, incorrectly showing formal unconnected gates across business pages. This supersedes previous live readiness claim: HTTP200 was insufficient. Verified/stopped exact process and restored finalbuild63333 with process-only explicit previewon, PID22624; default/formal configuration unchanged. Future local service restarts MUST preserve previewon and validate actual business rows/charts. Dedicated headlessEdge profiletmp/p10-restored-preview-browser inspected9pages customer/monitoring/capacity/efficiency/operatorusage/review/sites/reports/new; all actual content markers/rows/form rendered,0Runtimeconsoleerrors/nooverflow. artifacts/p10-report-centre-qa/restored-preview-browser.json and restored-capacity.png. Separate browser closed after identitycheck; userstorage untouched. No product source edit or rebuild required.

## P11 personal overview display consolidation (2026-11-10)

User requested next P11 design/migration/build. Chose remaining personal overview preferences, consolidated into home title action Display Settings/common nonmodal sidebar; removed separate business nav entry and old preferences editor. Account menu retains same scoped panel link, metricdetails closes prior modal and opens same editor. Old /preferences/overview and /settings/overview307 to scopedhome#overview-display, whitelist city/county/reportPeriod and preserve duplicated invalid region for normal validation. Header region canonicalization preserves hash. Existing appearance preferences/rules/reporttemplates unaffected; legacy analysis remains pending for its own source/LLM plan.

DS15/site-analysis only, no newCSS/primitives/dependency/backend/permission/DDL. One list per3category, selectedfirst/currentorder,checkbox+label,32pxunitSelect/movearrows/reset/save,14font/48actionrow/8and16gaps.2..4selection/24existingmetrics/legalunits unchanged. Original localStorage bsmoss.overview.display.v1 schema/key retained. Explicitsave updateshomepage; resetdraft requires save; closing discardsdraft; readygate beforeedit; badstoredvalue usesdefault withoutautowrite; failedwrite keepsdraft; realstorageevent cleanupdates and dirtydraft retained. Only previewon gets originalsyntheticmetrics/editor.

16tests tmp/p11-final-tests.log and completeproduction/types tmp/p11-final-build.log pass;223docs/ASCII/whitespacepass. Dedicated63335/Edge63334 profiletmp/p11-qa-browser finalartifact18groups7widths390/475/577/846/984/1280/1440,0POSTs/0Runtimeconsoleerrors:limits/allcategories/order/units/save/homeupdate/cancel/reset/failure/retry/reload/invalid/backforward/outside/metricdetail.5extragroups labelclick,bareredirecthash+canonicalscope,accountmenu,realcrosstabsync,dirtydraftpreservation pass. Previewoff63336 noindicator/editor. InitialQA transient oldmodalclosinganimation retained2roles; waituntilclosed correctedharness. Evidence artifacts/p11-overview-display-qa/{checks,extra-checks,formal-gate,live-health,live-browser}.json. Final63333 PID3652, verified prior22624 beforestop, process-only BSMOSS_PRODUCT_PREVIEW=on preserved;10routes200 withactualcontent,live475/1440 actualpanel32control/48row/nooverflow/0errors. Implementation272/IA50 updated;dedicatedQAservers/browserclosed afteridentitychecks,userstorageuntouched. No commit/push/externaldeploy.

### P11 scope correction: overview settings belong in configuration (2026-11-10)

User explicitly moved overview settings into configuration. Supersedes home sidebar plan. /settings/overview now canonical management page, navdomain overview-display management, sidebar/launcher+managementlanding entry under Configuration. Editor moved settings/overview/editor,1/2/3column sharedDS layout; originalstate/rules/storagekey unchanged. Removed homeheadingbutton/accountshortcut/metricdetailaction and obsolete sidebarcontrol. /preferences/overview307 fixed /settings/overview, old home#overview-display clientredirect samecanonical even barehash with regioncanonicalization; no region/job/report params needed for personal display config. Only existing globalsettings entry accesses management. Appearance settings untouched. Formaloffpage pending/noeditor.

16tests tmp/p11-config-tests.log and completebuild/types tmp/p11-config-build.log passed. Dedicated63335/Edge63334 uniqueprofiletmp/p11-config-browser:11groups oldprefpreserved/savehome/leavewithoutsave/storagefailure+retry/3legacyroutes/4widths3904758461440/32px14font48row/nooverflow,0POST0errors. Formaloff63336 correctpending. Evidence artifacts/p11-config-qa/{checks,formal-gate,live-health,live-browser}.json/screenshots. Live63333 PID10848 afterverified3652stop, previewonpreserved;5actualcontentroutes/livehashredirect/nohomeeditor0errors. IA50/implementation272 rewrittenforcurrentauthority,223docsASCIIwhitespacepass. DedicatedQAprocessesclosedafteridentitychecks,userstorageuntouched. No sourcepolicy/backend/DDL/deps/commit/push/deployment.

## P13 business dictionaries consolidation (2026-11-10)

User requested next P13. Consolidated public site classifications and metric catalog into /settings/dictionaries with view=classifications|metrics, one management sidebar/launcher/landing entry. Default/invalid/duplicate view selects classifications. Left icon segmented group, right search/category/reset; live+Enter+IME search, conjunctive terms/category, 10/20/50 pagination and continuous nonmodal row/name sidebar toggle/switch/blank/Escape. Shared DS15/site-analysis only:32px controls,14font,48row,8/16 gaps, local toolbar/table scroll. Classification long version stays in detail to prevent squeezing narrow list. Original11classifications and12FIRST_METRICS preserved incl versions/facts/applicability/boundaries/units/grains/objects/aggregations/dependencies/physicalmeter semantics. Search includes metric displayunits/dependencycodes, SMS/call counts distinct. Publicreadonly works previewoff; planned remains unconnected. Rule editors independent and unchanged. Old /settings/classifications and /settings/metrics307 matching section; deleted old metricworkspace and classification branch of ParameterCatalog. No newCRUD/storage/permissions/DDL/deps.

19 focusedtests tmp/p13-tests.log, finalproduction/types tmp/p13-delivery-build.log pass. Dedicated QA63335/off63336 and headlessEdge63334 privateprofiletmp/p13-qa-browser:20checkgroups4widths3904758461440,6extraIME/Enter/history/3ruleeditors/formalreadonly;0writes0Runtimeconsoleerrors. Evidence artifacts/p13-dictionaries-qa/{checks,extra-checks}.json/screenshots. Initial harness selectors corrected for actual paginationradio/sectionbuttons/renamedsharedpage classes; no productpatch for testselectors. Final63333 PID18932 afterverified10848stop, explicitpreviewonpreserved;9actualcontentbusiness/configroutes and4751440 livebrowser pass0errors, live-health.json. IA50/metriccatalog70/implementation273 updated;224numbereddocs,14relevantsourceASCIIfiles,diffcheckpass. DedicatedQAprocessesclosedafteridentitycheck,userbrowserstorageuntouched. No commit/push/externaldeploy.

## P14 analysis rule configuration workspace (2026-11-10)

User requested next P14; inspected remaining configuration UI and migrated /settings/rules. Single sharedDS15/site-analysis workspace switches monitoring/capacity/verification/other. All3 editors staymountedhidden to preserve independentdirtydrafts; original #monitoring-parameters/#capacity-parameters/#verification-parameters select propersection, hashhistory/backforward works. No newparameter/API/permission/storage/model/dependency/CSS. ParameterEditor/ParameterRow share domainlevel layout; useParameterEditor shares fetch/dirty/default/cancel/save/error lifecycle, originaldomainvalidators/CAS/endpoints/notifications retain. Fields32px/font14, action48,8/16gaps, neutral titles, warningorange/criticalred, pairedthresholds onmobile/batteryswitchinline. Restored default onlydraft, explicit save, failretain, duplicateinflightguard,409/401/403 lockuntilreread; cancelafterrevocation keepsreload error. Exactverificationdecimalstrings preserved. Runtimeparams stillapplyefficiency; bothhitderived no independentthreshold. Fixedbaseline/historyboundaries retained. Otherbusinessrule nowsharedtable/continuousnonmodaldetail fullfacts/boundaries; deleted parameters/catalog. DocsIA50/implementation274.

## P15-P18 configuration consolidation and phase closure (2026-11-10)

User authorized continuous P15-P18 completion. Canonical /settings/data-access?view=sources|mappings|versions unifies source, mapping and version audit; /settings/access?view=jurisdiction|members unifies scope and member permissions. Original five paths307 to corresponding view; unknown/duplicate view defaults safely. Management sidebar/launcher/landing share unique entries; retired separate members/mapping/audit entries and progress card removed. Legacy analysis remains accessible, deferred LLM/missing-source modules remain deferred rather than new phases. Shared ConfigurationFrame/Search/Detail/CursorPager/Reload compose official DS15/site-analysis only,32px controls/14font/48action/8and16gaps. Realtime/Enter/IME, local pagination10/20/50/100, server opaque cursors retained. Continuous nonmodal row/toggle/outside/Escape details, failed-read retry, trimmed search, invalidated data on401/403. Preview uses original browser store validators/CAS, failure retains draft, reset clears and rereads; formal audit never invented locally. Preserved source/mapping preflight/position/impact evidence, API/session/permissions and full facts. Access readonly; organization master and permission mutations remain unconnected.

P17 template editor/workspace now officialDS controls and common layout; templates.css deleted. Original draft/JSON/validate/immutable publication/default-selection command lifecycle and exact unknown-result retries preserved, no real publish during QA. Form labels explicitly foreground, original report generator/content/history unchanged. Operator/source/mapping forms standardized without newprimitive/CSS/dependency/backend/schema/permission. P18 rootProviders removed mountedkey remount: it recreated streamed page tree and caused intermittent monitoring hydration418 with host elements shifted. DS15 already restores preferences. Stable provider fixes it; dark/compact/large reload and selected preference values verified, then defaults restored. Header region canonical navigation unchanged.

859unit tests pass tmp/p18-tests.log; final62HTTPsmoke pass tmp/p18-closure-smoke.log; obsolete P3-P14 UI assertions corrected while API/security/history/digest checks retained. Finalproductionbuild tmp/p18-stable-provider-build.log and types tmp/p18-closure-types.log pass. PrivateEdge63334/privateprofiletmp/p18-qa-browser and separate QAservices: preview13groups,formal24groups9interceptedtemplatePOSTs,preferences2groups,whole-site89groups(21pagesx4widths3904758461440+5gates),0runtime/consoleerrors. Formal401/403 invalidates data; exact opaque cursor survives; storagefailure/concurrentCAS retains draft;503publish/select identicalcommandretry;409reread;JSONpreserved;controls32/font14/row48/nooverflow. No actual formal mutations. Early harness fixes: pagination nav selector, empty DataTable row not stale member, reviewinput target, cancelled Fetch interception ignored; OIDCon QA requires formalparameters and is not general preview data host, use separate previewon/OIDCoff63339. Whole-site regression revealed real hydration issue, resolved before delivery; debug-only React traces were not product changes.

Final63333 PID4932 after verified3232 stop, explicitpreviewon preserved.25online groups actual14pages/5aliases/3protectedAPIs/3parameterGETs and14livebrowser checks4751440 pass0errors. Artifacts artifacts/p18-closure-qa/{preview-checks,protected-checks,regression-checks,preference-checks,live-health,live-browser}.json/screenshots. IA50 and implementations275-278 updated;229docsnumbered,59configuration/navigation/sourceASCIIfiles and whitespacecheck pass. Userbrowserstorage/configuntouched, independentQA processes cleaned after identity verification. P18 ends this migration stage; customerplatform/masterdata/identityintegration/LLM are separate future scoped work. No commit/push/externaldeploy/DDL or productionconfig writes.

24focusedtests tmp/p14-tests.log and production/types tmp/p14-delivery-build.log pass. Dedicated63335/off63336/headlessEdge63334 privateprofiletmp/p14-qa-browser final25groups fourwidths3904758461440 and6extras: draftswitch/default/cancel/validation/503sameparamsretry/409reload/read-only/403cancelkeepsreload/invalidreceipt/exactlargeintegers/batteryswitch/singleinflight/hashhistory/otherdetail/formalunconnected. All8PATCHes intercepted only;0actualwrites0Runtimeconsoleerrors. Evidence artifacts/p14-rules-qa/{checks,extra-checks}.json/screenshots. Harnesscorrected same-document hash reload assumptions, excludedSwitchhiddencheckbox frominputgeometry, ignores alreadycancelledrequestInvalidInterceptionId duringnavigation. Finalneutrality andswitchinline fix rebuiltandrerun. 225numbereddocs/10sourceASCIIfiles/diffcheckpass. Final63333 PID20240 afterverified18932stop, explicitpreviewonpreserved;9actualcontentroutes4751440business-to-configdeeplinks/3actualparameterGETs,0writes0errors inlive-health.json. QAservices/browserclosedafteridentitycheck,userbrowserstorage/config untouched. No commit/push/externaldeploy.

## Business analysis migration omission corrected (2026-11-10)

User identified Launcher Business Analysis was not migrated after P18 claimed zero remaining. Verified /analysis still loaded old analysis/reports CSS and remained portalPendingMigration under renamed Historical Features; P18's 21-page QA excluded it. Acknowledged omission, corrected IA50 and implementation278 closure claims, completed one cohesive supplemental batch documented279 rather than splitting more business phases.

Launcher now assigns /analysis to business group, shares businessAnalysisIcon with heading, and hides empty pending section. History workspace uses site-analysis summary/toolbar/fitted sliders/pagination, controls32/body14/action48/gaps8-16; summary replaces three bulky cards, coverage trailing, YoY in summary tooltip/current trend. Region table10/20/50/100 capacity; cohort server20-page URL contract retained. Filter icon prevents reset wrapping alone on475. Shared site-analysis-trend gives ECharts explicit240px from existing tokens. Removed legacy analysis.css/history.css; related report/context/station/history-evidence consumers use common classes. Full original history/rich reports/exact counters/digests/evidence/investigation contexts remain, no source/model changes.

Formal /analysis also migrated to official panels/table/progress/status/dialog/inputs/checkboxes and common page/actions. Preserved request aborts, exact preference CAS command, failure retry, conflict/access clearing, raw evidence and discontinuous exact-coordinate chart. Official Dialog replaces manual focus/backdrop. No formal API/storage/permission changes.

39 targeted tests tmp/p19-tests.log,62 HTTP smoke tmp/p19-smoke.log, final production+types tmp/p19-delivery-build.log passed. Final actual browser58groups: preview27/extra22/formal9,390/475/577/846/1440; no overflow/runtime/consoleerrors. Covers real calendar/query/drill/cohort/reset/pages/evidence/report digest+JSON/context/back/formal gates and6 existing pages. Formal4 POSTs all intercepted, same-command503 retry/conflict reread/defaultreset/timezone verified; userstorage untouched. InitialQA caught zero chart height and old24px controls; final common240height+32controls rechecked, hidden Radix checkbox16/close24 excluded from action-control assertions.230numbereddocs,16ASCII/diffcheck pass. Evidence artifacts/p19-analysis-qa. Live63333 restarted after verifying previousPID4932; finalPID22988 explicitpreviewon/OIDCoff. Live11checks (2widths+9HTTP) pass0errors. QAservers/Edge privateprofile closed after identity verification. No functional source edits after finalbuild. No DDL/productionconfig/dependency/commit/push/externaldeployment.

## Customer use consolidation (2026-11-10)

User approved merging customer-use/sharing/operator-usage into one continuous /customer-use workspace and one Launcher entry; no three-page tab shell. Shared DS15/site-analysis only. Two compact resource/business summaries; sharing structure common segmented strip; aligned operator/region cards with configured logos/site/device counts, region sites/sharing/usage mode; one URL usageSort controls operator values/region usage/trend/detail column; one site table/cards and continuous nonmodal sidebar combines full tenancy/devices/four metrics/evidence. Common optional secondary summary/resource-before-columns/tenant-count slots retain existing other-page presentation. Rich comparison rows opt into shared 80px token-based row minimum, 5-by-5 desktop aligned. Controls32/body14/action48 existing gaps remain.

New customer model preserves exact business counters/history bounds and resource graph, separates global region/operator scope from table-only search/tenancy/exact-count. Operator selection scopes devices/business while sharing counts full tenancy. Explicit resourceAt fixed2026-10-25T18 and real business period avoids invented historical occupancy; source update cutoff2026-11-01. Evidence/operator detail series only on visible page. Empty provider scope renders true zeros. /sharing and ordinary /operator-usage307 preserve all raw/duplicate params and investigation; spatial selection/history special branch retained. No standalone Launcher entries. Reports use canonical analysis link; local file allowlist accepts it and old files. Removed unconsumed sharing/operator UI compositions and old customer CSS, retained report models/rules. Shared href retains investigation through filtering.

18focused then860full tests pass tmp/customer-merge-all-tests-final.log;7originalreport tests pass after allowlist correction;63HTTPsmoke tmp/customer-merge-smoke-final.log pass. Finalsource nextproduction+types tmp/customer-merge-final-build.log pass. Dedicated Edge63334 privateprofiletmp/customer-merge-browser and preview63339/formal63338:26browsergroups6widths3904755778469841440,32pxoutergroups/14font/80pairrows/nooverflow,oneLauncher/oneMetric/alllinkedvalues,structure/search stable headlines,resetlocal,periods/operator/drill/back/rowcontinuous/Escape/cards/pagingvisibleevidence/chartcursor+tooltip/zeros/journey/aliases/duplicate/formal/sixpageregressions. Runtimeconsoleerrors0. Harness excludes30pxinside32px segmented radios and href-less planned anchors; no productpatch needed for those assertions. Artifacts artifacts/customer-consolidation-qa/{checks,live-checks}.json/screenshots.231docs/17ASCII/whitespacepass.

Final63333 PID18004 explicitpreviewon/OIDCoff afterverified21396 stop;11livegroups2layouts+7content+2aliases pass0errors. One combined PowerShell restart command auto-reviewblocked; separate identityread/exactstop and hidden Node starter safely succeeded, no approvals/configwrites. DedicatedQAservers/host/browser closed after processidentitychecks;only63333 remains. Userbrowserstorage untouched; no DDL/dependencies/productionconfig/commit/push/externaldeployment. IA50/implementation280 reflect final scope. Existing unrelated dirty tree preserved.

## Customer use secondary sections and decision-board boundary (2026-11-10)

User rejected cramped merged layout and clarified multiple second-level sections on same page. Then explicitly chose: first split sections, next consolidate Comprehensive Decision board so topic pages serve as its details; avoid duplicate expansive panels. This supersedes mixed overview presentation in prior consolidation; board implementation remains next separate step, not performed here.

/customer-use retains oneLauncher and continuouspage, now three officialDS SectionHeaders with stable deep-link anchors #occupancy/#sharing/#usage; common table #site-details. Top only anchorlinks +globaloperator/reset, no summarynumbers/date. Occupancy section resource snapshot/sites/devices/operator+region pair. Sharing section snapshot/sharedsites/rate/neutralbluegrayring 1,2,3+/regionalsharingnumerators. Categoryclick filters table and anchorsactualsite-details, descriptionnamescategory. Usage section period/one metric/fourbusiness totals/operator+region pair/trend. Removed mixedregiondropdown. Globalregiondrill stays in originatingsection viahash, affectsfullscope; date/metric only business/tablevalues; tablefiltersremainlocal;commonresetpreservesperiod,usageresetpreservesglobal+localtablefilters. All data models/exactcounter/report/legacy/journeygates unchanged.

Extracted existing AnalysisPeriodControls from commonworkspace with unchangeddefaultnavigation; customerusage opts keepScroll. AnalysisPresentation opt toolbarContent/tableId. Existing AnalysisDonut extended with neutral primary/secondary/muted tones, namedlegend,optionalhashscroll; efficiency defaults unchanged. Shared token scrollmargin only, no newprimitive/CSSsystem/backend/storage/deps/permissions. customer-use/sections owns business composition; overview only orders3sections. Existing combinedsidebar/listcards/paging retained.

Finalbuild/types tmp/customer-sections-build.log,860unit tmp/customer-sections-tests.log,63HTTP tmp/customer-sections-smoke.log pass. PrivateEdge63334 profiletmp/customer-sections-browser/QApreview63339,formal63338:24groups6widths3904755778469841440,3visibleorderedsections/no topnumbers/date/32control14font/spacing/pairalignment/nativeanchors/sharedmetric/realperiod/steps/localreset/sharingchart-to-list/categorydesc/regiondrill+back/zeros/sideEscape/cards/page2evidence/legacyjourney/deeplink/operator/reset/formalgate/6pageregression.0Runtimeconsoleerrors. Evidence artifacts/customer-sections-qa/checks.json +18screenshots inspected desktopoccupancy/sharing+mobileusage.231docs/8ASCII/diffcheckpass.

Final63333 PID3144 afterverified18004stop, explicitpreviewon/OIDCoff;11livegroups4751440+7content+2aliases pass0errors, artifacts/customer-sections-qa/live-checks.json. DedicatedQAservers/host/Edge closed afteridentitychecks,only63333 remains. IA50 andimplementation280 append supersedingsection. Userbrowserstorage untouched, unrelateddirtytree preserved, no commit/push/DDL/productionconfig/externaldeployment. Next work: board summary→topic detail anchors→site evidence, reuse existing facts and maintain map/provenance; no new generic standalone analysis modules.


## Launcher three tiers and integrated verification records (2026-11-10)

User requested top Comprehensive/Decision/Map, middle Runtime/Operations/Business, bottom Report Centre/Data Updates/Usage Review with records inside review. Implemented pure portalLauncherEntries order/short Launcher labels, exactly3 domain groups; reporting/verification columns removed, no separate record entry. Actual business titles unchanged. DS15 EntryCard/ShellPanel/Popover/Separator reused. Desktop3 equal domain columns; narrow domain modules2columns with auxiliarydescriptions/disabledbadges hidden, disabledsemantic+visual retained; top/bottom3equal icons+labels. All3tiers fit390/475x889. Fixed unsupported fulfillment/revenue icons to seal-check/currency-cny. Initialfocusfirstactualentry, Escape/triggerrestoration/currentpage/scope/mapnewtab preserved, management8entries unchanged.

Canonical /usage-review defaults cases; view=records uses existing ReviewWorkspace. Preserves period/scope/session/reason/evidence and historybackforward, original IndexedDB/events unchanged. /review-history preview307 preservesallraw/duplicateparams/investigation to canonical records; formaloffremains404. Removed obsolete wrapper; recordsbacklinks/investigationparser accept canonicalrecordview+legacyorigin. Strictview/session/reason/duplicatesvalidation retained, recordReasononlyrecords. Distinct /usage-review/history historicalevidence remains. No newbackend/config/permissions/deps/DDL or boardredesign.

864unit tmp/launcher-tests.log,63HTTP tmp/launcher-smoke.log, finalproduction tmp/launcher-delivery-build.log+types tmp/launcher-types.log pass.18browsergroups6widths3904755778469841440 checkorder/unique/focus/Escape/scopes/map/newrecords/reason/archivedsession/evidenceoriginreturn/formalgates/management,0errors; artifacts/launcher-qa/checks.json. QA harness initially malformed nestedselectorquotes corrected; no producterror. Privateheadlessprofiletmp/launcher-qa-browser only, no userstorage. Final63333 PID5232 explicitpreviewon/OIDCoff afterverified3144stop;9livegroups4751440+6content+alias pass0errors,live-checks.json. IndependentQAservices/browser cleaned after identitychecks,only63333 remains. IA50/verification90/implementation281 updated,232docs/11ASCII/diffcheck pass. Hugeexistingdirtytree preserved;no commit/push/deploy.


### Launcher naming correction (2026-11-10)

User clarified top-tier words were informal grouping descriptions, not authorization to rename. Removed Launcher-only short-label mapping; restore original navigation names Runtime Overview / Comprehensive Decision / Site Network Map. Three-tier layout and all routes remain. Do not infer renaming from shorthand descriptions. This supersedes the prior short-label decision.
Restored-name production build/navigation tests and live390/1440 browser labels passed,0errors; artifacts/launcher-qa/restored-names.json. Final63333 PID24128 previewon/OIDCoff. Dedicated browser cleaned.

## Guanlan logo explorations (2026-11-10)

User requested a new product logo; initial new concept "Three Domain Flow" was saved non-destructively at artifacts/guanlan-logo-v2 (despite folder v2 this is the FIRST presented concept), diamond silhouette cut by two waves into3ribbons, blue/cyan. User explicitly requested preserve it and make a second concept plus light/dark actual-page comparison. SECOND concept "Observation Window" at artifacts/guanlan-logo-concept-02 uses rounded G-shaped viewing frame with an inner wave, blue/cyan light and brighterblue/cyan dark, mono/reverse,transparentPNG16/24/32/64/256/1024 andSVG. All FIRST-concept file SHA256 hashes checked unchanged. Active public brand assets/chrome/favicon unchanged, name Guanlan retained.

Preview only: privateheadlessEdge63334 uniqueprofiletmp/logo-concept-02-browser captures same actual63333/customer-use scope/data/layout at1440x1000,DPR3, replaces image only in privateDOM usingdataSVG and togglesexistingDSlight/darkclasses+colorscheme (no newthemeCSS oruserstorewrites).4views concept1/2 x light/dark,24pxexistingheaderlogo,0overflow/0runtimeerrors,preview-checks.json. Seconddesignboard concept-02-preview.png; fullpagecomparison concept-02-light-dark-pages.png; bothconceptheadercomparison both-concepts-light-dark-headers.png; individual4pages included. Firstconcept dark keepsoriginalcolors (fileunchanged); second usesbrightdarkvariant. Sourceassets remainnativeSVG,noimageAPI/deps/productcode/buildchanges. Privatebrowserclosed afteridentitycheck,63333PID24128 remains.

### Second logo rejected and redesigned (2026-11-10)

User rejected G-frame Observation Window and requested open-minded redesign of concept2, keeping concept1. New nativevector alternatives focus(concept-eye),confluence(rotatingcurves),prism(foldedplanes) explored at artifacts/guanlan-concept-02-rework/exploration.png. Selected confluence "Lan Ju" as revisedconcept2,3filledsweepingribbons aroundnegativecentralaperture,solidcobalt/teal/navy,brightdarkvariant,mono+reverse; not G/roundedframe. Refined visibleoverlap masks preservehairline separation and singlecolorreproduction; rendered/visuallyinspected. Revisedboard concept-02-reworked-preview.png,SVGs guanlan-concept-02-{light,dark,mono,reverse}.svg,transparentPNG16/24/32/64/256/1024. ExistingfailedGdesign archived unchanged,firstdiamondwaveconcept files unchanged verifiedSHA256.

Reusedprivatepreview approach and existingactualcustomer-use page:4views concept1/revised2 x light/dark,1440x1000DPR3,24pxheader,no userstorewrites oractiveassetreplacement. Artifacts same reworkdirectory concept-02-light-dark-pages.png,both-concepts-light-dark-headers.png,individualscreenshots,preview-checks.json0errors/nooverflow. OnlyprivateDOMlogo/themeoverrides;originalpublicassets/sitecode/nameunchanged. PrivateEdge63334 profiletmp/logo-concept-02-rework-browser closed afteridentitycheck,63333PID24128 remains. No API/deps/build/deploy.

### Approved second logo refinement (2026-11-10)

User approved revised confluence concept and requested detailed refinement. New artifacts/guanlan-concept-02-refined preserves the accepted silhouette while balancing three exact 120-degree surfaces using cyclic masks, smoothing closure tangents and slightly rounding tips. Dedicated 16/24px optical gaps, light/dark/mono/reverse SVG and transparent PNG assets, auto-theme SVG and favicon included in guanlan-refined-assets.zip. Board refined-preview.png, before-after.png and actual-page refined-light-dark-pages.png delivered. First concept and approved draft unchanged via SHA256. Seven private-browser check groups at390/1440 light/dark plus auto-theme and preservation pass, zero runtime errors and no page overflow. No active website assets/source/theme storage changed. Private Edge63334 PID14428 identity verified and stopped; live63333 PID24128 remains. No dependencies/build/deploy/commit/push.

### Second refined logo adopted across product (2026-11-10)

User explicitly approved full adoption, superseding preview-only restriction. Installed approved light/dark standard and optical24 SVGs, mono/reverse, automatic optical16 favicon SVG,16/32/48ICO fallback and180Apple touch icon. Existing compatibility guanlan-mark.svg now serves approved auto-theme mark. Versioned URLs refresh browser caches. Shared portal/management header uses ProductBrandMark composed of official ShellHeaderMark with CSS DS theme visibility; OS appearance deliberately opposite in QA proves app-selected theme controls mark without hydration swap. Legacy metrics and map brand icons replaced with dark mark, retaining business tower symbols. Product name/navigation unchanged; original concept and approved draft SHA256 preserved. Added asset README and660implementation notes. No dependencies/DDL/config/commit/push/externaldeployment.

Final production build tmp/brand-v2-final-build.log and app types tmp/brand-v2-types.log pass;63existing HTTP tests tmp/brand-v2-http.log pass. Final actual63333 browser28groups (9pages1440xlight/dark,customer/settings390xlight/dark,map/legacy,automaticfaviconpalettes,preservedhashes,servedapprovedassets)0errors,onevisible24pxmark/nooverflow; artifacts/brand-adoption-qa/checks.json and8screenshots, desktoplight/mobilemanagementdark visually inspected. Initial QA caught missing final favicon metadata from an edit made during compilation; final full Next build and service restart completed before all28browser checks. Private Edge63334 PID17304 identity verified/closed. Live63333 PID10472 previewon/OIDCoff remains; unrelated dirty work and userbrowserstorage preserved.

### Map logo visibility correction (2026-11-10)

User noticed map logo missing. Prior adoption checked resource URL but missed display:none on the legacy rail-brand ancestor. Moved mark out of hidden rail into visible top-left mw-product home link before Guanlan name, reusing shared ProductBrandMark and official ShellHeaderMark; map dark ancestor selects approved dark optical24 variant. No new CSS or duplicate logo. Final production build/types pass tmp/map-brand-visible-build.log. Actual63333 browser16groups at390/475/577/846/1440 with rootlight/dark, loaded MapLibre canvas, paneltoggle continuity,home link: exactly one visible24px mark with center hit-test,no brand/region/action overlap and no overflow,0runtimeerrors. Evidence artifacts/map-brand-visible-qa/checks.json plus mobile/desktop screenshots. Initial QA overlap assertion was corrected to account for mobile region on second row; no source layout workaround needed. Visually checked mobile header. PrivateEdge63334 PID7920 verified/closed. Live63333 PID3264 previewon/OIDCoff. No deps/config/DDL/commit/push/deploy; unrelated edits preserved.

### Map floating panel width and spacing (2026-11-10)

User requested narrower panels with more space. Map regular station panel470->400px; dualclamp360/28vw/440->320/25vw/380 (1440viewport360each),interpanelgap12->DSspace-lg24. Expanded900->800. Right inset66->74 and top118->126 provide more separation from map controls/launcher; launcherinnergap8/padding4. Mobile max400 with113pxreserve/right58; small<=420 paneltop186 fixes prior top136 collision with launcher. Tags now wrap by whole item with8pxgap, no fragmented labels. Body/action/findings verticalspacing16. Area370->340,topic400->360,comparison/usage/report790->720;camera insets synchronized while preserving280pxcamera budget. No new primitives/globaltokens/business behavior changes.

FinalNextproductionbuild+types tmp/map-panel-spacing-final-build.log pass;10existingworkbench/cameralayouttests tmp/map-panel-spacing-layout-tests.log pass. Actual63333 browser36checks at390/475/577/846/1199/1200/1440/1920 forsingle/dual/expanded/restored,auxusage/report/comparison/topic widths:0errors/nodocument,panelorbodyhorizontaloverflow,24pxdualgapand10+launcherverticalgap. Evidence artifacts/map-panel-spacing-qa/checks.json,before1440,after390/1440screenshots;desktopfinalshot waitedfullmapready and visuallychecked. QA initial caught real<=420launcherpanelcollision; fixedsourcebeforefinalbuild. Live63333PID15320previewon/OIDCoff. PrivateEdge63334PID16036identityverified/closed. Userstorage/unrelateddirtyworkpreserved;nodeps/DDL/config/commit/push/deploy.

### Launcher narrowed and spaced (2026-11-10)

User explicitly clarified Launcher panel, after earlier ambiguous panel request was interpreted as map. Business Launcher width1280->768 usingexistingcontainer-page-md; desktopcolumngap16->24,rowgap10->16,outertiergap16->24. Mobile16padding/gaps withtwo-columnmodules; officialEntryCard icon/name/status/current kept, businesslongdescriptionremoved fromvisual butaria-descriptionretained. Existingthree-tiernames/routes/scope/mapnewtab/planneddisabled/focus/Escaperestoration unchanged. SharedShellPanel/EntryCard/Separator/DSspacingonly;no newprimitive/tokenoverride. Managementbase768preserved andgroupgapincreased.

FinalNextproductionbuild+types tmp/launcher-spacing-final-build.log pass;2existingnavigationtests tmp/launcher-spacing-navigation-tests.log pass. Actual63333 browser26checks:8widths3904755777677688469841440 xlight/dark,Escapeeach,management8links,realentrynavigation+close.0errors/nohorizontaloverflow/equal3columnsdesktop/correct16row24colgaps/all12uniqueentrynamesandscopes/newtabmap/current/disabledkept. Shortviewportsuseexistinginternalverticalscroll. Beforeandafterdesktop/mobilelightdark visuallyinspected;artifacts/launcher-spacing-qa/checks.json plus5screenshots. InitialQAmanagementwidthcaughtmidbuildCSSsnapshot;fullfinalbuildbefore26checks. One bundledbrowserstart/script command rejectedbyautomaticreview;separatedhiddenbrowserstartandfilewrite succeededwithoutpermission/configchanges. PrivateEdge63334PID23840verified/closed. Live63333PID17244previewon/OIDCoff. Userbrowserstorage/unrelateddirtytreepreserved;nodeps/DDL/config/commit/push/deploy.

### Launcher vertical rhythm and icon/title alignment (2026-11-10)

User found vertical spacing excessive after description removal and requested icon/title vertical alignment. Businessmodules EntryCard explicitly items-center overrides officialdefaultitems-start fordescription-bearingcards. Moduleverticalgap16->8,groupheadinggap16->8,outertiergap24->16;three-domaincolumn24 andotherhorizontalgaps preserved. Managementgroupverticalgapsalso8,betweenrows16. Width768 andoriginalnames/routes/three tiersunchanged. OnlylaunchercompositionDSutilityclasses changed;no globalCSS/token/componentimplementation changes.

FinalNextbuildincludingtypes tmp/launcher-align-build.log pass. Browser26checks onactual63333 at3904755777677688469841440,light/dark,keyboard/Escape,managementandactualnavigation:0errors/nooverflow,allmoduleicon/contentverticalcenterdelta0px,rowgap8/outergap16/columngap24. Desktopheight628->556,mobile840->768. Screenshots desktoplightandmobiledark visuallyinspected,artifacts/launcher-align-qa/checks.json+4screenshots. PrivateEdge63334PID100identityverified/closed;live63333PID18632previewon/OIDCoff. Userstorage/unrelateddirtytreepreserved;nodeps/DDL/config/commit/push/deploy.

### Lightweight Launcher and concise descriptions (2026-11-10)

Viewed user-provided authenticated CoSpace Launcher through CUA. Replaced heavy EntryCard entries with official Button ghost/secondary, Icon and Next Link; removed extra panel gradient and boxed icons, retained768width, three tiers, original names/routes/scope/mapnewtab/disabled/focus. Small group headings replace control-height rows. Management uses same lightweight composition. User then requested short descriptions below names:18 business entries now have concise4-5character descriptions, official text-body-small12px muted, truncate/nowrap, icons vertically centered across both lines. Original long accessibility descriptions retained.

Final Next production build including types passed tmp/launcher-light-description-build.log; existing2navigationtests passed before description-only addition. CUA verified desktop/mobile light/dark,12links/6disabled, actual capacity navigation, management9linksincludingreturn, Escape restores trigger,18nonempty12pxsinglelinedescriptions/nohorizontaloverflow;0consoleerrors. Theme and viewport restored. Evidence artifacts/launcher-light-qa/final.png, description-checks.json and screenshots. Final63333PID4488 previewon/OIDCoff. No dependencies/config/DDL/commit/push/deploy; unrelated dirty work preserved.

### Site-service analysis scope reset (2026-11-10)

User explicitly identified overdesign and clarified China Tower provides site infrastructure/services to operators; product analyzes delivery, performance and evidence for later fee confirmation, does NOT execute settlement. User requested reorganize analysis and preserve overdesigned work marked pending migration. New docs/20-specs/100-site-service-analysis.md is current positioning/migration authority; scope notices/index updated across existing specs without deleting historical rules. Target is one workspace with service resources, service performance, fee evidence as secondary sections; no new pages built. Supply metering is shared evidence, not another silo. Site/customer/service configuration/effective interval/evidence is backbone; occupancy count is context, not billable line count. Traffic/connect/load and kWh/GiB remain auxiliary; cannot imply tower capacity, breach, billed electricity or revenue. Contracts/orders, delivery/effective dates, customer meters/allocation and service event confirmation are missing inputs, not fabricated completion. No bill/rate calculation/payment/approval scope added.

Launcher marks existing customer-use,monitoring,efficiency,capacity,analysis,usage-review as pending migration in single-line small descriptions and accessible descriptions. All12links/originalnames/routes/scopes/6disabled planned entries preserved. Sites/data-updates/config/reports remain shared foundations; summaries,map,templates have future content migration plans recorded rather than disabled. Original sharing/usage/review deep-links and historical reports/events unchanged. Future unbuilt silo expansion paused. Next priority: validate actual service catalogue and sample evidence, migrate service resources first, then performance then fee-evidence checks.

Production build/types tmp/site-service-scope-build.log and2existingnavigationtests passed. CUA desktop/mobile390 shows6pending markers,12links,6disabled,nowrap descriptions/nooverflow,0consoleerrors; viewport reset. Evidence artifacts/site-service-scope-qa/checks.json and launcher.png. Service63333 restarted finalPID868previewon/OIDCoff. No DDL/deps/productionconfig/deploy/commit/push or historical data rewrites.

### Stage1 site-service catalogue and data baseline (2026-11-10)

User authorized stage1 of five fixed batches after clarifying primary deliverables are province/city analysis and reports, county reserved, individual site service evidence for detail. Completed repository audit and internal baseline docs/20-specs/110-site-service-data-baseline.md:5servicecategories, minimalidentity/project/config/effectiveinterval/metering/event/evidencefields,11sourceinventoryrows,province/citydedup+unknowngeography+period/asOf+versionrules,12designacceptancescenarios. No runtime code/newpages/endpoints/schema. Existing station_service is station/customer association, NOT future serviceItemId. Formal DDL station has province/city only, county only present in demo and is a real pending persistence gap. Operator branding supports custom identity display but not formal customer binding. maintenance-rules only edits alias/location/note, NOT workorders. energyWh is synthetic interval whole-site energy, NOT meter register/submeter evidence. Existing contracts.ts is source-measurement intake protocol, not commercial contract support. Reserved telecom tariff function explicitly excluded.

docs/70-workplan/60-site-service-batches.md is now current five-batch ordering; indexes and original50plan point to it while preserving old backend/history. Stage1 internal baseline complete, actual sample mapping/signoff/source intake still pending and NOT claimed done; stages2-5 not started. Stage2 provinceoverview/citycomparison -> citystructure/sites -> sitecustomerproject/config/evidence, reuseexistingUI, nofivecategorypages/independentdeviceanalysis. Scope100includesprovince/cityandcountyreservationlink. Checks:59localreferencelinksresolve,5catalogue/11inventory/12scenario countsverified,diffwhitespacepass. Scenarios documented only, not executed functional tests. No appbuild/browsercheck/restartneeded for docs-only changes. Existing six pending migration markers/functions/history unchanged; no data mutation/DDL/deps/deploy/commit/push.

### Stage2 service resources preview and evidence gaps (2026-11-10)

User asked to continue the five-stage migration. Implemented stage2 snapshot presentation in existing /customer-use, keeping its original name and six pending Launcher markers. Default region-only entry opens service resources; explicit section=legacy retains full occupancy/sharing/business usage. Old metric/period URLs auto-select legacy; original hash anchors redirect to legacy; sharing/operator-usage aliases explicitly preserve legacy and duplicate query values for canonical rejection. No old history/report/case rewrite.

Pure service-resource-rules aggregates observed sites/devices only, deduplicates physical identity, rejects cross-site conflicts and retains unknown-city bucket. Preview adapter uses one fixed18h source/version:1080sites,5400towerfacilities,3902customerdevices. Province/city reconcile. Brand filter selects sites but keeps full-site physical inventory; search, occupancy and pagination local, summary independent. City shows brand structure (not concrete entities). Visible page alone gets resourceGraph evidence. Five service categories, concrete customer bindings, actual delivered config, validity and effective changes remain not_connected/null; no fabricated confirmed-service counts, changes or mass missing cases. Formal service adapter/storage/effective-version logic still NOT implemented, pending actual source materials; stage2 is preview/evidence-gap UI completion only, not real-service acceptance.

DS15 and existing workspace/summary/overview/table/cards/dialog/search/reset/pagination reused. Shared AnalysisOverview supports optional progress for count-only rows; real city/brand shares retain bars. No new CSS/primitives/tokens/deps/DDL/API/permissions/productionconfig/commit/push/deployment. Plan60 and index updated; implementation ops_bsmoss_282_service-resources records scope and limitations; stages3-5 not started.

869appunit pass tmp/service-resources-all-tests.log (5new aggregation/query tests),64HTTP pass tmp/service-resources-delivery-http.log including formaloff/no demo and oldaliases, finalproductionbuild+types pass tmp/service-resources-release-build.log. Browser23checks at3904759841440 light/dark, province/city/back/brand/localfilter/search/reset/paging/page2evidence/cards/rowswitch/outsideclose/dossier/legacy/hash/sharedmonitoring3bars pass,0consoleerrors/nooverflow; artifacts/service-resources-qa/checks.json and screenshots. Final actual63333 PID6688 previewon/OIDCoff. Browser finalcustomer-use province/light/default843viewport restored. Earlier premature start during build exited before manifest completed; finalprocess launched only after buildsuccess, actualbrowser verified. Unrelated huge dirtytree preserved.

### Stage3 service performance and whole-site energy (2026-11-10)

User requested next stage and explicit numbering. Fixed five-stage authority is docs/70-workplan/60-site-service-batches.md, separate from historical P1-P18. Stage3 local implementation complete; NEXT IS STAGE4 FEE-EVIDENCE CHECKS, NOT STARTED; stage5 not started. Stage1/2 source limitations still apply. Plan60, workplan index, spec100 and implementation283 updated; do not restart stage3 or claim true source integration complete.

Same /customer-use workspace adds section=performance beside resources and legacy, no new Launcher entry. Province/city exact whole-site interval energy, power/energy record coverage, battery-record sites, city drill/back, hourly/daily trend, local facets/search/reset, table/cards/page size, raw hourly evidence with pagination20 and original dossier link. Hour/day/week/month affect full page. Physical scope normalizes old brand/count/sharing/status; no customer energy attribution. Legacy analysis and six pending migration markers retained. Reused official DS/shared components without new CSS/primitives/dependencies/DDL/API/permissions/production configuration.

Pure service-performance-rules uses integer strings/BigInt, identity dedup/conflict checks, rejects overlapping/untrimmed interval energy; null is not zero. Separate confirmed impact rule clips confirmed mapped events to validity/query/cutoff, dedups events and unions site/service intervals separately, tested only and not wired to a real feed/store. Preview uses existing versioned calendarSource/physicalDaily synthetic observations. Province month803520 hourly samples equals1829444652Wh, optimized full raw14.36s to about380ms with identical totals; visible page only gets raw records. Battery sampling is a clue, not confirmed outage/duration/breach. Service interruption confirmation, supply guarantees, maintenance workorders, physical meter binding and customer metering remain null/pending, no fabricated counts/cases/customer energy/fees/settlement.

877unit tests (8new) pass tmp/stage3-performance-all-tests.log;65HTTP pass tmp/stage3-performance-http.log; final production build/types pass tmp/stage3-performance-release-build.log. Browser29groups: province/city, all periods, source paging, local filters/search, row switching/outside close/dossier, cross-mode parameter cleanup and legacy preservation;390/475/984/1440 lists light/dark/cards/mobile detail no overflow,0console errors. Evidence artifacts/stage3-performance-qa/checks.json and screenshots. Final user tab performance/province/light/default viewport restored and marked deliverable. Live63333 PID5136 previewon/OIDCoff, started after final build complete. Huge unrelated dirty tree preserved; no commit/push/deploy.

### Tower-service page PRD reassessment (2026-11-10)

User supplied explicit new product name Tower Service Quantification and Decision Platform (short Ta Fu Yan Pan), snapshot-only boundary and six equal front boards plus two back boards. NEW target-design authority docs/20-specs/120-tower-service-page-prd.md supersedes conflicting goals in100;100 and specs index link it. Documentation only, NOT an implementation/product rename authorization. Stage3 local completion remains history; next numbered implementation stage4 NOT started, five-stage plan not silently renumbered.

Front: Business Overview (no tabs), Regional Network Panorama (regional choropleth/heat, no site points), Resource Baseline (sites/facilities, tenancy/sharing, region), Service Quantification (operator, mix, periods), Measurement Evidence (summary, detail, rules comparison), Analysis/Decision (findings, reports). Back: Data Sync (plans, snapshots, logs/checks), Rule Configuration (metering/agreements, judgment rules, org/permissions), max3tabs each. Snapshot-only/no realtime/fault/SLA/workorders/delivery tracking/settlement/invoice/receipts/amounts/approval. Prior outage and maintenance ambitions are OUT of new target; preserve old functions/history pending migration. Reports integrated with analysis, generate/view/export only. Regional map and names Service Quantification/Analysis retained as recommended defaults.

Global period+snapshot/operator/region, business cutoff distinct from sync time. Immutable version manifests; arbitrary A/B allowed but same-period revision vs month/year/custom comparison differentiated; incompatible/partial intervals no misleading growth. Mixed service units never combined. Monthly site/customer tenancy and anchor version snapshots mandatory for rule tiers, no current-tenant retroactive replacement. Broadcaster/other rules pending confirmation; no borrowed defaults. Whole-site energy not automatically customer energy. Versioned agreement/metering/sharing/judgment, no price engine; optional raw price storage requires business confirmation, default reference only. New doc includes13front+6back views,14metric definitions, per-page charts/actions, permissions and logical dimension/fact schema, business questions and10acceptances. No code/build/browser/restart/schema changes for this docs-only request. No docs connector available; delivered repository Markdown plus chat PRD.

### T01-T08 fixed migration plan replaces old stage4/5 schedule (2026-11-10)

User requested task batches under new design; migrate old system or mark pending, DO NOT DELETE. Current execution/status authority is docs/70-workplan/70-tower-service-migration-batches.md, PRD120 remains target authority. EXACTLY8 batches T01-T08, separate from historical P1-P18 and old five-stage1-5. NEXT T01 NOT STARTED; all8 pending, this turn planning only. T01 inventory/markers/global context;T02 snapshot sync+rule/version+scope foundation;T03 resource baseline/monthly tenants/anchors;T04 service quantification;T05 measurement evidence/rule trace;T06 findings+reports;T07 overview+regional map;T08 main navigation consolidation+whole acceptance. Detailed subtasks stay within batches, no invented T09 or new closing phase.

Old plan60 now historical: stages1-3 internal/local achievements preserved, stage4/5 never implemented and schedule SUPERSEDED, NOT next to execute. Workplan00 and historical50 point to70; PRD120 updated. Extensive old-route/function migration matrix in70 includes sites, customer-use resources/performance/legacy, map, monitoring, efficiency, capacity, communication usage, analysis, reports/history, verification/records, data-updates, configs/aliases and6disabled planned entries. Keep all old pages/routes/data/history/rules; no deletion inT01-T08 even after cutover. Shared code may be reused, old evidence never reinterpreted as service/money/SLA. Out-of-new-scope communication/fault/monitoring content retained old/pending, not forced into new boards or expanded. New6front+2back main nav switches finallyT08; older functions via secondary legacy collection, no seventhfrontboard. Existing6pending markers remain today; broader runtime marking plannedT01, not already claimed done. No empty19page scaffold.

Separate page migration status from source/confirmation status. Local demonstration acceptance not production integration; real source permissions, field samples, agreement/anchor/meter definitions and live platform/deploy remain explicit external dependencies, not reasons to add batches. No code/UI/route/DDL/config/permissions/build/browser/restart/delete/commit/push/deploy changes this planning turn. User-approved logo kept; product display-name execution not presumed from plan.

### T01 migration baseline and unified snapshot query (2026-11-10)

User authorized start T01. T01 LOCAL ACCEPTANCE COMPLETE; NEXT T02 SNAPSHOT SYNC AND RULE FOUNDATION, NOT STARTED. Fixed authority docs/70-workplan/70-tower-service-migration-batches.md; PRD120 target. Updated workplan index, PRD/index and implementation ops_bsmoss_284_t01-query-migration.md. Do not resume old stage4/5 or claim full resource T03 complete. Exactly T01-T08, no extra closure batch.

Added exhaustive portal/tower-migration registry for all31 PortalPage identities and8targetpaths, only /tower-service/resources available as T01 slice;7targets remain registry only. Business and management Launcher use shared pending/partial/legacy/foundation markers, original labels/order/routes intact;6disabled old plans still disabled and retained. All45old page routes/aliases/anchors/history retained and inventoried in284;46pages total including1new. No T08 main nav cutover or product logo/name change. Old /customer-use resources mode exposes unified query link; old resources/performance/legacy and reports/cases/history untouched. Generic workspace adds optional hrefBuilder/headingContext only, old defaults preserved; header-region recognizes new slice.

New pure domains/tower-service/query validates server-owned catalogue and snapshot/operator/exact city-county scope, rejects unknown/duplicate/forged/out-of-scope query, derives businessPeriod from catalogue, comparison distinguishes revision/month/year/custom and incompatible basis, exact BigInt quantities with unknown/zero-baseline behavior. Query cannot supply workspace/grants. One existing synthetic resource descriptor demo-resources-20261025-18-v1, stock/dataThrough2026-10-25T18:00:00+08:00, source shaanxi-scenario-v1 and resource mapping bsmoss-site-resource-snapshot-v2. NOT a newly published sync snapshot: businessPeriod/syncedAt/publishedAt/rules/completeness null. Runtime page has only1version and disabled comparison with concise no-baseline tooltip; pure A/B rules tested with fixtures only, no fabricated B or history. Formal previewoff returns no demo IDs/data; production source/identity adapter remains T02 dependency.

Resource slice reuses DS15/shared heading/controls/overview/summary/table/cards/dialog/search/reset/pager with no new CSS/primitives/tokens. Province1080sites/5400physicalTowerFacilities; other120/600; Xi'an other27/135. Operator brand selects associated sites and counts all their physical facilities, not customer-exclusive configuration. Concrete customer entities/monthly tenancy/anchor pending; no invented service delivery, energy attribution, fees or outages. Snapshot/operator/region wholepage; search/tenancy/page local. URL/back/forward/drill/up/reset preserve context. Crossing old pages carries only supported scope and explicitly old context, never injects fake snapshot/asOf conversion.

883appunit pass tmp/t01-all-tests.log (6new); final13focused regression pass tmp/t01-release-focused.log; FINAL production build/types pass tmp/t01-release-build.log; FINAL66HTTP pass tmp/t01-release-http.log including formaloff/forged/duplicate/scope/legacy checks. CUA21recordedgroups include actual controls/localfilter/side/paging/history/Launcher,3904759841440light and3901440dark, no page overflow,0consoleerrors. Evidence artifacts/t01-query-qa/checks.json, final.png and screenshots. Finalserver63333PID10924 previewon/OIDCoff, launched after finalbuild, browser reload verified; restoredlight/default843width and marked deliverable. No dependencies/DDL/productionconfig/permissions/deploy/commit/push; huge unrelated dirty tree preserved. T02 pending, not auto-started.

### T02 snapshot sync and versioned rule foundation (2026-11-10)

User authorized continue T02. T02 LOCAL ACCEPTANCE COMPLETE, total2/8; NEXT T03 RESOURCE BASELINE MIGRATION, NOT STARTED. Fixed8batch authority docs/70-workplan/70-tower-service-migration-batches.md; PRD120. Updated plan70, workplan/spec indexes, PRD status and implementation ops_bsmoss_285_t02-snapshot-foundation.md. Do not resume old stage4/5 or P batches. No T08 nav cutover; keep all old pages/routes/data/rules/reports/history.

Added /tower-service/sync plans/snapshots/logs and /tower-service/rules agreements/judgment/access,3views each; existing data-updates and rules link new foundation, Launcher labels/order/URLs unchanged.3of8targetpaths now available including T01resources. Shared DS15 PageHeading/PanelCard/SegmentedControl/DataTable/configuration-search/detail and existing single-line action styles; no newCSS/primitives/tokens/deps. Date cells nowrap and search/reset stay one line; narrow bars/tables own scrolling. Customer/service directory sidepanel supports custom entities/services and nonmoney units, original branding/dictionaries/access still accessible.

Pure foundation + authorization service + isolated FileFoundationStore. Opaque httpOnly strict previewcookie creates hashedworkspace directory under ignored tmp/tower-foundation outside.next. Explicit preview env only; formaloff hides API/data. Mutation origin validates loopback request + strict Origin/Host (Next normalizes request.url hostname; direct origin==request.url rejected legitimate127.0.0.1, fixed and HTTP tested). Body bounded/whitelisted; caller cannot provide grants/workspace. Trusted server access checks action/expiry/province/city/operator/site, projects graph/devices/brands before aggregation and redacts globalchecks/logs for restricted readers; locked writes revalidate. Production identity/entitlement/org adapter NOT wired and formal runtime remains closed, original roles unchanged.

Manual sync captures actual existing synthetic resource inventory, validates identities/conflicts/required brandcodes/sourceboundary/expected site+device counts; writes full immutable payload, manifest,run/checks/audit under exclusive lock+fsync+rename. Repeated identical payloads deduplicate by hash; corruption fails closed, ENOENT only seeds. Failed run never publishes partialsnapshot; retry preserves old run and idempotency. Generated versions retain original stock/dataThrough2026-10-25T18:00:00+08:00, actual sync/publish timestamp, previousversion and scopeKey. T01reference stays; publishedResourceModel reads frozen payload exclusively and validates A/Bsame-scope, same-time revisiondelta0. No fabricated history/tenants/anchors/customer energy/service delivery. Scope-specific comparison rejects mismatched scopes.

Rules: appendimmutable revisions, concrete customer/operator + service/unit + region/effective half-open dates/reference/boundary/confirmation; metering/sharing/judgment common version model. Activation requires confirmed registeredcustomer, no overlapping applicable rules. Sharing saves tenant ranges/anchorcondition/integerfactorBps/monthpolicy, no money; judgments save attention/severe. No broadcaster/other defaults. Business application remains T03/T05/T06; no price engine/fee/approval/SLA. Read-only orgview shows localscope and originalpermissions link, no fabricated productiongrants. Local QA customer/service clearly named; activated QA rule retired at end, history retained.

Independent scripts/tower-preview-worker.ts runs explicit previewonly,15sec loop dueplans, slotidempotency, failurepausesplan. Root package isCJS: top-level await failed actual startup, wrapped asyncmain and verified actualworker publishes2scheduledruns. Scheduler checks BOTH schedule/sync scopes and revalidates both. UI staleedit409 during concurrent scheduledwrite verified then reread. Testplan finally disabled/restored60min, no ongoing minuteimports. WorkerPID24420 remains running; log tmp/t02-worker.log. Final63333WebPID10968 previewon/OIDCoff launched after successful finalbuild; browserreload verified persistence. Worker is separate from Next startup; never autoDDL, productioncron or customer network pulls.

Validation:892appunit pass tmp/t02-all-tests.log (9new),14focused pass tmp/t02-focused-final.log,13newHTTP pass onFINALbuild tmp/t02-http-final.log,66existingHTTP pass tmp/t02-portal-smoke.log. App typecheck tmp/t02-types-final.log and final Nextproductionbuild+types tmp/t02-final-build.log pass. Browser53checks allpass artifacts/t02-foundation-qa/checks.json; actual oldlink/manual+scheduled/payloaddetail/revisioncompare0/customer+customservice/ruleconfirmation/newrevision/activation/retirement/thresholds/live-search-reset/concurrency/3+3tabs/restart;3904759841440light and3901440dark, no pageoverflow, mobile sharingeditor ownverticalscroll, finalpage no consoleerrorrecords. Screenshots final.png,rules-desktop-light.png,rule-mobile-dark.png. Restoredlight/defaultviewport, marked tabdeliverable; CUAcompletion_summary sent once. No DDL/productionconfig/realpermissionchanges/commit/push/deploy; huge unrelateddirtytree preserved.

### T03 resource baseline migration (2026-11-10)

User authorized continue T03. T03 LOCAL ACCEPTANCE COMPLETE, total3/8; NEXT T04 SERVICE QUANTIFICATION, NOT STARTED. Fixed authority plan70/PRD120. Updated plan, indexes, migration matrix and implementation ops_bsmoss_286_t03-resource-baseline.md. Keep all old routes/pages/config/data/reports/history, original Launcher and T08 cutover pending. No extra batches or old stage4 continuation.

/tower-service/resources now3tabs: sites/facilities, concrete monthly tenants/sharing, region distribution. Same frozen snapshot; tower5facilitytypes and customer-owned wirelessdevices separated; global operator selects member sites retaining whole-site facilities. Local type/scene/facility/search affect list only; summary unchanged. Province1080sites/5400facilities/3902customerdevices; eachfacilitytype1080; Xian240/1200; other120/600. Region province/city/demo counties/back, own type/sharing metric and code/value sort; unknown geography separate, no missingregionzerofill. Compact oldrows wrapped numericunits: now existing detailedrow structure numericheader+progress, no CSS change. DS15/shared templates/controlrows/search/live300ms+Enter/reset/paging/cards/dialogs only, no tokens/primitives/deps.

New capture freezes existing source attributes siteType/scene/address/assetCode, original stored snapshots never backfill. publishedResourceModel explicitly projects table fields (no graph/attrs spread); only current page has fullgraph. New /tower-service/resources/[id] server validates same snapshot/scope; row opens sidepanel, name opens full same-version detail, return retains version/A-B/scope/local/page. Old dossier clearly named legacy. Types use escaped unicode ASCII.

Optional tenancy capture in Inventory: fixed month/ref/revision/source/asOf/supersedes, per-site complete and customerId/operator/validity/anchor yes-no-unknown/evidence. Pure tenantMonth ONLY explicit refs; customer acrossservices dedup, multiple otherentities separate; valid halfopen monthlyasOf; nullvalidity and conflictingfacts or partialallowedbrands => unknowncount, no overallsharing. Explicitcompleteempty=>zero; missingmonth/site notzero; denominator occupiedsites, zero denominator null. Restricted read projectsfacts and marks incomplete; fullauthorizedbrandfilter selects sites while keepingfulltenants. preserveTenantHistory blocks sameIDrewrite; atomic sync rejects invalidcapture/futureboundaries; FileStore monthlypayload separatecontenthash verified onread, restart preserves oldrefs; adminAPI only monthrefs nofacts/graphs. Production adapter/source/schema NOT created; realmonthlytenant/anchor missing, UI simplepending not1080missingissues/brandfabrication. Actualagreementsharingtierapplication remainsT05.

904appunit pass tmp/t03-all-tests.log (12new); final23focused pass tmp/t03-focused-final.log. Final12newHTTP pass tmp/t03-http-final.log,13T02HTTP tmp/t03-t02-http-final.log,66legacyHTTP tmp/t03-legacy-http-final.log. Fullpnpm build and finalNextproductionbuild/types pass tmp/t03-release-build.log (earlier prep logs t03-build/final-build). Browser24checks allpass artifacts/t03-resource-qa/checks.json; actual3tabs/regiondrill/back/manualcapture/newattrs+oldmissing/revisiondelta0/liveEnter/type/reset/size10page2graph/rowvsname/samedetailreturn/cards/brandother120600;3904759841440light,3901440darkregions/sharing,390darkdetail nooverflow/finalconsoleerrors0. Screenshots desktop-light.png/sites-390-light.png/regions-390-dark.png/sharing-pending.png/detail-mobile-dark.png/final.png. CUAcompletion_summary sent once, light+viewportreset, tabmarked deliverable.

FinalWeb63333PID2920 previewon/OIDCoff after successfulbuild; independentlocalworkerPID21892 logtmp/t03-worker.log, originalplan remainsdisabled60minutes. Actual manualcapturedversion local-resources-f77054f5-dab6-4301-bf87-b02db5fc7639 (stock2026-10-25T18 unchanged), priorversionsretained. Worker notes ENOENT from transient HTTP testworkspace dirs (harmless noactiveplan). Do not clear tmp/tower-foundation. Hugeunrelateddirtytree preserved; noDDL/productionconfig/realpermission/deploy/commit/push.

### T04 service quantification migration (2026-11-10)

User authorized continue T04. T04 LOCAL ACCEPTANCE COMPLETE, total4/8; NEXT T05 METERING BASIS AND RULE TRACE, NOT STARTED. Fixed plan70/PRD120; implementation ops_bsmoss_287_t04-service-quantification.md. Original routes/config/data/reports/history and Launcher retained, T08 cutover pending. No extra batches, DDL, production permissions/config, deploy, commit or push.

/tower-service/services has operators/composition/periods tabs, global frozen snapshot/operator/region/A-B, second-resolution Beijing cutoff. DS15/shared operation rows, DataTable, ConfigurationSearch live300ms+Enter/reset,10/20/50/100paging, ConfigurationDetail, same-version resource station drill/back. Metric selector at tabs common action row, wraps narrow without squeezing card title. Genuine continuous complete comparable safe-integer periods draw existing chart hideAxis with mouse dashed guide/tooltip; missing/noncomparable/unsafe periods keep exact table, never fill history. No new CSS/tokens/deps/primitives.

Optional ServiceCapture freezes concrete customer+brand, metric/service/spec/boundary/unit/scale/kind/confirmation, configured component quantity/validity/ownership, reliable full-interval usage/basis/physicalboundary/exclusivegroup/agreement+ruleversions, period/cutoff and sourcecatalogmappingrules versions. BigInt exact minimum units, no mixed units, K06 overlap-site dedup, K07 end stock, K09 attributed reliable full intervals, no temporal prorating; K08 unconfirmed disabled. Null unknown vs explicit complete zero. Component conflicts, overlapping meters, invalid interval or changed capture/catalog reject. Parent original station_service semantics unchanged.

Scope before aggregates: historical service sites from facts, not present brands; prune out-of-scope concrete customer names. Final patch freezes optional operatorScope, legacy absent=>all5, intersections survive scopeServices, uncaptured brand summary returns null rather than knownzero.18T04rules pass. Optional servicepayload separately contenthashed/atomic, missing/corrupt failclosed, preserve historical capture/catalog. Manifest API excludes facts; previewoff closed. Source is still physical demo ONLY: no real services/usage/monthlytenant/anchor; default3tabs pending, no fabricated service ranking/history. Fixtures are testonly, isolated localhost browser workspace, never user127.0.0.1source/seed. Actual protocol/tier/meter algorithms remain T05.

Final922appunit pass tmp/t04-release-tests-final.log;18T04pass tmp/t04-scope-final.log;11T04HTTP tmp/t04-services-http-final.log and25T02/T03HTTP tmp/t04-foundation-http-final.log pass on FINALbuild; prior66legacyHTTP pass tmp/t04-regression-http.log. Final Nextbuild/types pass tmp/t04-scope-build.log. Browser36checks allpass artifacts/t04-service-qa/checks.json, consoleerrors0,3904759841440dark+3901440light, actual interactions search/reset/page/sidepanel/matrix/A-B/period click/chart pointer/sameversion station/back. CUA completion_summary already sent once, final original usertab restoredlight/default843 viewport, QA tabclosed; final.png actualpending and operators-fixture/composition-fixture/periods-fixture/periods-390-dark/detail-390-light. Last scopepatch backendonly, no UIchange.

FinalWeb63333PID6556 previewon/OIDCoff and workerPID25060 restarted after successfulbuild, HTTP200. Workerlog tmp/t04-worker.log; originalplan remainsdisabled60min. Preserve tmp/tower-foundation userhistory, actual local-resources-f77054f5-dab6-4301-bf87-b02db5fc7639 still physicaldemo2026-10-25T18. Worker logs ENOENT on transient HTTPtest dirs, noactiveplan. Huge unrelateddirtytree preserved.

### T05 metering evidence and early Launcher grouping (2026-11-10)

User authorized T05 plus first separating new Launcher entries above legacy/pending entries. T05 LOCAL ACCEPTANCE COMPLETE, total5/8; NEXT T06 FINDINGS AND HISTORICAL REPORTS, NOT STARTED. Fixed8batch plan70/PRD120. Implementation288, plan/index/spec statuses updated. Early Launcher grouping explicitly authorized, NOT full T08 acceptance. Old names/routes/plans/pages/config/data/reports/history preserved; no DDL/deps/CSS/tokens/permissions/productionconfig/deploy/commit/push.

New /tower-service/evidence summary/details/rules, DS15/shared layouts, secondresolution cutoff/global snapshot/operator/region/A-B; local filters/live300ms+Enter/reset/paging10/20/50/100, private no-store server-authorized fullfiltered CSV with formula escaping. Row raw-source drawer; name sameversion resource. Frozen rule A/B matrix and rule detail. Launcher3available business targets resources/services/evidence above old3tiers marked pending; management sync/rules above original entries. Active path and focus/Escape kept. No empty new targets.

Optional EvidenceCapture separately hashpersisted/atomic, immutable source/records/binding/rules/monthly references. BigInt exact physical interval/cumulative difference x multiplier, no prorate; total/sub separate, reset/replacement explicitsegments, missing/gap/ruleboundary conflicts pending; allocations require bindings/integerbps/conservation and no measuredchild doubleclaim, estimates authorization+separatestatus. Sharing uses fixedmonthly concrete count/customeranchor, wholemonth/segmented/refday; coeffonly does not changequantity/money. Publication freezes applicable configured active revisions; historicreads never use today's catalogue. Scope removes othercustomer records and total rawinputs for restricted customer allocations; failclosed pending. Manifest no rawfacts.

Only explicit new sync freezes existing synthetic physical Oct25 00-18 observations:1080sites/19440hourrecords/43258039Wh; no fabricated customers/bindings/rules/sharedtiers. Historical snapshots never backfilled. Applicability unknown=>K11/K12 unknown, not1080anomalies. QA1000total/400+500sub/100residual and70percenttier were isolated localhost workspace/testfixtures, not user source. Formalpreviewoff withheld data/export. Real interfaces/meterbinding/agreements/monthlytenant/productionstore/orgidentity remainpending.

Final945appunit pass tmp/t05-release-all-tests.log,23T05focused pass tmp/t05-security-final.log;47HTTP T02-T05 pass tmp/t05-release-http.log(35) + tmp/t05-release-resource-http.log(12), finalNextbuild/types tmp/t05-release-build.log pass. Browser32checks allpass artifacts/t05-evidence-qa/checks.json,consoleerrors0,3904759841440 light/dark,raw/rule/sidebar,configuration save+reread,revision-100Wh,no growth,snapshot clearslocalfilters,sameversion station/back,query/paging/filteredexport,Launcher bothdomains. Screenshots final.png,launcher-light.png,launcher-management-light.png,detail-390-dark-final.png. Usertab actualsummary/light/defaultviewport restored+deliverable;QAclosed;CUAcompletion_summary sent once.

FinalWeb63333 PID19308 previewon/OIDCoff,workerPID15964 logtmp/t05-worker.log after successfulfinalbuild. Plan remainsdisabled60min. Usercapturedversion local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba physicalsourceOct25T18 and alloldversionspreserved. Worker ENOENT for transienttestworkspace directories harmless/noactiveplan. Do not clear tmp/tower-foundation. Huge unrelateddirtytree preserved.

### T06 findings and fixed historical reports (2026-11-11)

User authorized continue T06. T06 LOCAL ACCEPTANCE COMPLETE, total6/8; NEXT T07 BUSINESS OVERVIEW AND REGIONAL NETWORK PANORAMA, NOT STARTED. T08 pending; fixed8batch authority plan70/PRD120. Updated current plan/index/spec statuses and implementation ops_bsmoss_289_t06-judgment-reports.md. Keep all old pages/routes/data/config/reports/tasks/templates/verification/history. No DDL, production config/access expansion, deployment, commit or push. Huge unrelated dirty tree preserved.

/tower-service/judgment has only findings/reports tabs. DS15 and existing shared layouts/controls/tables/sidebars/search/pagination, no new CSS/tokens/dependencies/primitives. Global snapshot/A-B/operator/region controls full page; local search/type/severity/page do not change global summary. Launcher now4available business targets above legacy pending collection, no T08 final cutover. Old report centre links new library while old content and generation remain.

Pure six findings: explicit known applicable basis_pending, basis_conflict, complete reliable same-unit/boundary metering_gap (NOT loss), monthly anchor_unknown, concrete-metric service_change absolute percent, tenant_site_change. Frozen confirmed active rule revisions only; old snapshots never backfill. BigInt exact rational values and decimal thresholds, severe exclusive over attention, zero baseline/incompatible/missing source not anomalous. Frozen duplicate IDs failclosed; active overlap distinguishes metric and metricId. New sync freezes judgments with separate content hash; manifest API strips report contents. Service removal retains prior-site/snapshot links; total/sub residual drills operator=all to retain total source. Detail clears on comparison change.

Reports preview->confirm generate->fixed view/HTML+JSON export, append immutable IDs, actor/idempotency/context guards; history lists ALL authorized reports regardless current global filters. Whole saved scope must remain authorized; no partial masking that leaks totals. Captures resource/services/evidence/findings/limitations, precise current/baseline/delta, A/B/source business periods/catalog/mapping/rules/agreement/monthly tenant/template refs, original facts and SHA256. Reads fixed body, never recompute with current rules; corruption rejects. Private no-store/Vary Cookie, CSP/escaping HTML reuses exact legacy report style. UI epoch/context guards prevent stale preview, retry supported. Rule editor explicit target and metricId, percent derived for change targets; QA draft persisted but NOT activated.

Real user source unchanged local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba,1080sites/43258039Wh/Oct25T18; real customers/monthly tenants/anchors/bindings/agreements/production store+org mapping still pending. No QA customers/rules injected into127.0.0.1 user source. Separate localhost workspace preserves prior T04/T05 fixtures plus qa-t06-before/current;2sites,4attention/2severe,6types. User created report tower-report-5850b967-1d55-4b34-8bee-be900b5b8022 honestly shows resource/whole-site evidence with missing-source limits. QA reports and draft retained, no deletions.

Final965appunit pass tmp/t06-verified-all-tests.log(20newT06);58T02-T06HTTP pass tmp/t06-final-http.log; finalbuild11T06HTTP pass tmp/t06-delivery-http.log;66legacyHTTP pass tmp/t06-portal-smoke.log. FinalNextproductionbuild+types pass tmp/t06-delivery-build.log, no source edits afterward. Browser24/24 pass artifacts/t06-judgment-qa/checks.json,3904759841440 light/dark no pageoverflow, findings/rules/context/whole-site source/history/search/reset/reportgenerate+retry/download/reload. Finaluserconsoleerrors0. Screenshots actual-report-library.png and fixed-report-1440-dark.png. Restoredlight/defaultviewport, marked usertab deliverable, QA closed; CUAcompletion_summary sent exactly once.

FinalWeb63333PID3348 previewon/OIDCoff, workerPID15748 logtmp/t06-worker.log, started after successful build. Originalplan disabled60min. Preserve tmp/tower-foundation and all snapshot/report history. T07 not auto-started.


### T07 overview and regional network (2026-11-11)

User authorized continue T07. T07 LOCAL ACCEPTANCE COMPLETE, total7/8; NEXT T08 FINAL NAVIGATION AND END-TO-END ACCEPTANCE, NOT STARTED. Fixed8batch plan70/PRD120. Updated current plan/index/spec status and implementation ops_bsmoss_290_t07-overview-network.md. Original root overview, point map, settings, pages, data, snapshots, report history and old Launcher collection retained. No DDL, production config/access change, deployment, commit or push; huge unrelated dirty tree preserved.

New /tower-service/overview no tabs, composes accepted baselineModel/servicesModel/judgmentFindings, source-aware summary, region progress rows, operator x service metric matrix with separate units, max3findings (severe first). Optional href in shared AnalysisSummary only for opted-in metrics. /tower-service/network administrative SVG from existing local GeoJSON (no points, new dependencies or remote tiles), resource/service/sharing layers, exact metric/current/difference, matching table, region drawer, city/county drill and ghost back, same-version topic link. Unknown grey; absent regions not filled with zero; unallocated table only. BigInt quantities exact, Number only normalized colour. A/B metric identity/full period checks; sharing percentage-point delta and frozen occupied denominator. Increase primary, decrease warning; no arbitrary red severity. Tooltip current/B/delta/A-B refs/share denominator. Dense county labels avoid overlap while retaining DS physical font size; all names still in tooltip/table. Reset B restores value mode, changing snapshot resets metric. No CSS files/tokens/deps/primitives.

Launcher new collection now6business targets; old complete tiers preserved. towerNavigationHref carries only global A/B/operator/region among new boards, not local layer/search or old/management targets; region-aware routes registered. Root/map partial migration; old overview display settings still pending by old metric semantics, not silently applied to new dashboard. T08 final cutover not performed.

Actual user source unchanged local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba;1080sites/5400facilities/Oct25T18. Services/monthlytenants/frozenjudgment still absent; no manufactured ranking/zeros/findings. Existing whole-site evidence remains. Isolated localhost T04-T06 fixture used for full UI; HTTP random workspaces independently persist two-version service cases. Nothing injected into real127.0.0.1 workspace. Real customer sources, monthly anchors, bindings, agreements, production store/org identity and other/broadcast semantics remain pending.

977appunit pass tmp/t07-all-tests.log (12new);13focused/model+migration pass tmp/t07-model-tests.log. Final production build+types tmp/t07-release-build.log PASS, no business source edits afterward. Final67T02-T07HTTP pass tmp/t07-release-http.log (9T07);66legacyHTTP pass tmp/t07-legacy-http.log. Initial T07HTTP assertion incorrectly looked for concrete customer name in brand matrix, corrected to service metric (no runtime source fault). Browser23observations pass artifacts/t07-dashboard-qa/checks.json,3904755779841440 light/dark, region keyboard/drill/back/topic, matrix sameoperator/category/A-B, tooltip exact9/8/+1 centeredlegend, fixed shared2/occupied2, cancelB, missingreason, Launcher, no pageoverflow;390county13polygons/8noncollidinglabels. Initial tooltip timing and overbroad zero-substring QA assertions were corrected and visibly retested. Isolated fixture consoleerrors0. Images overview-390-dark-final,network-difference-1440-dark,counties-390-dark,sharing-pending-390-dark-final. Usertab original restoredlight/default843viewport and marked deliverable, temporary QA closed; CUA completion_summary sent exactly once.

FinalWeb63333PID24312 previewon/OIDCoff; existingworkerPID15748 remains running. Originalplan disabled60min. Preserve tmp/tower-foundation allsnapshots/reports. T08 not auto-started.


### T08 primary navigation and whole acceptance (2026-11-11)

User authorized continue T08. T01-T08 LOCAL ACCEPTANCE COMPLETE, total8/8; fixed eight-batch migration locally CLOSED. NO NEXT T09 or invented closing stage. Authority plan70 and PRD120/indexes updated; final implementation ops_bsmoss_291_t08-navigation-acceptance.md records19views, migration matrix, source/business dependencies and rollback. Formal interfaces, org identity/entitlement, production persistence/hosting, capacity and UAT remain external launch dependencies, not locally complete.

Central portal/tower-navigation metadata now defines exact6business+2backend. Launcher primary6business and2backend, original functions in expandable secondary legacy collection, closed on new pages/open on old; disabled6plans retained. Backend sidebar2primary+legacy collection, mobileDrawer. Path-based domain fixes /tower-service/sync mistaken business active data-updates. Product name towerBrand PRD short/full adopted in shell/title/visitor/original map; approved V2 assets preserved. Brand goes /tower-service/overview, gear /tower-service/rules. ROOT / STILL ORIGINAL overview; no bulkredirects, all45old page routes/aliases retained (54total=45old+8main+1resource detail). Old settings/read/write/report semantics unchanged. Runtime migration registry statuses partial vs legacy vs pending updated honestly; old overview display remains pending and only applies old metrics.

Cross-new-business navigation carries snapshotId/compareSnapshotId/operator/city/county only; localfilters dropped. Backend/old targets receive no incompatible new snapshotquery. Frozen resource detail regionalchange returns resourceslist with A/B/operator, removes station/localparams; browserback restores station. No CSS/tokens/deps/primitives added. No business aggregation/rule changes, DDL/productionconfig/access changes, delete/deploy/commit/push. Huge preexisting dirtytree preserved.

983appunit pass tmp/t08-all-tests.log (6new navigation/link/domain/region/sidebar tests);25related final pass tmp/t08-focused-final.log. Finalproductionbuild+types pass tmp/t08-final-build.log; no applicationeditsafter. Final73new-system HTTP (6T08)+66legacy HTTP=139 pass tmp/t08-final-http.log and tmp/t08-legacy-http.log. T08HTTP tests19views previewoff/on, sameA/B services/monthlytenant/agreement/customer/region, frozenreport/history/export/crossworkspace; randomisolatedstoreonly. Two initial QAassertions expected +sign and SSR reportID in clientloadedhistory, corrected without businesscodechange. Static45old route inventory saved artifacts/t08-cutover-qa/route-inventory.json; not claim45manualworkflows.

Browser49checks allpass artifacts/t08-cutover-qa/checks.json, all19views/primarynav/oldentry/oldsettings/Escape/livequery/globaloperator/A-B/localclear/sameversiondetail/regionreturn/back/frozenrules/rawmeter/historyactualJSONdownload/3904759841440themes. Fixturetabconsole0. Originaltab9RSCprefetcherrors at17:50:45Z during finalbuildstop, noneafterfinalbuild17:51:12Z/restart; observationssaved, do notclaimlogsabsent. InitialUIwaits saw staleNextDOM; rereadandverified completedstates. final.png actualuserlauncher (notfixture), agreement/report/mobilebackend/legacysettings/map/network screenshots samefolder. Temporarytabclosed, usertab1 restoredlight/defaultviewport and markDeliverable; CUAcompletion_summary already sent exactlyonce.

User current physical snapshot unchanged local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba (1080sites/5400facilities/cutoffOct25T18). Services/monthlytenant/frozenjudgment sources stillpending; nofakezero/normal/finding. User saved report tower-report-5850b967-1d55-4b34-8bee-be900b5b8022 visiblyretained. QA localhost fixtures and all existing tmp/tower-foundation history preserved. FinalWeb63333PID27804 previewon/OIDCoff; workerPID15748 remains. Originalsyncplan stilldisabled60min. This roundclosed; do not automatically start new work.


### Six primary page heading correction (2026-11-11)

User asked why the six primary page headings differ. Corrected layout only, T01-T08 remain closed8/8; no invented next batch. Services/evidence lacked product-page-inset and used DS default padding: title y80 vs64 at475; at843 y90.98 vs80 plus unequal horizontal inset. Added existing inset to both. SiteAnalysisWorkspace now uses official ShellPageContainer, matching the other five pages; same shared heading/inset/gap. Global product-page-utilities min-height uses existing space-control-md, keeping context-only mobile row equal to button row without forcing header height. Four application files changed; no business/rule/data/navigation changes or new tokens/primitives/dependencies.

App type-check and final production build passed tmp/tower-heading-build.log. CUA24observations at390/475/984/1440: six title x/y/line-height identical within each width, no page/header overflow. Header heights also identical475/984/1440;390 long subtitles on services/evidence/judgment naturally wrap to2lines (documented, not claimed equal full heights). Customer-use/capacity475 also no overflow. Evidence artifacts/tower-heading-qa/checks.json, before.json, final.png, comparison.png. Existing790 doc updated; no layout-mirroring unit tests. Browser viewport reset, overview tab2 marked deliverable, stale prior connection-refused tab1 preserved. CUAcompletion_summary sent once.

Web63333 restarted PID20912 with same preview settings; worker25668 left running. Existing snapshot/report history and huge unrelated dirtytree preserved. No commit/push/deploy/DDL.


### Resource table device columns (2026-11-11)

User requested merging tower categories and tooltip device lists for both owners. baseline-workspace.tsx only: official Tooltip/Trigger/Content shared DeviceCount, five facility columns become towerDevices (label tower equipment), customerDevices label customer equipment. Snapshot devices filtered by existing owner rule; totals, categories, card/detail/filters untouched. Tooltip per device name+ID in li; keyboard focus and hover supported, zero empty message. ASCII source. Types+productionbuild pass tmp/resource-device-columns-{types,build}.log. CUA table8columns, firstrow5tower/4customer, li counts5/4, visible screenshots both lists and475 no pageoverflow. artifacts/resource-device-columns-qa/{checks.json,tower-devices.png,customer-devices.png,final.png}. Native tab keyboard opened stable Tooltip after locator.press produced transient states; verified final visible list. CUAcompletion_summary sent once. Viewport reset (ambient current475), user resources tab2 deliverable. Web63333 PID15224 restarted; worker25668 unchanged; all existing snapshots/reports/unrelatededits preserved. T01-T08 still8/8, no new batch.


### Facility category icons (2026-11-11)

User asked each facility type distinct icon. baseline-workspace.tsx facilityIcons: CellTower/Lightning/BatteryVerticalFull/Gauge/Thermometer from existing Phosphor library mapped to tower/power/storage/meter/environment. Removed repeated database icon on5rows, kept shared distribution icon CSS32px/primary/spacing and all data/progress. App types and final productionbuild pass tmp/resource-facility-icons-types.log and tmp/resource-facility-icons-build.log. Browser verified5distinct SVGs,32px and equalcolor, final tower has actual towerbody;475 and843 screenshots reviewed. artifacts/resource-facility-icons-qa/final.png + checks.json. Temporary viewport reset; resources usertab2 deliverable, CUAcompletion_summary once. Web63333 PID604 restarted with same preview configuration, worker25668 unchanged. T01-T08 closed8/8; no new batch, business/rules/data/deps/tokens untouched. ExistingT03doc appended.


### Resource perspectives and viewport refinement (2026-11-11)

User approved3secondaryviews resource composition / regional distribution / station details, desktop fit-screen and mobile natural layout. Post-T08 refinement, T01-T08 remain CLOSED8/8; no T09. PRD120 amended and286implementation appended. Defaultpage composition, pure baselineModel defaultsites compatibility. Old tenancy auxiliary marked pending retained with old facts/routes/history.

New resources/composition.tsx, regions.tsx, resources.css use DS15PanelCard/Progress/SegmentedControl/Tooltip and configuredOperatorLogo. Tower5categories with distinctPhosphoricons, customerowner/category/count/share. Scopediconminheight equalizes all paired rows. RegionalSVG uses existing networkGeography and bundledGeoJSON, no newdep/remote map; geography argument Pick context/region only. Mapmetric sites/facilities/customerDevices, physicalfontscaled by min(svgwidth,height), noncollidinglabels; same-max blue/greenbars, linkedcounts, provincecitycounty drill, ghostback also mobilemap. Unknowngeography static separate row, no invalidURL.

Model totals/customerCounts/customerDelta/regioncustomerdevices IDdedup; customerdevices filteredowner when operatorselected, towerfacilities whole physicalassociatedsites. Localtablefilters neverchange globals. Standalonetable groupeddevicecolumns+tooltips, bothownersinsiderowdrawer/mobilecards, namefixedsnapshot detail. Sharedworkspace optionalfillViewport, only resourcesopt-in; desktopbody/internaltable scroll/fixedtools+pagination, mobile natural. ShellPageContainer drops data-analysis-kind attribute, finaltable minwidth scoped .site-analysis-page-fill .site-analysis-table table using container-page-lg1024px. SourceASCII; no customprimitives/tokens/deps.

19modeltests pass tmp/resource-perspectives-model-final.log,12finalHTTPpass tmp/resource-perspectives-delivery-http.log. Fullpnpm build pass and finalNextproductionbuild+types pass tmp/resource-perspectives-delivery-build.log.13browserchecks pass artifacts/resource-perspectives-qa/checks.json: pairedrowgeometry, province1080/5400/3902-city240/1200/864-county62/310/226, mapmetric/back, query1result globalunchanged/reset, rowdrawer/fixedname,3904758439841440 widths, darkregions.843workspace791/791,1440workspace820/820 and fixedpagination. Screenshots final.png default475, regions-984-dark.png fullregional; composition-1440.png croppedcapture notfullpageevidence. A reload/hydrationrace initially selectedauxsharing, re-readandverified properregion; initialtableminwidthselector used droppeddataattribute, correctedandvisuallyverified1024width/noouteroverflow.

Restoredlight/default475x889viewport, allprovince defaultcomposition on tab2 deliverable; CUAcompletion_summary sentonce. Web63333PID2172previewon/OIDCoff, existingworker25668unchanged. Originalsnapshot local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba,reporthistory and alluser/unrelateddirtyfilespreserved. Formalcustomerservices/monthlytenants/productionorg/persistence stillpending; nofabricatedfacts,DDL,deploy,commit,push.

### Resource header and operation row refinement (2026-11-11)

User requested fullscreen second after theme; secondarytabs in title; remaining controls/stats one row; footer notes become info drawer. Implemented official ShellFullscreenToggle targetapp, existingProvider and32px class. ProductHeaderTools order theme/fullscreen/messages/help/settings. Shared SiteAnalysisWorkspace optional workspaceClassName/headingSecondary/headingActions/notesInDrawer; official Drawer and ShellIconButton, notesContent reused, otherpages keep footer details. AnalysisSummary optionalshowIcons defaulttrue, resourcesfalse. SnapshotControls optionalcompact defaultfalse, compacttrigger MM-DD HH:mm, fullmenu retains date/version. Resource CSS scoped flexnowrap/maxcontent/min100percent row, mobileinternal scroll, headinggaps tokens. Resource tabs title; source/comparison/sharingpending move to drawer, existingnotes preserved. No model/query/rule/source changes.

Finalproductionbuild+types pass tmp/resource-compact-delivery-build.log,12HTTPpass tmp/resource-compact-delivery-http.log; tests adjusted because closedDrawer excludes note prose from SSR (verify frozencontext href and visible summary instead). Browser checks artifacts/resource-compact-qa/checks.json:843toolbar746/746, composition panels top250 vs326,height589 vs471; title tabs, nofooterdetails, regions and sites with fixedpagination, otheroperator120/600/120 thenrestoreall.390toolbar342/722,475423/722 internalonly; documents390/390 and475/475. Narrowdrawer opens/closes. IABnative requestFullscreen unavailable, enter/exitstate verified only; nativeactualfullscreen unverified, no customfallback. Screenshots final-843.png/notes-843.png/final-475.png. Default1280x720/light/allprovince/composition restored, tab4deliverable; oldtab2 disappeared so newtab4created, no usertab closed. CUAcompletion_summary sentonce.

CurrentWeb63333PID15768previewon/OIDCoff, worker25668untouched; originalsnapshot1080/5400/3902andhistory intact. Docs286and660 updated. T01-T08 closed8/8; no newbatch,DDL,deploy,commit,push. Huge unrelateddirtytree preserved.

### Resource regional columns, full dataset fit (2026-11-11)

User clarified horizontal means categories along x-axis with vertical columns, then required all regions fit without chart scrolling. Resource regions now single full-width PanelCard, city/county and compare/tower/operators DS segmented controls. Removed resource map only; network map untouched. Existing ECharts SVG dependency renders grouped tower/customer or stacked facility/operator columns. No dataZoom, slicing, minimum plot width, new dependencies/primitives/tokens. Responsive width determines column spacing and sampled/rotated labels; all data columns remain rendered. Tooltip shows full region, parent city, sites, series and stacked total, safely built with textContent. DS computed colors/font/spacing/grid, ResizeObserver/theme observer, keyboard selection/drill/detail and blur cleanup.

baselineModel adds validated local regionLevel/resourceView and supports all98county aggregation, Xian13county; row cityName/operator-owned counts preserve snapshot ownership and global scope. Global city change selects suitable hierarchy; hrefs preserve frozen context. Desktop fills available height, mobile natural document flow; chart itself never scrolls. Narrow card actions wrap below one-line title. PRD120 and implementation286 updated; T01-T08 remain CLOSED8/8, no T09.

22modeltests, types and finalproductionbuild pass tmp/resource-columns-delivery-build.log. HTTP final log tmp/resource-columns-final-http.log. Browser11checks artifacts/resource-columns-qa/checks.json:98county196bars at843and390, plot client/scroll equal (843681x394;390277x336;475357x336),843workspace791/791,10citylabels and20columns, dark/light, citycounty/back, axisclick, keyboardtooltip and frozen detail, other120/600/120 restoredall. final-843.png reviewed with full page context; counties-390-dark.png densechart evidence. Consoleerrors empty; default viewport/light/citycompare restored, tab5deliverable. Oldtab4 data error page cleanup was policy-blocked; left untouched, no retry. CUAcompletion_summary once.

Web63333PID28280 previewon/OIDCoff, existingworker25668unchanged. Original local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba1080/5400/3902 and report/history/userdirtyfiles preserved. No commit/push/deploy/DDL; formal source integrations remain pending.

### Regional grouped columns and restrained palette (2026-11-11)

User requests city/county only (no station detail), tower/operator grouped adjacent columns (no stacks). Implemented regions.tsx/region-chart.tsx: removed rowdetail and ShiftEnter navigation, citybar/axis drill county, county clicks/Enter remain; labels/aria reflect actual hierarchy. All98county series remain without plot scrolling. User corrected initial flicker report: retain series hover focus. Found genuine rendering compatibility: ECharts derived hover colors fail modern oklch/color formats. Resolve DS series colors through browser canvas toRGBA, preserves allseries on hover; no newdeps.

User says too colorful: tower monochrome blue, operators monochrome teal, compareblue/green. Theme-based color-mix steps with local --resource-chart-tint (card light/foreground dark), semantic tokens only. No DS/global override. NewHTTP assertions county no station/keyboarddrill prose; finalbuild types pass tmp/resource-grouped-build.log,12HTTPpass tmp/resource-grouped-http.log. Browser84350bars percityview, Xian65county bars, mousecitydrill/countyclick+Enter+ShiftEnter stay,390all98county488nonzeroSVGbars out490, nointernaloverflow277x336 anddocument390/390, darkcolors visible and alldata retained, consoleerrors[]. Evidence artifacts/resource-grouped-qa/final-843.png (lighttower),operators-843.png,counties-390-dark.png. Finaldefaultviewport/light/citytower tab5deliverable,CUAcompletion_summary once. PRD120 andimplementation286 updated. Web63333PID4624,worker25668unchanged;T01-T08 remain8/8. Originalsnapshot/history/unrelateddirtyfiles preserved;noDDL/commit/push/deploy.

### Resource regional eight-comment refinement (2026-11-11, latest overrides previous palette/density)

User explicitly requests DS categorical colors (not gradients/semantic tones), togglelegend, provinceallcities/top10county/bottom10county, removecompareview, equalheightback, focusrowtooltip, removeduplicateregion, summaryseparators. Implemented chart-1..6 from DS15contract04, samepalette tower/operators; removed color-mix/localtint. KeepRGBA conversion. Official ToggleGroup multiple+ToggleGroupItem (variantdefault,size sm) legend; scoped off-state line-through/markeropacity, alloffstatus recovery; hiddenkey state perresourceview, onlyvisible series render. Tooltip actualmouseover serieskey marks focusedrow bg-muted/font-semibold600, others400; DOM text safe, card surface, labelnumeric grayscale with color dots.

baselineModel new validated local regionRanking all/top/bottom; fullregions aggregation preserved, chartRegions rankby facilities for tower/customerDevices for operators andcode tie, topdescending/bottomascending limit10,unknownexcluded. Parent cityscope applies; less10allshown. regionLevel legacyvalidated but actuallevel all+provincecity elsecounty; comparelegacy normalizedtower. Defaulttower. Regionscontrols allcities (allcounties in city)/top10/bottom10 + tower/operators; no compare. Cityclickdrillschildcounties,countyclicknogodetail. Headerglobalchangehref resetsrankall; globalheaderonlyregion via SnapshotControls optional showRegion defaulttrue, resourcefalse. ResourceSummary siteprefix and border separators; returnButtonmd+scopedcontrol-md =24same segmented; no globaloverride.

9modeltests pass tmp/resource-refinements-model.log; types in finalproductionbuild tmp/resource-refinements-build.log pass;12HTTPpass tmp/resource-refinements-http.log. InitialHTTP absence-of-region assertion accidentally matched retainedHeader, corrected exactlyone; no businessfailure. Browserlegend50→40/fullalloffrecovery, Baoji12county/citydrill+back, county top/bottom10 and province10 rank/scope summaries unchanged, sharedpalette matches, controls24/24/24, tooltip600vs400, onlyoneHeaderRegion, 390document390/390 plot277x336 noscroll andlegendwrap, both themes/errors[]. AXreports ToggleGroup buttons ascheckbox but DOMroles button+aria-pressed (use getByRolebutton). Evidence artifacts/resource-refinements-qa/{final-843.png,tooltip-843.png,operators-top10-843.png,top10-390-dark.png}. Restoredlight/defaultviewport/Baoji city610300 allcounties tower on tab5deliverable;CUAcompletion_summary once. PRD120/implementation286 updated, T01-T08 CLOSED8/8. Web63333PID17876 worker25668untouched,originalsnapshot1080/5400/3902/history/userdirtyfiles retained; noDDL/commit/push/deploy.

### Resource heading navigation, real snapshot steps and equipment units (2026-11-11)

Latest refinement complete, T01-T08 remain CLOSED 8/8. Resources heading: help/question icon beside full data timestamp, three separate DS Button links below at right (aria-current). Shared SiteAnalysisWorkspace optional notesInHeadingContext reuses existing Drawer; defaults unchanged. SnapshotControls optional snapshotOnly hides operator/region/compare only on resources, displays actual version select and previous/next buttons. Pure snapshotNeighbors sorts stockAsOf, revision syncedAt/publishedAt, then ID; boundary/missing disabled, no invented calendar aggregation. Switch preserves city/county/view, clears comparison/page1. Summary tower/customer units changed from items to equipment, separators retained. Other resource chart units unchanged.

5 query tests, typecheck and production build passed; tmp/resource-header-types.log, tmp/resource-header-build.log. 13 HTTP tests passed tmp/resource-header-http.log incl navigation/context/units and old comparison/source boundaries. Browser artifacts/resource-header-qa/checks.json, final-843.png, help-843.png, mobile-390.png: help/time y80, nav y113.29; all three views preserve Baoji140/700/507. Previous actual revision f77054f5... switched, next restores original89bc0569...; latest next disabled. 390 document390/390, internal operation scroll342/521;843 document843/843. Services defaults operator/compare remain. Errors empty. Initial immediate-resize final screenshot was cropped; replaced with full correct843 screenshot and visually reviewed. Default viewport/light/Baoji allcounties tower regions restored; tab5 deliverable, temporary tab6 closed, stale tab4 untouched; CUA completion_summary once.

Web63333 now PID512 with same preview config; worker25668 untouched. PRD120 and implementation286 updated. Original1080/5400/3902 snapshot and all history/unrelated files preserved. No DDL/commit/push/deploy/new batch. Round complete.

### Snapshot square buttons and calendar prefix (2026-11-11)

User requested explain time concern and repair non-square buttons/add leading icon. Explained inventory snapshots cannot sum across periods, hour/day/week/month could locate period-end inventory; current actual-version navigation unchanged, no new period controls implemented. Root cause DS icon-md width24 plus shared filter-row height32. query-controls.tsx snapshotOnly arrows now original period-controls' icon-xl, verified32x32/dateheight32/samey185.96; leading calendar16 with sharedgap8. No CSS/token/default behavior changes. Build+types passed tmp/resource-time-controls-build.log, screenshot/checks artifacts/resource-time-controls-qa.843doc843/843, viewportreset/tab5deliverable/light/Baoji preserved, CUA completion_summary once. Web63333 PID12092,worker25668 untouched. Doc286 updated, T01-T08 still8/8. No tests added for low-impact style correction; no commit/push/deploy/DDL/history changes.

### Open station table, retain composition and region cards (2026-11-11)

User requested open stationdetails; composition/regions retain cards. Shared SiteAnalysisWorkspace optionalopenTable (only resources viewsites) conditionally unwraps PanelCard via local tableSurface composition, removes duplicate heading/description and ViewModeSwitch, forces list even if old cards state. Otherpages keep defaults. Shared scopedopen CSS flex column/no new visual primitives, desktop remainingheight+pagination, mobile max-height none/natural20rows; emptyfilterwrapper displaynone fixes16px ghostgap so mobile search/table x24. Search/facet/pagination/rowdetail/namehandlers unchanged. PRD120 and implementation286 updated.

Finalbuild/types pass tmp/resource-open-table-final-build.log;13 existingHTTPpass tmp/resource-open-table-http.log. Browser artifacts/resource-open-table-qa/checks.json, final-1280.png, final-843.png, mobile-390.png: open0card/0viewswitch/border0/padding0/shadownone/transparent;843table461/1585,paginationbottom839.33/doc843/843;390table1585/1585,maxHeightnone/doc390/390;1280table1137/1137 all8columns. Search nonexistence/reset/page2 firstindex21/rowdialog verified, composition2cards and region1card preserved, errors empty. No new layout tests. Initial Python command unavailable; replaced with local Node for exact source edits. Initial standalonetypecheck preceded final JSX changes; final build includes finaltypevalidation. FinalCSS emptywrapperalignment rebuilt and rechecked; no behavior changes afterHTTP.

Web63333 PID11292, worker25668 untouched. Defaultviewport/light/Baoji resources sites page1 on tab5deliverable; CUA completion_summary once. Originalsnapshot/history/unrelateddirtyfiles preserved. T01-T08 CLOSED8/8, no newbatch,DDL,commit,push,deploy.

### Resource analysis icon and compound filter toolbar (2026-11-11)

Latest user refinement: resource snapshot prefix now DS chart-bar xl32 (replaces calendar16), arrows remain official32square. Resources detailed toolbar reuses sites structure: left ViewModeSwitch; right search/compoundfilter/reset. All32height samey at843. Open outer surface retained; decouple openTable from displaymode and restore list/cards perlatest request, superseding priorforcedlist. New resources/filters.tsx composes DS Popover/Label/Select/Button; siteType/scene/facility draft onopen, explicitapply page1, canceldiscardsdraft, activecountbadge. No externalfilters now (max2ifneeded); no irrelevant live maintenance/operator fields. Resource localfilters do notchange globalcontextsummary.

Types pass tmp/resource-filter-toolbar-types.log, productionbuildpass tmp/resource-filter-toolbar-build.log,13HTTPpass tmp/resource-filter-toolbar-http.log. Browser artifacts/resource-filter-toolbar-qa: charticon32, controls32samey257.96, openouter noPanelCard, ground/industrial/tower AND180sites/badge3, globals1080/5400/3902, draftnonavigation,cancel/reopen, list/cardpreservefilters, reset1080.390doc390, tools342/398internalonly, popoverx0w384right384; consoleerrors[]. Screenshots final-843/filter-843/cards-843/filter-390 pluschecks.json. Defaultviewport/light/province/originalsnapshot/operators/viewsites/list/page1 restored, existingtab4deliverable; tab5and7untouched. CUAcompletion_summary sentonce.

Web63333PID7800previewon/OIDCoff, worker25668untouched. T01-T08remainCLOSED8/8. Originalsnapshot local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba/history/unrelateddirtyfilespreserved; noDDL/commit/push/deploy. Sourceintegrations remainpending.

### Resource explicit Phosphor icons (2026-11-11)

User requests CellTowerIcon for resource baseline, then three analysis-row icons neutral. Implemented resource heading48/launcher20 CellTower (existingtowercategoryalreadyusesit); analysisrow32 ChartPieSliceIcon composition,CityIcon regions,MapPinAreaIcon sites, text-muted-foreground. PageHeading optionaliconVisual preserves defaultViewHeader/DOM; SiteAnalysisWorkspace headingIconVisual passthrough; SnapshotControls optionalanalysisIcon defaultunchanged. Formal resource no-source heading uses SSR CellTower. NoDSdictionarymutation/newdependency/renames/businesschanges.

Typespass tmp/resource-celltower-types.log; firstbuildpass tmp/resource-celltower-build.log; finalbuild+typespass tmp/resource-section-icons-build.log. Browser heading48/launcher20/analysis32, neutraloklch(0.556 0 0),all3views verified/errors[]. Evidence artifacts/resource-section-icons-qa/{composition,regions,sites,launcher,final}.png. A launcher-dismiss/nextnav race returneddefaultcomposition; freshAX then explicit navscope restoredsites. Finaltab4province/originalsnapshot/sites/list withdefaulttowerresourceView, nooverrides; tab5/tab7unchanged. CUAcompletion_summary sentonce. Web63333PID22800previewon/OIDCoff, worker25668untouched;T01-T08CLOSED8/8, originalsnapshot1080/5400/3902/history preserved. NoDDL/commit/push/deploy.

### Resource station details use page scrolling (2026-11-11)

User wants page scroll with fixedglobalheader. Resources fillViewport now onlycomposition/regions; sites naturaldocumentheight. Shared open records in nonfillworkspace have stickycompacttools top0/DSstickyz/background; title/nav/snapshot scroll away, pagination in normalflow. Tablefullheight, DSinner retains horizontalonlyoverflow (noverticalcontentoverflow). OpenTable minwidth1024 retained outsidefill. Page/size changes use guardedref+effect toscroll recordstart withDSscrollmargin; defaults otherpages unchanged. PRD120 oldinnerlistscroll statements replaced; implementation286 appended.

Productionbuild+typespass tmp/resource-page-scroll-build.log;13HTTPpass tmp/resource-page-scroll-http.log. Evidence artifacts/resource-page-scroll-qa/checks.json + top-843/scrolled-843/sticky-filter-843/scrolled-390.png:843root791/1979, table1585/1585, DSinnerheight1569/1569width746/1024; scroll871header0/48tools64/48tableScroll0. Page2first21 andfirstTop166.75, pagesize10rows10samefirstposition; cards2177/2177overflowvisible. Actualpointer stickyfilter opens belowtools withoutchangingrootscroll871 (locatorclickautoscroll couldreset tooriginalflow; nativepointerverified).390doc390, root807/2120table1585/1585header0tools56tableScroll0. Errors[]. Attempted waitForURLwithRegExp rejectedbyAPI; readcurrentDOM then verifiedcommittedpageSize10. Horizontalgesture readouterwidth only; inspectedDSinner confirms correctnativehorizontalcontainer, noverticaloverflow.

Restoreddefaultviewport/light/province/originalsnapshot/tower/sites/list/page1/size20/top; tab4deliverable, othersuntouched. CUAcompletion_summary once. Web63333PID1564previewon/OIDCoff, worker25668untouched. T01-T08CLOSED8/8; originalsnapshot/history/dirtyfilespreserved; noDDL/commit/push/deploy.

### Resource section row composition (2026-11-11)

Latestuser: lefticon/secondarytitle/resourcecounts withbreathingroom; snapshotright. Implemented resource-operation-row flexwrap, contextheading32neutral+DSheading2+summary, snapshotmarginleftauto noicon. resourceViews constant reusesnav/titlelabels. Removed resource-operation-scroll overflow/maxcontent. SnapshotControls analysisIcon null explicitlyhides; undefined preservesdefault. DS24gap title-counts, existingcountseparators. <=40remcontainer contextdisplaycontents/reorder: heading+timefirstline, countsspanfullwidthsecond withDSbody-small, extreme narrowwrapnatural. Otherpagecontrols/defaults/queries unchanged; prior pagescroll remains.

Initialbuildtypespass tmp/resource-section-row-build.log;13HTTPpass tmp/resource-section-row-http.log. Initial390row158.19/summary2lines reviewed and tightened; finalbuildtypespass tmp/resource-section-row-final-build.log. Browser843row48headingx48.45/countsx178.45/timeRight794.89, controls32samey185.96steps32square; 3viewheadings/icons verified.390doc390/row342scroll342/height88, counts1line,title+timefirstline. Consoleerrors[]. Evidence artifacts/resource-section-row-qa/{final-843,composition-843,regions-843,regions-390}.png +checks.json. getByRolelevel option unsupported/ignored; corrected exactheadingname afterstrictmodeerror; noUIissue. CUAcompletion_summary once.

Restoreddefault843/light/province/originalsnapshot/tower/sites/list/page1/20/top, tab4deliverable,othertabsuntouched. Web63333PID10800previewon/OIDCoff, worker25668untouched;T01-T08CLOSED8/8, snapshots/history/unrelateddirtyfilespreserved; noDDL/commit/push/deploy.

### Launcher three tiers with promoted report centre (2026-11-11)

User exact grouping: topoverview/network, middleservices/evidence/judgment, bottomresources/reports; dasheddividers; pendingretained. launcher.tsx reuseddestination renderer and DSButton/Separator, samedescriptions/icons/width; groups share3desktoptracks/2mobilecolumns. Reportentry derivedexistingportalLauncherEntries, path/reports+regionLink (noforeignsnapshotquery), promoted fromlegacytools toavoidduplicate. PrimaryLauncherPage includes /reports andchildren fordefaultpendingcollapse; currentlinkhighlightworks. Legacydetails/linkscapabilities preserved, backendunchanged. No newcorepage/batch;T01-T08CLOSED8/8.

Typecheck+productionbuildpass tmp/launcher-three-tiers-types.log,tmp/launcher-three-tiers-build.log;7existingnavigation/migrationtestspass tmp/launcher-three-tiers-navigation.log. Browser groups2/3/2 exactorder,dashedseparators, realreportsopened/highlighted/1reportlink, pendingexpanded11oldlinks plusplanneditems, pendingcollapsedonreports.390doc390panel390x403.67/2columns, Escapeariaexpandedfalse/restoresfocusbusinesslauncher. Immediateinitialscreenshothitanimationphase; finalstableimageoverwritten. Errors[]. Evidence artifacts/launcher-three-tiers-qa/{final-843.png,mobile-390.png,checks.json};docs50currentsectionreplaced/PRD120appended/implementation291appended.

Finaldefault843/light/originalprovince snapshot/sites/page1/20/tower, launcheropenpendingcollapsed,tab4deliverable; othersuntouched. CUAcompletion_summary once. Web63333PID22332previewon/OIDCoff,worker25668untouched;originalsnapshots/reporthistory/unrelateddirtyfilespreserved,noDDL/commit/push/deploy.

### Service quantification three-page refinement (2026-11-11)

User approved independent secondary pages, full workspace and common platform frame, then requested visible implementation. Services now has independent operators/composition/periods navigation beneath timestamp/help, neutral analysis heading/counts left and actual snapshot controls right. Operators matrix plus regional grouped columns; composition catalogue plus operator distribution; real-period chart/table plus optional comparable regional differences. Detail search/ownership/paging moved into drawers, version/source trace preserved. City drills only to county; category aligns metric; historical interval retains compatible metric. Added scoped regional totals/deltas, baseline-only withdrawn services, no cross-unit totals or unsafe plotting. No-source snapshot remains pending, never substitutes resources/communications. Scoped CSS only, existing DS15 primitives/dependencies; TS/TSX ASCII. Mobile actions below card headings, fitted empty states; drawer inert while loading.

21 model tests and 11 HTTP tests passed (tmp/service-refinement-delivery-model.log, tmp/service-refinement-delivery-http.log); final production build/types passed tmp/service-refinement-screen-fit-build.log. Browser13groups pass artifacts/service-refinement-qa/checks.json: scoped drawer/paging/search/reset, version trace, county drill, category alignment, real periods/deltas, legend recovery/help, light/dark/narrow/full workspace. Actual843 three bodies top249.96/height589.38;390 no outer horizontal overflow. Latest screenshot final-843.png. Current actual page reload errors[]. Old localhost fixture tab had restart-time prefetch error, closed after checks; fixture data not inserted into user snapshot.

PRD120 and implementation287 section5 updated. Final tab4 actual service operators/province/all operators/original snapshot local-resources-89bc0569-f89a-4e1f-ab70-d6ad1adee1ba, default843/light/viewport reset; other user tabs untouched, temporary QA tab closed. CUA completion_summary once. Web63333PID4716 previewon/OIDCoff, worker25668 untouched. T01-T08 remain CLOSED8/8; original snapshots/report history/unrelated dirty files preserved; noDDL/commit/push/deploy. Formal service source still pending.

### Service matrix follows existing list cells (2026-11-11)

User criticized matrix layout and requested reference to existing lists/tables. Services workspace reuses DataTable/TableTitleCell like sites and usage-review: service icon/title/auxiliary metric or spec; equal operator columns with centered brands/data. Removed service-wide compressed td padding; DS default rows restored. Pending matrix replaces20repeated status strings with dash and single explanation, four candidate categories retain hints. Natural-height pending operators workspace prevents short inner vertical scroll and reserves288px regional panel; normal page scroll at843, wide side-by-side preserved. TS/TSX ASCII, no new primitives/dependencies/globalDS mutation. PRD120 and implementation287 section5.1 updated.

Final production build/types pass tmp/service-matrix-alignment-final-build.log;11HTTP pass tmp/service-matrix-alignment-final-http.log. Updated obsolete matrix CSS assertion; initial old-status-text test failed, restored original status phrase and final allpass. Browser843 matrix347/347, operator widths92.63equal;390outer390, inner277/624, height346/346. Existing isolated localhost fixture verified metric title switches Capacity and2.5kW numeric cell opens1matching record; no user data injection. Actual page consoleerrors[]. Evidence artifacts/service-matrix-alignment-qa/{final-843.png,mobile-390.png,checks.json}. Temporary tab10closed; user tab9 marked deliverable, original snapshot/province/all operators/light/default843 restored, other tabs unchanged. CUAcompletion_summary once. Web63333PID26408,worker25668untouched;T01-T08CLOSED8/8, originals/history/unrelateddirtyfilespreserved; noDDL/commit/push/deploy.

### Operators page reduced to a single matrix (2026-11-11)

User: why two panels, Header already switches region. Removed operators regionPanel/regional chart and back-city action; operators is now one full-width/full-height matrix at every desktop breakpoint. Removed previous pending-source autoheight/minheight/two-card overrides. Matrix remains scoped by Header city/county; service title now opens that metric's list, operator quantity opens scoped list. Composition/periods/model regions/history preserved. PRD120 and implementation287 section5.2 updated.

Build/types pass tmp/service-operators-single-panel-build.log;11existingHTTPpass tmp/service-operators-single-panel-http.log. Browser843 onepanel exactbody746.44x589.38/matrix450/450;390outer390/onepanel/fourrows. Actual Header selection Xi'an/allcity changes physical1080to240, restoredprovince1080. Existing localhost isolated fixture Capacitytitle opens matching1row2.5kW; nofixture injection. Currentconsoleerrors[]. Evidence artifacts/service-operators-single-panel-qa/{final-843.png,mobile-390.png,checks.json}. Temporarytab11closed, usertab9deliverable/originalsnapshot/allprovince/alloperators/light/defaultviewport; othersuntouched. CUAcompletion_summaryonce. Web63333PID5488,worker25668untouched. T01-T08CLOSED8/8,noDDL/commit/push/deploy; originalsnapshots/reporthistory/unrelateddirtyfilespreserved.

### Deliverable and measurable service catalogue (2026-11-11)

User rejected four broad categories and requested resource correspondence then explicit measurable/deliverable completion. Added domains/tower-service/delivery-catalog.ts: pure candidate8groups/25subitems, resource/unit/stock-or-usage/definition/evidence/resourcePending. Mounting1, space5, supply4, backup3, facilities4, metering1, indoor3, transport4. Mountheight and promisedbackupduration stay specs. Meterpoint counts support evidence, not automatic standalone billing. Sharedresources require explicitcustomerallocation, no equipment-as-service counts or cross-unit sums. Missing room/cabinet/site/generator/grounding/lightning/indoor/transport resource categories markedpending. Catalog is presentation baseline only, never mutates captured metrics/snapshots/rules or manufacturesquantities.

Operators pendingmatrix and composition pendingcatalogue share25rows; service/unit title and group/resource auxiliary line, DSsurfaceTooltip on hover/keyboardfocus for concise definition/evidence/pendingresource. Actual captures retain allfrozenmetrics unchanged. Singlepanel/globalHeaderregions retained. Matrix scroll now uses DSinner nativecontainer, stickythead; mobile naturalpageheight/horizontaltableonly. TS/TSXASCII, no dependencies/primitives/DDL. PRD120 and implementation287 section5.3 updated.

Types/buildpass tmp/service-deliverables-types.log,tmp/service-deliverables-build.log;11HTTPpass tmp/service-deliverables-http.log. Browser25rowsbothviews,843outer843/onepanel/inner450x1954, stickythead y357.08 afterscroll1504.67;390outer390/inner277x624,height1954/1954. KeyboardTabbandwidthtooltip definition/evidence/pendingresources, Escapeclear, first/lastreachable; consoleerrors[]. Clickclosedtooltip byDSbehavior; correctedkeyboardfocus, transient2tooltips matched via instant-open. Evidence artifacts/service-deliverables-qa/{final-843.png,transmission-tooltip-843.png,composition-843.png,mobile-390.png,checks.json}. Restoredtab9deliverable/operatorview/province/alloperators/originalsnapshot/light/default843/top; othertabsuntouched,CUAcompletion_summaryonce. Web63333PID27008/worker25668untouched. T01-T08CLOSED8/8, originalsnapshots/reporthistory/dirtyfilespreserved,noDDL/commit/push/deploy; formalservicedata pending.

### Summary typography follows shared resource component (2026-11-11)

User flagged services summary12px vs resource14px. Replaced handbuilt status spans with existing AnalysisSummary (same as resources), sharedmetricbody14px/22.1px/400 and strongnumber700; note remains componentbody-small, separators retained. All3serviceviews common, narrow CSS mirrorsresourcebody-smalltoken at40rem. No data/query changes. Build/typespass tmp/service-summary-unified-build.log. Browser actualresource/service family,size,line,weights exactmatch;composition/periods14px;errors[]. Evidence artifacts/service-summary-unified-qa/final-843.png/checks.json. Attemptedviewport390 appliedreference tab7 rather thanservice9; reset, no service narrow measurementclaim in finalchecks. Earlylocator.evaluate timedout, usedDOMread. No newtests forstyling. PRD120/implementation287section5.4updated. Web63333PID7704/worker25668untouched;tab9deliverable/operators/originalprovince/light/default843;reference7URLunchanged. CUAcompletion_summaryonce, T01-T08CLOSED8/8, noDDL/commit/push/deploy/historychanges.

### Service period trends and operator comparisons (2026-11-12)

User approved period design and requested implementation. Services periods now uses operator line series above and open DS SectionHeader/DataTable below: baseline/current/delta/rate. No separate regional difference board or period list on this page; underlying regional model and composition view retained. Shared heading/AnalysisSummary, actual snapshots, Header regions, metric/operator controls. comparisonMode previous/year/custom/none in URL; entering from another secondary view defaults previous. Automatic previous requires adjacent complete comparable business interval; year matches actual prior-year bounds, no older-sync fallback. Per-operator raw values, BigInt differences/basispoint rates, missing null not zero, zero baseline cannot compute %, revision not business growth, mismatched scale/spec hides wrong-basis old values. Trend points preserve operator scope, null separators for missing intervals, DS legend/line/dashed pointer/exact tooltip/keyboard; click period updates full snapshot. Baseline amount switches to baseline snapshot and opens existing service list via guarded listTarget effect. Source traces unchanged. No fabricated service history.

26 model tests pass tmp/service-periods-model.log,11 HTTP pass tmp/service-periods-delivery-http.log, final CSS height/types/build pass tmp/service-periods-height-build.log. First HTTP had prior shared-summary accessible-name whitespace mismatch, corrected obsolete assertion. Browser scoped other/Xi'an October49/September27/delta22/rate81.48%, Home/Enter updates cutoff+summary+table, baseline27 opens sep24record list, legend recovery, navigation previous default verified. 390 actual width390/outer390/plot288. Final desktop1280x720 plot214.875 (min panel384, lower288); short screens scroll work area. Earlier autoheight+fr inflated SVG; removed autoheight, definite parent prevents growth; initial equalrows compressed chart removed. Artifacts service-periods-qa. User original local-resources snapshot remains pending, localhost QA stays isolated; no user-state injection. Web26184previewon/OIDCoff,worker25668untouched;T01-T08CLOSED8/8,oldpages/history/dirtyfilespreserved,noDDL/dependency/commit/push/deploy.


### Two-year synthetic history and aggregate snapshots (2026-11-12)

User approved 2-year hour/day/week/month/year demo model with rollups, not full duplicated facts. Existing partial history implementation in dirty workspace completed through history-calendar/history/history-store/history-reader, shared history-controls, six pages and resource detail; report service optional snapshot adapter freezes selected history evidence. Explicit preview only, formal access boundaries unchanged. Default month 2026-10, range [2024-11-01,2026-11-01) Beijing730days/24months; 2024/2026 natural years and boundary weeks explicitly incomplete, usage comparison null, 2025 full. Monday weeks, period-end stock, summed integer Wh usage, deduplicated coverage, ratios recomputed. Hours integer cumulative weighted shares, no stored hourly rows.

Installed via new root command pnpm seed:tower-history:1080sites/3902relations/39915sparseconfigs/2848460dailyfacts/24tenantmonths/10170month-county-operator aggregates,8654502compressedbytes. Immutable base+version bundle and summaries-v1 with hashes/exclusive publication, installation integrity600monthlymetric reconciliations pass; existing bundle digest f6dc7517d23657fded6b805a759664b08d4c12d0340ed889451693eaa6ed3b7e unchanged. Read-only pages do not auto-install. Original snapshot/reports retained; history DEMO and annual agreements/rules traced, broadcast/other metering rules pending. Seed log tmp/two-year-history-install.log.

Fixed raw hourly coverage fractional day bounds; month tenancy only enabled sites as-of and independent of outer period; period switch preserves same-history metric; stock detail rows use end-effective configs. Shared controls retain compact/wrap/region behavior, leading analysis icon positioned using existing datetime class; old snapshot lists label synthetic entries. Trend axis has short grain labels, tooltip retains full dates and line labels auto-fit horizontally. PRD120/implementation287section5.6 updated. No new tests or test suites run this continuation; production compilation/types pass tmp/two-year-history-delivery-build.log.

Browser actual user tab9 shows monthly 24period series supplied-energy, October8800277.018kWh vs September9501765.735kWh; observed hour10752.275, day283814.034, crossmonthweek2085062.686 preserving metric, 2026year explicit incomplete/no growth. Final monthly default province/light843 restored, screenshot artifacts/two-year-history/periods.png, marked deliverable and CUAcompletion once. Other tabs untouched. Web63333PID22444 previewon/OIDCoff; worker25668 never stopped. T01-T08remain8/8; noDDL/deps/commit/push/deploy.

### Service collapsed summaries and grouped trend (2026-11-12)

Latest follow-up: comparison operator identities must suit large panel, not tiny inline tablemarks. periods.tsx uses existing OperatorLogo size large (same customer-use/resources) plus OperatorName in DS text-heading-2/font-medium/gap-sm, first column20%. Scope is comparison only; shared identity/logo/default table styles unchanged. Build log tmp/service-comparison-identity-build.log.

Latest user overrides stacked usage charts: use grouped bars by period/operator like resources, retain stock step lines. Matrix collapsed category shows explicit representative metric name/unit and operator quantities; expanded category has empty numeric cells and complete subitems. Explicit representatives in services/matrix.tsx, never mixed-unit category totals. Browser confirmed8collapsed categories and expanded first category fiveblank numeric cells plus onechild, day31groups with5parallel bars.

Comparison now same full-height DS PanelCard as matrix/trend, shared header actions/padding; baseline/current dates in columnheads, removed detached periodline. Exact clickable quantities supplemented by DS Progress using one maximum acrossbothperiods/operators, neutralbaseline/currentoperatorcolors; no automatic red/green business judgments. Normal status shortened to metric/unit, incomparable/incomplete explanations retained. Loading/nav/source scope unaffected. Typecheck/build pass initial tmp/service-collapsed-grouped-comparison-build.log; final polish build tmp/service-collapsed-grouped-comparison-final-build.log. No tests added/run, noDDL/deps/commit/push/deploy. Worker25668unchanged, other usertabs untouched;T01-T08remain8/8. PRD120 and implementation287 updated.

### Occupancy change topic (2026-11-13)

User approved next focused analysis topic and implementation. Added judgment view=occupancy with secondary navigation alongside energy/sharing. Reused published DS panels/table/segmented controls/operator identities/ActionMenu/Drawer/CSV, blue-neutral palette, Header-only region scope, no site/device lists. Full-width grouped added/removed bars + net line; switch endpoint-size line. Lower composition1/3 and customer2/3; mobile stacked. Summary32px, loading capsule and inert click lock, action32/icon20. Extracted AnalysisPeriodControls used by both occupancy/sharing; mobile time tools wrap without clipping calendar/quarter. Customer CSV uses Chinese catalog labels and carries baseline/current source/time/region.

New pure occupancyAnalysis compares deduplicated concrete-customer+site endpoint sets, unit household-site; added-removed=net=current-baseline, customer and lifecycle components reconcile. Monthly12/quarter8/year3 windows use exact preceding-period-end baseline, never sum monthly churn or fallback to older missing month. Partial current year/quarter uses actual last monthly observation. Missing/restricted/version/scope/identity/revision remain unknown; formal captures union known regional physical sites and require lifecycle evidence so omitted older sites do not become fabricated exits. History uses lightweight monthly tenancy projection, not hourly facts. Legacy pages/launcher and existing history/snapshots preserved.

19 domain/model/shared regression tests passed tmp/occupancy-model-tests.log;14 HTTP tests passed tmp/occupancy-http.log (route/formal access/query/region/read-only and report security/history). Initial and final application builds/types passed tmp/occupancy-final-build.log; mobile refinements build tracked separately. Reference monthly Oct2026 current3808,baseline3791,added17/removed0/net17. Annual2026 throughOct31 baseline3685,current3808,added212/removed89/net123;addedExisting23/newSites189,removedExisting89/retired0. Xi'an843/+38/-20/net18;Yanta55/+0/-3/net-3. Earliest2024 known2923,missing2023baseline => changes null. Source tenants2026-10 vs2025-12. No source fact/contract mutation, DDL, deps, commit/push/deploy.

Delivery closure: final build/types passed tmp/occupancy-delivery-build.log after mobile fixes. Final browser887 monthly row32px, width787=scroll787;1363 yearly all4metrics and1:2 lower cards;390 final document390=scroll390, lower cardsstack, table local277/416 preserving readable identities/headers. Added position:relative on table scroll boundary so absolute accessibility labels do not escape; mobile analysis context wraps long annual summary. Calendar/quarter controls32px and full quarter label confirmed. Shared quarter regression row32px, width1220=scroll1220. Final Chinese CSV D:/Downloads/occupancy-change (1).csv verified17columns/5customer rows and correct sources, year baseline and values; signs escaped for spreadsheet safety. Runtime errors[]. Screenshot proof tmp/occupancy-final.png (887 monthly trend),tmp/occupancy-annual-final.png (1363 annual lower cards),tmp/occupancy-mobile-table-final.png. Final tab1 delivered with province/alloperators/latestOct2026/month/occupancy/light, viewport override reset; other tabs untouched. CUA completion_summary once. Web63333 wrapperPID23060 previewon/OIDCoff; prior implementation wrapper processes replaced only. Existing worker/other processes preserved, no commits/push/deploy.

### Panorama points to full-canvas map; region distribution is pending (2026-11-13)

User corrected navigation intent: previous tower-service/network is a regional statistics view, rename it and place under pending migration; panorama is map mode and should associate the existing station map. Primary network target now /product-preview?hour=18 labeled panorama; retains map new-tab/noopener behavior. towerLegacyNavigation registers original /tower-service/network as regional distribution, rendered under launcher legacy overview group with current-page highlight and expanded legacy section. No duplicate map in pending UI. Existing regional page titles (including formal source pending) changed; original route/model/layers/snapshots retained. Overview panorama shortcut also opens full map. Compatibility helper carries city/county/operator only to map, no A/B snapshots/local filters; all other destination query rules unchanged. Map/return-link navigation terminology aligned. No new map implementation or authorization changes.

22 navigation/migration/dashboard model tests pass tmp/network-entry-tests.log;9 dashboard HTTP tests pass tmp/network-entry-http.log; production build/types pass tmp/network-entry-build.log. First HTTP run revealed older tests implicitly relied on pre-history default snapshot/source gaps; changed those gap assertions to explicit original resource snapshot, retained exact unknown expectations. Browser verified primary map once, regional distribution under pending and aria-current page, old page actual resource1080/city polygons/layer controls, main click opens new full-canvas map with no selected site and compatible query. Runtime errors both pages[]. Proof tmp/network-entry-launcher.png and tmp/network-entry-map.png. User existing tab1 was already connection-error dataURL; API cannot attach that URL, so left intact and created qa tab2; actual map tab3 opened by main link. Both2/3 delivered, no viewport/theme changes. CUA completion_summary once. Web63333 wrapperPID8240 previewon/OIDCoff, prior webchild19580 replaced after build; worker/unrelated state preserved. Docs50/120 updated. No DDL/commit/push/deploy or data mutation.


### Services and evidence unified (2026-11-13)

User approved merging service quantification and metering evidence. Primary launcher now five business/two management destinations; evidence removed from visible primary navigation, historical migration target retained. Canonical /tower-service/services handles operators/periods/comparison/summary/details through existing separate services/evidence models. Shared five-button DS navigation32px, unified title/description, comparison name aligned. Legacy /tower-service/evidence307preserves query/duplicates; rules still redirects to config. Formal mode remains source-pending with no demo payload; exports/session/private/auth boundaries retained.

Quantity clicks now open evidence details with selected snapshot, region, operator and service. serviceMetric validates frozen metric then follows exact usage basisIds or configuration metric, preventing unrelated records when a metric spans multiple service items. Missing captured evidence stays empty. Validated local returnTo restores original analysis query; matrix expanded groups/list-card preference use tab session presentation state, scroll restored after paint. Export excludes returnTo and keeps metric/service/region/operator filters. Removed redundant service-record drawer; reused existing evidence detail drawers. No source/evidence/report mutation.

61model/navigation/evidence tests pass tmp/service-merge-model.log;7HTTP checks pass tmp/service-merge-http.log including all5pages, legacy/config redirects, scoped drill/export, invalid scope/duplicates/unsafe returns, read-only and formal gating. Final production build/types pass tmp/service-merge-final-build.log. Browser verified actual mounting mobile1080configuration records and supply usage drill, return keeps expanded group and scroll493.33; periods chart and comparison5rows, launcher only services/judgment middle row; active summary correct.887all5nav32px/document887,390document390 after making summary scroll boundary positioned to contain absolute sr-only labels; table local342/598. Runtimeerrors[]. Screenshot tmp/service-merge-final.png. Existingtab2delivered summary/province/latestOct2026/alloperators/light, temporaryviewportreset; othertabsuntouched. CUAcompletion_summaryonce. Web63333wrapperPID12836previewon/OIDCoff; only prior web wrappers/children replaced, unrelatedprocesses preserved. Docs50/120/130/indexupdated. NoDDL/deps/commit/push/deploy; preexistingdirtytreeandhistorypreserved.

### Monitoring moved to analysis group (2026-11-13)

User requested existing monitoring entry in analysis before services. Launcher analysis order is monitoring/services/judgment; monitoring uses original /monitoring page and waveform icon, primary current-page highlight, and is removed from pending runtime group. Links carry Header city/county only, excluding incompatible service snapshots/operator/local filters. Existing monitoring data/rules/UI unchanged. Historical migration records retained. Docs50/120 updated.

8 navigation/migration tests passed tmp/monitoring-launcher-tests.log; production build/types passed tmp/monitoring-launcher-build.log. Browser verified actual monitoring route, analysis order, aria-current page and no duplicate pending entry; console errors empty. Screenshot tmp/monitoring-launcher-final.png, tab2 delivered and CUA completion once. Web63333 wrapperPID5748 previewon/OIDCoff; unrelated processes/tabs and preexisting dirty files preserved. No data mutation/DDL/dependencies/commit/push/deploy.

### Seven business modules and original secondary functions (2026-11-13)

User fixed seven primary business modules and authorized migrating or mounting original functions wherever business ownership is clear; unresolved functions remain pending. One business-modules registry defines ownership and secondary links. Primary business entries are overview/network/monitoring/services/judgment/resources/reports (2/3/2 Launcher rows), configuration domain remains separate. Original runtime overview and situation board under overview; sites/customer-use under resources; review/case records under services; capacity/efficiency/business history plus existing findings/contribution under judgment; library/tower reports/generation/tasks under reports. Original aliases/deep links/models, history, report versions and authorization retained; no claim of rewriting old models. Original pages highlight their parent and offer the same secondary navigation. Mounted originals removed from pending UI; region distribution and data updates/aggregation plus six unbuilt plans remain pending. Map remains independent/new-tab and monitoring retains existing page.

Shared PageHeading secondary menu uses published DS Popover/ShellPanel/Button, size xl verified32px; existing local tabs/actions remain. Scope-only links to old models prevent frozen A/B/local-filter errors; report tower view explicitly preserves valid snapshot context; sharing/occupancy reuse period-end projection. Docs50/140 updated. 14 navigation/ownership/context tests passed tmp/seven-modules-tests.log;7 existing merged service HTTP tests passed tmp/seven-modules-http.log including formal/read-only/export boundaries. Final production build/types passed tmp/seven-modules-final-build.log; changed new TS/TSX ASCII verified.

Browser actual capacity route opens from judgment menu and parent highlights; service menu opens records view; resources and report secondary menus verified; seven Launcher entries confirmed and pending only region/data links plus disabled plans, no mounted duplicates. First QA expected heading named analysis but actual original heading remains capacity, corrected lookup; no app error. New button measured32px after final DS size correction, runtime errors empty. Proof tmp/seven-modules-secondary-final.png and tmp/seven-modules-launcher-final.png; tab2 delivered, CUA completion once, no viewport/theme change. Web63333 wrapperPID25472 previewon/OIDCoff; only known task server wrappers/children replaced; unrelated workers/tabs and existing dirty source tree preserved. No evidence/data mutation, DDL, dependency, commit/push/deploy.

### Regional comparison migrated into judgment (2026-11-13)

User approved moving regional distribution to analysis/judgment. Reused /tower-service/network, now labeled regional comparison under judgment with fourth visible AnalysisNavigation link and More functions entry. Removed pending Launcher regional entry and obsolete towerLegacyNavigation export. Seven primary modules and independent panorama remain. Region page uses shared analysis heading/navigation and Header-only region selector; existing resources/services/sharing layers, frozen A/B comparison, polygons, table, drawer and region/topic drills retained. Compatible snapshot/operator/region context preserved, local selectors cleared when crossing topics. Formal no-source heading follows new ownership. No model rewrite or source mutation.

29 navigation/migration/dashboard/sharing model tests passed tmp/regional-comparison-model.log; 9 existing HTTP tests passed tmp/regional-comparison-http.log, including formal gating, geometry/drills, A/B, forged queries and original routes. Production build/types passed tmp/regional-comparison-build.log. Browser verified four secondary buttons32px, regional aria-current page, More functions entry, Launcher judgment selected and seven primary entries, pending only plans/data tools with no regional duplicate. Map province1080/10cities, Xi'an240/13counties and return preserved; one Header region selector, console errors empty. Screenshot tmp/regional-comparison-final.png. Tab2 delivered/province/latest monthly/light/default viewport, other tabs untouched. CUA completion_summary once. Pending native AX button lookup required visible text locator because actual DOM summary is generic; no app failure.

Web63333 wrapperPID6556 previewon/OIDCoff; only known prior webchild25016/wrapper25472 replaced. Docs50/120/140/index updated. Existing history, reports, evidence, dirty files and unrelated workers preserved. No DDL/dependency/commit/push/deploy.

### Data updates promoted; business pending launcher removed (2026-11-13)

User requested data updates in third row second position and removal of now-redundant pending area. Business Launcher rows now overview/network; monitoring/services/judgment; resources/data-updates/reports. Data updates is an operational tool separate from seven business module IDs, reuses /operations/data-updates and database icon with synchronization/aggregation description. towerEntry highlights updates and aggregation paths, rejects forged prefix. Removed business pending accordion and disabled planning tiles; plans remain documented and existing pages/routes unchanged. Management Launcher untouched. Docs50/120 updated.

12 existing navigation/migration/ownership tests pass tmp/launcher-data-update-tests.log; production build/types pass tmp/launcher-data-update-build.log. Browser tab4 actual887 confirms exact 2/3/3 arrangement, one updates entry in lower middle, no business pending label; real updates page opens and entry aria-current page. Restored original services URL and launcher open, no viewport/theme override. Console errors empty. Screenshot tmp/launcher-data-update-final.png; delivered tab4, CUA completion once. First broad browser inventory timed out; focused existing-browser tab list recovered, no app error. Web63333 wrapperPID12304 previewon/OIDCoff, only prior known16492/6556 replaced. Existing snapshots/history/dirty files and unrelated workers preserved. No data mutations/DDL/dependencies/commit/push/deploy.

### Compact shared page titles and icon-only secondary menu (2026-11-13)

User requests global title layout: move timestamp/help to subtitle in place of description, bottom/right align actions, replace More text with vertical three dots. PageHeading now uses context/DataUpdateTime in ViewHeader subtitle and description fallback only without context. Shared grid keeps metadata left and one action group right, 48rem narrow stacking/right wrapping; DS gap-lg icon/text. ModuleFunctionMenu uses official icon-xl more-vertical (32square/20icon), preserves label/title and all navigation. Removed obsolete per-service/resource title overrides and unified service-navigation media rules. SiteAnalysisWorkspace note trigger always help beside timestamp; DataUpdateTime left aligned, provider/dialog behavior preserved. Docs50 and implementation790 updated.

12 navigation/ownership/migration tests passed tmp/shared-heading-layout-tests.log; 7 existing service-merge HTTP checks passed tmp/shared-heading-layout-http.log; final production build/types passed tmp/shared-heading-layout-final-build.log. No new mirrored UI tests. Browser actual887 title118.15 to75.86px,1363 same75.86; subtitle/actions bottom139.20 on service/evidence/resource/judgment, more32x32. Actual390 heading342/342 no overflow,5nav two rows/rightdots, controls32. Verified service help Drawer and More links, evidence summary layout, resources and energy, original capacity and reports, runtime overview DataUpdateTime opens existing read-only availability dialog. No console errors. Final actual services originalURL, default887 viewport/light restored, tab4 delivered, CUA completion once. Screenshot tmp/shared-heading-layout-desktop.png (1363) and tmp/shared-heading-layout-final.png (887).

Web63333 finalwrapperPID27096 previewon/OIDCoff. Only known task web wrappers/children replaced, unrelated processes/history/evidence/reports/source dirty edits preserved. New TS/TSX changes remain ASCII. No data mutation/DDL/dependency/commit/push/deploy.

### Remove title explanation icons and drawers (2026-11-13)

User explicitly removed page-title measurement explanation icons and corresponding drawers globally. Removed service quantity/evidence and energy/sharing/occupancy/findings notes triggers, drawer contents, state and unused imports. Shared SiteAnalysisWorkspace no longer supports notes drawer/heading flags; resource baseline suppresses notes and deletes its notes body. Legacy inline notes on original analysis pages remain. Actual customer allocation/sharing/occupancy, finding, evidence/rule and resource details remain; Header help and data availability dialog unchanged. Fixed findings empty-state guidance so it no longer points to deleted notes. Docs50/790 updated; all eight changed TSX files remain ASCII.

Production build/types pass tmp/remove-heading-help-final-build.log. Seven merged-service HTTP tests pass tmp/remove-heading-help-http.log; first combined invocation omitted tsx loader for judgment and failed to load TS parameter properties, corrected invocation passes all14 judgment tests tmp/remove-heading-help-judgment-http.log. Those existing tests use isolated fixtures/report history; user source data unchanged. No new mirrored tests.

Browser tab4 verifies energy/sharing/occupancy/services/evidence summary/details/resource/findings title timestamp retained with zero explanation buttons; resource removed notes are absent inline. Actual mobile energy allocation drawer opens with its amounts/basis and closes. Console errors empty. Screenshot tmp/remove-heading-help-final.png, delivered original judgment URL/province/light/default viewport. CUA completion once. Web63333 finalwrapperPID7868 previewon/OIDCoff, known prior task servers replaced only. No DDL/dependency/commit/push/deploy; unrelated processes and preexisting dirty source preserved.

### Shared secondary headings and operation rows (2026-11-13)

User requests global consistent secondary headings and operation rows, preferring published DS. Added portal/section-heading.tsx composition of DS SectionHeader level2 and existing custom icon slot; migrated 12 hand-written business/configuration/category h2 headings. PanelCard retains official level3 header. Shared portal/operation-row.css centralizes 32px control/track height, semantic spacing, context wrapping, summary separators, snapshot controls, table tools, page navigation and PanelCard actions. No custom typography primitives or global token overrides. Removed redundant geometry from service/evidence/judgment/resource/sharing styles. SnapshotControls now uses control-group instead of nested action-row, eliminating repeated padding that made annual energy48px. Keep DS radio group inset and all state/hover/business logic. Scroll boundaries positioned to contain absolute accessible labels in evidence/energy/sharing tables; local horizontal scrolling retained. Docs50/790 updated.

Existing service/judgment/dashboard HTTP regression30/30 pass tmp/operation-row-unification-http.log; final production build/types pass tmp/operation-row-unification-final-build.log. 14 modified/new TSX ASCII and syntax checked. Relevant git diff whitespace check passes with existing CRLF warnings only. No new mirrored UI tests.

Browser1363 verifies energy/sharing/occupancy/resources/service/monitoring/reports single-track operation rows32px and navigation32px. Browser390 evidence details and energy clientWidth=scrollWidth390, controls32; energy customer table277px local width with648px scroll content. At default887 energy wraps into74px two-track operation region, every control32px, document887/887. Actual chart renders and console errors empty. Restored original annual energy URL, default viewport/light, tab4 delivered; screenshot tmp/operation-row-unification-final.png; CUA completion once. Final web63333 wrapperPID6556, previewon/OIDCoff, logs tmp/operation-row-unification-final-server{,-error}.log. Only known task wrapper13488 and Nextchild4564 replaced at final restart. Unrelated processes and preexisting dirty tree preserved. No evidence/data mutation, DDL, dependency, commit/push/deploy.

### Compact overview filters and global period reset (2026-11-13)

User requests removing overview duplicate region, one-row wide overview statistics/operations, collapsed operator filtering and missing period reset globally. Overview now shared action-row with left statistics and right compact SnapshotControls; showRegion=false leaves Header as sole region selector. Operator and baseline conditions use existing FilterButton plus DS Popover draft/apply, applied count, neutral background; final panel widthmd224px, triggers explicitly32px. Other snapshot consumers retain existing inline filters.

HistoryControls, non-history SnapshotControls and sharing/occupancy AnalysisPeriodControls use shared32px outline ResetButton after period steps. New pure period-reset selects frozen latest same-grain history period or latest authorized non-history capture/revision; preserves business/region filters and clears explicit baseline. History no-op reset checks href to avoid sticky lock, but allows clearing baseline even at latest period. Existing SiteAnalysisWorkspace/customer controls already have reset; original BusinessWorkspace now resets day/hour18 and filters, preserving region; history-analysis reset also restores12m window. Map independent UI unchanged. No DS/token changes.

2 period-reset rule tests pass tmp/period-reset-tests.log; existing dashboard/service/judgment HTTP30/30 pass tmp/overview-compact-http.log; final production build/types pass tmp/overview-compact-final-build.log. All8 changed/new TS/TSX ASCII, relevant diff whitespace checks pass. Browser1363 overview row32px bothgroups32, one regiontrigger, reset32square. Actual operator apply/count and baseline apply/reset work; year2025 reset returns2026 preservingoperator; service Sep reset Oct2026 retainsXi'an/mobile; sharing quarter2025 reset latestquarter2026 retainsregion/grain.390 document390/390, panel224/224, all4panelcontrols32. Consoleerrors[]. First annual page navigation exceeded20s but actual page completed; baseline apply wait also exceededshortdeadline then visibleDOMconfirmed. No app failures.

Final screenshot tmp/overview-compact-final.png at1363; tab4 delivered original annualoverview/province/alloperators/light, viewportresetdefault, CUAcompletiononce. Web63333wrapperPID21812 previewon/OIDCoff, tmp/overview-compact-server{,-error}.log. Only known taskservers6556/19168 then17388/22172 replaced; unrelatedprocesses/dirtytree/history preserved. Docs50/790updated. No source-data mutations/DDL/dependencies/commit/push/deploy.

### Global PageHeading actions include mounted original pages (2026-11-13)

User reports inconsistent page actions on /analysis and migrated independent headings. Existing PageHeading was shared, but mixed DS default/sm/xl/icon-md props left font, padding and radius inconsistent; old height normalization only covered site-analysis-page. Moved action geometry to global PageHeading action/navigation slots using official DS data-slot/data-size:32px controls,14px body,16px inline padding, DS radius/spacing; icon buttons32square/20icon. Preserve variants, hover, focus, disabled and navigation state. Subtitle time remains compact. DataUpdateButton explicitly xl; removed redundant operation-row/service-navigation height declarations. Grid action track can shrink and action groups wrap/right align; original business titles/routes retained.

Production build/types pass tmp/heading-actions-global-build.log; existing navigation/ownership12 and merged-service HTTP7 pass tmp/heading-actions-global-{navigation,http}.log. Browser verified analysis/capacity/efficiency/board/runtime overview/reports/services/operator configuration; measured action32/font14/padding16/icon32/20.390 analysis/board/reports/services and1363 analysis no document or heading overflow. Actual More to capacity and update availability dialog open/status/close verified; runtime errors empty. Initial capacity QA expected old title, fresh DOM confirmed actual heading; no app failure. Browser metrics tmp/heading-actions-global-browser.json; screenshot tmp/heading-actions-global-final.png. Original /analysis?city=all&county=all restored, temporary viewport reset, tab4 delivered, CUA completion once.

Local63333 wrapperPID16244 previewon/OIDCoff; replaced only verified known wrapper21812 and Next child100. Server logs tmp/heading-actions-global-server{,-error}.log. Specs50/implementation790 updated. Preexisting dirty tree, unrelated workers/history/source data preserved. No new mirrored layout tests, DDL/dependencies/commit/push/deploy.

### Shared table tools, square pagination and joined view switch (2026-11-13)

User requests energy period inside first card upper-right, global table operation improvements, square pagination and joined view controls. Added globally loaded portal/table-tools.css: left presentation/facets, right search/query/reset/export,32px controls, semantic spacing and DS geometry; search224px. Whole controls wrap on narrow widths rather than scrolling entire action strip. Removed obsolete single-line/view/pagination geometry from site-analysis and operation-row. Keep business filters, reset, primary export and active filter text semantics. Existing service/evidence/sites/monitoring/reports/config composition uses same rules.

Official ViewModeSwitch lacks icon slot; shared portal/view-mode-switch.tsx composes official ToggleGroup/Item and same-source ListBulletsIcon, preserving list/cards callbacks, radio keyboard/focus and disabled reasons. All5 direct usages migrated.64x32 root,32square children,0gap,20icon,only outside corners rounded and extremely faint outline. Pagination remains official component/page-window/handlers; all buttons including page size32square, page gap space-2xs. Global grid count left/size+pages right; narrow size+count first/page row second; even narrower card pages wrap whole controls. Original BusinessWorkspace pagination gains common class. Energy period/status moved to first PanelCard action; narrow action occupies own header row to prevent title collapse, no outside period line.

App typecheck and final production build/types pass tmp/table-tools-typecheck.log and tmp/table-tools-global-final-build.log; existing merge/judgment HTTP21/21 pass tmp/table-tools-global-http.log. An initial automated pagination class insertion duplicated a later class in SiteAnalysisWorkspace; typecheck caught it, removed duplicate before successful builds. First mobile browser check exposed DS card action squeezing title to0width; narrow grid placement corrected and rebuilt. No new mirrored layout tests.

Browser1363 confirms toolbar32/search224/view64x32/gap0/20icon/inside corners0/pagination everybutton32square.390 energy title232px/period insidecard, details pagination74px2rows/document390; sites/monitoring/reports/config no document overflow and all pagination square,309px card pages naturally3rows. Actual next page2, cards/list, compound configuration filter and matching export URL verified. Consoleerrors[]. Proof tmp/table-tools-global-{desktop,pagination,energy,final}.png and audit tmp/table-tools-global-browser.json. Restored original services?city=all&county=all/list/defaultviewport/light; tab4 delivered; CUAcompletiononce. Harmless body Control+Home unsupported in UI check; DOM confirmed windowY0/headerTop0; no app error.

Local63333 finalwrapperPID13568 previewon/OIDCoff logs tmp/table-tools-global-final-server{,-error}.log; only verified prior wrappers16244/22876 and children324/13860 replaced. Docs50/790 updated. Existing dirty tree/source evidence/history/unrelated workers preserved. No dependencies/DDL/data mutation/commit/push/deploy.


### Regional comparison compact toolbar and explicit audit scope (2026-11-13)

User caught missed /tower-service/network wide two-row toolbar and demanded actual checked-page list. Missing compact made SnapshotControls inherit width100%, forcing74px even1363. Reused compact+filtersCollapsed from overview, no new primitive/CSS/token override. Shared collapsed filter panel aria-label generalized to analysis filters. Browser1363 and887 now32px single row,390 wraps with32px controls.

Actual registry audit28 business views + independent map at1363/887/390 =87 records. All default documents match viewport width, all measured toolbar controls32. Precise named paths/heights and exceptions tmp/regional-toolbar-checklist.md; JSON tmp/regional-toolbar-audit.json. Twenty-two normal business toolbar views32px wide; original analysis64px (region path then summary/conditions) and customer-use74px (mode navigation then conditions) retained distinct sections, explicitly not counted single-row passed. Runtime overview, board, sites and data-updates have no matching snapshot toolbar; only page presentation/width checked. Independent map outer width checked, not full map engine acceptance. Configuration/details and every possible filter state not covered; do not claim full-platform acceptance.

Production build/types tmp/regional-toolbar-build.log pass; existing dashboard HTTP9/9 tmp/regional-toolbar-http.log pass. Actual regional telecom+Sep baseline apply/count2/map total1048; period reset keeps telecom and clears baseline/count1; clear restores all. Console errors empty. Screenshots tmp/regional-toolbar-desktop.png and tmp/regional-toolbar-final.png. Original exact regional URL/default887/light restored, tab4 delivered, CUA completion once. Screenshot wait for select labels avoids transient hydration blanks.

Local63333 wrapper17764 previewon/OIDCoff, logs tmp/regional-toolbar-server{,-error}.log. Replaced only verified old wrapper13568/Next23428. Preexisting huge dirty tree/unrelated processes preserved. No source evidence mutation,DDL,dependency,commit,push,deploy. Docs50/790 updated. Prior global checks were samples; current checklist records actual scope and unmerged independent regions candidly.

## DS joined view control release (2026-11-14)

Released official design-ui12.5.1 and design-system15.6.1 from current main via PR142, all remote CI, same-commit dry run43580753387 and publish43581008582; registry reads confirm system15.6.1 -> ui12.5.1/tokens4.1.0. Source release SHA99916e7ad393109b8cf3b0e39e05968e29ecfafc. Full local639ui+437system tests, package checks,12mutation selftests,guardrails/packed checks,format and previewbuild pass. Five BS-MOSS views directly import DS ViewModeSwitch; product wrapper/control CSS removed. Consumer pins15.6.1, drops view-mode12.0.0 patch; retains a scoped15.6.1 sidebar compatibility patch for existing initialClosedGroups/onClosedGroupsChange and inert hidden groups, preserving official geometry. Frozen offline install/types/productionbuild and7mergeHTTP tests pass, logs tmp/ds-view-mode/released-{frozen,final-types,final-build,http}.log. Live63333 previewon/OIDCoff restarted. Prior browser origin denial respected; no new visual acceptance claimed. Consumer dirty tree/data preserved; consumer uncommitted. Old DS checkout local edits retained; release isolated fromlatestmain.


## 全页面 DS 切换器补齐（2026-11-14）

用户指出切换器遗漏，本轮按54个page.tsx及相对导入依赖核查，完整清单 docs/40-implementation/ops_bsmoss_292_ds-switch-audit.md。补齐地图周期/分析主题/报告章节/合计日均/概览贡献/绘图底图、服务板块、客户内容、旧指标移动类别以及地图独立显示开关；直接使用DS SegmentedControl/Toggle/Switch/Checkbox，移除自绘滑块、选中态和radio/data-state控件CSS覆盖。图表点、日期定位、记录选择保留数据交互语义。类型/生产构建通过，服务量化+研判HTTP21/21通过；51非动态页面+5服务视图HTTP200，3动态详情只有源码核查。浏览器原点仍被保存权限拒绝，未绕过、未做视觉验收。tmp/ds-view-mode下有机器清单及日志。63333服务新session64814，previewon/OIDCoff。大量原有dirty edits保留，未提交推送。


## worker02 第三方登录接入准备（2026-11-15）

用户指定bsmoss.ruyin.work/worker02，同步yucer最新作参考。yucer干净main已fetch+ff到f918c15，无业务编辑。用户明确third_party/sso_only，仅账号登录，不接模型能力权益S2S用量。entry/page/view/service/API实现、CoSpace套件结构与DS按钮、OIDC_CLIENT_MODE=third_party禁S2S回退，活跃账号无workspace也可登录，业务API原授权不变。域名回调/退出样本 deploy/environments/worker02-prod.*；端口空，权威Claude表已读但bsmoss未占号，不自取号。四部署workflow复用yucer tailnet action（严格known_hosts/环境secret/SSH端口）。类型/build通过、35登录测试+2HTTP+delivery/docs251通过。日志tmp/platform-entry。

CUA浏览器2 tab2 opera/product/catalog/new用户已登录superadmin。已填bsmoss/观澜·基站服务经营分析/BS-MOSS/Industry Platform/L2/third_party/provider Ruyin Studio/sso_only，运营域off、独立订阅off、Webon，域名bsmoss.ruyin.work主页https；上游/产品webhook为空。stable机密client bsmoss，callback /api/auth/oidc/callback，postlogout /，backchannel /auth/backchannel-logout参与on，scope openid profile email，PKCEon。创建草稿按钮361，需fresh AX。已向用户请求动作时确认（持久凭据签发）尚未提交，勿未经答复点。Claude tab3权威端口表原件已读，无bsmoss，占号需原件更新不能本地副本。当前表下一个L3 4070但本产品UI登记IndustryPlatform L2，不能擅用L3号。浏览器本地源拒绝仍尊重。原本地63333session64814还旧构建需最终重启，未对外部署/DDL/远端推送。

## worker02 第三方登录登记完成（2026-11-15）

用户确认提交并亲自完成TOTP。opera/product/catalog/bsmoss真实创建成功：third_party/Ruyin Studio/sso_only，产品draft；stable机密client bsmoss enabled，openid/profile/email，PKCE/SLO on，回调与域名按上述准备值。一次性secret已保存仓外当前用户专属私有目录，不输出/入库；交接框已点我已保存。成功截图tmp/platform-entry/registration-success.png。接入检查产品登记通过、客户端未有真实登录；仍错误要求模型/能力/Webhook，未扩大范围。登记JSON更新registered-not-deployed。端口原件无bsmoss，L2须owner决定，已请求用户原表登记值及worker02可用GitHub Environment/SSH Secrets位置。无部署/DDL/DNS/推送。CUA本轮completion已调用，opera tab2/Claude tab3标记handoff。

用户后续“都授权你来处理”，并明确授权向Claude原会话发送登记指令。原件已真实更新，fresh artifact AX核实bsmoss L2新行/正式及beta/worker02/域名/未部署/DB待登记，端口已填运行样本。proof tmp/platform-entry/port-registration-success.png。Claude tab3当前原会话artifact面板；github tab5组织Actions secrets页被登录拦截，已请求用户登录，用户说明确有组织Secrets/Variables。CLI只有repo/read:org等，org secrets403；yucer production SSH secrets存在但不可读出，勿提取或打印。CUA第二段completion已调用。尚未部署。

GitHub用户已登录IAB tab5并确认六项worker02组织Secret授权。均保存9仓（原8+vxture-bsmoss），密钥值未读出；proof tmp/platform-entry/github-worker02-access-success.png。组织vars tab6: ACR registry/internal host,TAILSCALE tag:promotion,VXTURE_NPM_REGISTRY，均public。Tailscale/NODE_AUTH_TOKEN/ACR secrets为public，本仓public可用。四SSH workflows补DEPLOY_WORKER02_*回退。gh创建build/prod env及IMAGE_REPOSITORY ghcr.io/vxture/bsmoss-app/prod STACK_ROOT /srv/md0/bsmoss/PROJECT_NAME bsmoss/APP_PUBLISH_PORT登记值。gitleaks145历史与当前snapshot均无泄露，全量1063tests pass。用户已明确授权空仓一次性根提交ff2d30f初始化main，feature完整交付PR，六CI后合并部署。当前feature feat/bootstrap-bsmoss仍360dirty，未commit/push。CUA本轮completion已调用。下一步发布路径继续，DB/edge/DNS/配置/真实登录未完成。

2026-11-15 bootstrap delivery: root ff2d30f initialized main under explicit one-time approval; complete delivery pushed to feat/bootstrap-bsmoss, PR #6. Latest d3ab92d security/audit/quality/db-contract/coverage passed; portal regression has two Linux-only failures, local66/66 passed. Added response/server diagnostics before further action. APP_ENV_FILE/STACK_ENV_FILE/DATABASE_ROLE_SQL are configured in prod through private files; no database initialization or deployment yet. Worker preflight, runtime-role provisioning and tailnet binding are reviewed in PR. Prior entries describing uncommitted work are historical.


## 2026-11-15 实际发布状态（替代前文准备阶段描述）

首次根提交初始化已按用户单次例外执行。完整交付 PR #6、部署修复 PR #7/#8 均在六项必需 CI 与 CodeQL 通过后合并。CI 门户缺少历史 fixture 的问题通过显式 seed:tower-history 修复，本地门户66/66通过；原全量业务1063/1063通过。

worker02 只读检查43624676814成功：专用目录未使用、正式端口空闲。app/stack配置通过prod环境Secrets下发（43626001846/43625996894）。镜像43625992131通过Trivy，运行镜像移除不需要的npm/Corepack。不可变镜像 ghcr.io/vxture/bsmoss-app@sha256:8bbe217ec7a079794eb5dfaed7cbba6af0d193ec117600eee8741bb156c87eb3。数据库首次初始化43626360843成功，vx_bsmoss_db、bsmoss_owner、非owner bsmoss_svc；不重跑初始化。

部署43627027436成功，应用容器健康与/api/ready通过；后台workers off，预览off。首次GHCR拉取因主机凭据返回denied，改为仅本次public pull使用临时空Docker config后成功，不修改共享凭据。

Cloudflare已按CoSpace新增bsmoss.ruyin.work A到worker01，DNS only/Auto；Google公共DNS确认。worker02无公网地址，仅尾网绑定。截图tmp/platform-entry/bsmoss-dns-success.png。正式域名仍未接通，真实OIDC回调/会话恢复/退出未验收，平台产品仍draft，不宣称已公网发布。

用户明确禁止修改platform代码。平台本地新增基建登记行已完整撤回，无platform tracked diff、提交或发布。运营人机验证循环已报vxture-platform/vxture-platform#677；边缘上游、既有sync-product-edge与基建登记、sso_only检查范围交由#678。平台最新main已有ruyin.work通配路由/证书域配置，仍须平台确认运行态。继续工作仅修改BS-MOSS仓，平台问题发issue。

## Map loading presentation (2026-11-15)
User reports corner text and empty map during loading. Added shared portal/map-loading component using DS Spinner, semantic tokens, centered map marker/grid and honest waiting copy; used for both dynamic module and canvas initialization in product-preview and board. Board container explicitly relative so fallback stays within map. Typecheck passed; build log tmp/map-loading-build.log. Existing local origin browser denial preserved, no visual acceptance claimed. No platform operations, commit or deployment.


### 2026-11-15 Simple product home
- Root now shows a DS-based product introduction, shared spatial motif and six business destinations; launcher and brand link return home.
- CoSpace kit defines homepage motif treatment but no complete business homepage template. Existing tower overview remains at /tower-service/overview.
- Type check and nine navigation tests passed. Local browser visual verification remains unavailable; no platform changes or deployment performed.


### 2026-11-15 Home revision
- Replaced the launcher-card homepage after inspecting the actual CoSpace home: task-oriented hero, inline resource summary, and attention sections.
- Uses scoped existing preview summaries only with explicit preview mode; formal mode displays unavailable data. Development preview runs at 127.0.0.1:63333.
- Type check passed. Browser security policy denies localhost observation; visual acceptance remains pending.


- Home proportions calibrated against observed CoSpace DOM: centered page-2xl width, 32px gutters, responsive 36-48px title, 30px metrics, 32px DS actions and reference section rhythm. Replaced spatial planes with decorative tower/service topology and reduced-motion-aware signal animation. Type check and HTTP 200 passed; localhost browser policy still prevents visual inspection.



## 2026-11-15 当前发布与一致性

BS-MOSS 正式域名已上线，PR #14 发布代码 53590e7，部署 43710782085 成功。入口页已观察欢迎行、统一卡片、透明背景和常驻说明。演示 PostgreSQL 数据集与评分在 PR #13 完成发布。当前事实及不可变镜像凭据见 docs/50-deployment/60-worker02-third-party-signin.md；以上准备阶段文字为历史，不再作为待办。平台代码与配置不改动。
