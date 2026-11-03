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
