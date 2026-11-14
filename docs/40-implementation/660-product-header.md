# 产品顶栏与官方面板

对应 [设计230](../30-design/design_bsmoss_230_product-header.md)。以发布的 DS15 公共组件组装，参考 yucer 的 domain-launcher、header-tools 与 app-shell，没有复制设计系统源码。

## 交付

- 三栏 launcher 替换平面清单，真实链接、当前高亮、点击关闭、手机布局与可用空间限制。
- 新增 /assets/brand/guanlan-mark.svg，通过 ShellHeaderMark 接入原两块品牌组合。
- 右侧官方工具组：帮助、消息、配置；补官方用户面板、真实身份展示、切换／登出和外观偏好。
- 新增 /settings 配置页面，外观设置可用，指标模板与任务入口复用现有正式页面。展示目录不作为授权决策。

## 本地验证

- 540 项单测、双层类型检查、Next 生产构建、21 项 HTTP 检查通过；日志 tmp/header-{unit,types,build,http}.log。新增 HTTP 检查验证关闭预览时配置页和品牌资产可访问，身份未因配置页开放而获得，未配置登录入口不出现。
- 实际浏览器1280×900与390×844核验：三栏 launcher、配置跳转、消息抽屉、手机选择后关闭、用户面板；主题／密度／字号刷新后保留，最后恢复浅色／标准。390宽文档scrollWidth为390，浏览器warn／error为空。artifacts/header-qa 包含桌面／手机截图和 checks.json，视口已恢复。
- 配置字段及会话有效性沿既有 RP；本地没有真实平台注册凭据，本包没有声称真实登录／切换／登出联调通过。无DDL／Prisma／依赖升级，不重复数据库与worker制品测试。

本次为门户顶栏完善，未完成资源台账、真实接入或生产上线。最终提交与预览身份见 artifacts/formal-checkpoints/product-header.json。

## 用户批注调整

后续按三条批注调整：页面名与演示标签从右端移入header左侧槽，以官方竖向分隔符区分品牌；观澜使用display-xs，系统名称使用heading-1单行展示，删除顶栏BS-MOSS。字号全部沿用DS语义档位，品牌块内不增加竖线。787×871为重点检查尺寸，同时核验宽屏和390手机；本次仅排版，业务及权限未改，不重复单测／数据库／worker验证。构建、类型和HTTP与浏览器证据记录在header-sizing日志、artifacts/header-sizing-qa及对应检查点。

用户继续反馈观澜过大，改用ShellProductTitle官方20px产品标题，系统名称保持18px。系统中文名称更新为“站址多域运营监管”，同步共享品牌常量、门户及两个预览页面名称；产品代码与英文全称保留。

## 控制台工具按钮组与间距（2026-11-05）

用户指定参考console.vxture.com/zh-CN，右侧明确为主题、消息、帮助、配置四个按钮组成一组。参考URL在当前浏览器跳至登录页，因此不声称已核验登录后线上视觉；本地平台ConsoleHeader作为同源布局参考。采用发布DS的ShellIconGroup、ShellThemeToggle、ShellIconButton、Button和Drawer组合，不复制基础组件、不调整DS内部样式。原ShellHeaderTools固定帮助在消息前，无法满足用户顺序，因此在产品侧组合官方部件。

四项同为icon-md控件与sm图标，组内gap-2xs、组与用户面板gap-md；整组悬停／键盘聚焦沿官方accent反馈。Header槽间gap-xs沿官方布局，品牌与系统名及区域内部收敛gap-xs。主题使用实际解析主题并写回现有偏好；消息沿用未接入提示，不伪造通知，帮助新标签进入现有文档站，配置仍当前页进入/settings。头像不计入四按钮组。

窄屏保留完整四按钮，左右安全距space-xs，区域触发器允许收缩到父容器并截断，保留图标、完整title／无障碍名称和级联弹层。桌面沿用space-lg页边及48px Header；不变更全画布地图独立工具或业务数据口径。

验证发现刷新后主题CSS恢复但偏好context仍为服务端缺省，按钮与账户偏好显示不一致。根Providers首次挂载后以浏览器key重建官方ThemeProvider，继续由DS恢复已有偏好，无新增偏好键或全局token覆盖；再次验证深色刷新、浅色刷新与账户偏好一致。最终生产build含类型及32HTTP通过tmp/header-button-group-{build,http}.log；390／904／1280三档四按钮均24px／图标16px，组内4px／头像间16px，无文档横溢。消息开关、帮助_blank、配置跳转和账户面板检查通过，warn/error空；证据artifacts/header-button-group-qa。初次窄屏区域侵入组已修正，初次刷新主题不一致结果不计成功。

用户随后明确更正尺寸：四按钮外轮廓及点击区域统一32×32px，内部图标保持16×16px。本次通过官方组件className应用DS size-control-xl，仅扩大控件盒，保留icon-md配方的sm图标，不使用会连带放大图标的尺寸配方。组内gap-2xs与组到头像gap-md保持；本节覆盖此前24px按钮结论。

