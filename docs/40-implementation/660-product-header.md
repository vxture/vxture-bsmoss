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