## Header非标签控件统一32px（2026-11-06）

用户要求除区域/演示标签外，其余Header组件高度统一32px，特别是launcher。公共ProductLauncher从size-control-2xl改为size-control-xl，删除自定义lg图标子节点，沿官方ShellIconButton的sm图标16px；不再使用额外rounded-lg，采用同组按钮圆角。ProductAccount通过官方triggerClassName设置size-control-xl，品牌首页链接增加h-control-xl。四工具原本已经32/16，继续保持；品牌标识图形及头像内图形沿官方配方，不强制按操作icon缩放。区域选择和演示标签不改，Header外框48px不改。

生产build含类型通过tmp/header-controls-32-build.log。本机浏览器1280/904/390三个实际宽度，所有非标签可交互控件高32、top8，launcher及四工具均32×32且svg16×16，品牌链接高32，头像触发器32×32。区域高24、演示标签沿原规格，文档宽与视口一致。手机配置launcher/用户面板及桌面业务launcher真实打开正常，展开态仍32/16；warn/error空，视口恢复、临时页关闭，证据artifacts/header-controls-32-qa含desktop/mobile/launcher和checks.json。纯尺寸调整不新增镜像测试或重复业务PG/HTTP；无权限/数据/依赖/DDL变化，提交/最终预览健康见对应检查点。

本轮用户中途优先修正Header，P1来源契约/拉取编排仅完成现有能力盘点，没有连接真实来源或修改数据更新语义。后续仍沿实施950接续，不将本次尺寸修正计入P1功能完成。

## Launcher图案恢复24px（2026-11-06）

用户进一步明确launcher图案太小，外轮廓32px保持，内部恢复原尺寸。ProductLauncher保留size-control-xl，使用官方Icon lg子节点恢复24px；本段覆盖上一节launcher图案16px的结论，四工具仍为32px外框和16px图案。

生产build含类型通过tmp/launcher-icon-24-build.log。浏览器实际测量常态/展开态均为32×32px、内部SVG24×24px，面板打开及Escape关闭正常；四工具实测32/16。390px窄屏文档宽390px，无横溢。截图及测量证据位于artifacts/launcher-icon-24-qa，临时页已关闭、视口已恢复。本次仅尺寸修正，不新增镜像测试或重复业务验证。

## 第二版精修 Logo 全站采用（2026-11-10）

用户确认采用第二版精修图形，产品名称继续使用“观澜”。共用门户与配置页头使用官方 ShellHeaderMark，24px 图形采用对应光学校正版；亮色与暗色图形由 DS 主题类直接切换，兼容系统外观与站内外观不一致的情况，无需等待组件水合后换图。地图及保留的旧版预览品牌位统一使用暗色版。

站点图标使用16px光学校正版SVG并支持浏览器明暗配色，另提供16/32/48px ICO兼容版本、180px Apple touch图标。品牌资源使用带版本号地址刷新缓存，原 guanlan-mark.svg 地址保留并更新为第二版自动配色图形。标准明暗、单色及反白SVG统一放在 public/assets/brand，第一版与已确认设计原稿继续保留在 artifacts 中。

本次只更新品牌标识与图标声明；沿用现有产品名称、导航和官方组件尺寸。

验证：最终生产构建与类型检查通过；63项既有HTTP检查通过。实际本地服务28组浏览器检查覆盖门户、配置、地图、旧版预览、桌面与手机、站内主题和系统主题相反时的显示、图标资源及设计原稿保留，未发现运行错误或页面横向溢出。证据见 artifacts/brand-adoption-qa/checks.json 与截图；服务已重启应用最终构建。

地图可见性补正：原侧栏品牌位被地图HUD样式隐藏；现将共用ProductBrandMark放入左上角“观澜”首页链接，移除隐藏的重复品牌位。构建与类型检查通过，地图加载后在390/475/577/846/1440宽度核验Logo可见、区域与操作无重叠、面板切换保持显示、返回首页正常，共16组浏览器检查通过。证据：artifacts/map-brand-visible-qa。

## 全屏工具（2026-11-11）

用户要求全屏位于主题之后第二位。ProductHeaderTools 接入官方 ShellFullscreenToggle，沿用现有 FullscreenProvider 与32px按钮尺寸；工具顺序为主题、全屏、消息、帮助、配置，用户面板仍独立。此段覆盖此前四按钮工具组的数量与顺序说明，品牌继续采用当前塔服研判名称及已确认第二版图形。

构建及类型检查通过 tmp/resource-compact-delivery-build.log。843实测工具顺序正确，390／475无文档横向溢出；IAB可验证全屏／退出全屏按钮状态，但不提供原生requestFullscreen API，未宣称实际原生全屏验证通过。证据 artifacts/resource-compact-qa。
