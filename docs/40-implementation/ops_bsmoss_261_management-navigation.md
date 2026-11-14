# 配置管理导航一致性整改

2026-11-07。用户要求与console导航一致，覆盖位置、收起居中、行高、组间距、分组字号和切页／刷新交互。

## 根因与交付修正

本机console安装DS10／tokens3，本站安装DS15／tokens4。同名control-xl从40收为32、control-md从32收为24，overline从默认12收为10；导航仍用原尺寸角色，64px收起外壳却没有对应调整。实测原图标中心28px，相对外壳中心32px左偏4px；行高32px；分组10px。使用相同组件名称不等于渲染尺寸一致。

共享design仓ShellSidebarNav恢复40px导航行和导轨、32px分组标题，默认分组text-label-small＋semibold为12px，条目text-label为14px、图形16px。横向留白由64px外壳与40px导轨及分组内距计算，三档密度均居中，避免用动态justify-center导致收起瞬间先跳。顶部开关外轮廓32px、图形20px；组开关与收起tooltip沿用官方组件。

本站原managementSections给所有组加dividerBefore，使组间距额外累积；现在只靠分组层级和DS留白。移除重复的导航底部返回块，header品牌及launcher保留业务入口。

原ProductChrome每页重新挂载且默认展开后effect恢复localStorage，最终静止宽度正确掩盖中间跳变。现在/settings/layout统一承载外壳，子页只提供正文；活动项从pathname判断，切页不重挂导航。展开偏好与分组关闭偏好写浏览器cookie，由服务端提供首帧初值，不等effect纠正。DS新增可选initialClosedGroups／onClosedGroupsChange，旧消费者未传仍兼容。收起图标链接补可访问名；关闭分组内容inert／aria-hidden，避免键盘进入不可见链接。

## DS交付方式

修正源码在D:/MyWebSite/vxture/vxture-design/packages/design-system。本站继续消费已发布15.0.0，使用pnpm patchedDependencies固化本地修复产物（ESM／CJS／类型／对应source map与组件样式），不手改node_modules，不加应用端覆盖CSS，不改全局token，不引入workspace依赖。锁文件只增加补丁身份，不更新其他依赖。未发布registry、未改console代码。

## 验收与边界

检查内容包括10个配置路由的单外壳／活动项／收起切页、逐帧宽度与DOM实例保持；无JS服务端首帧及水合刷新；三档密度图标中心；默认行高／组字号／间距；键盘、分组记忆、手机抽屉及不同屏宽。结果、截图、最终SHA见artifacts/formal-checkpoints/management-navigation.json，以实际通过记录为准。

本次只改共享导航显示和本站路由外壳，不改变来源／映射本机保存、真实身份、权限、DDL或任务执行。既有MVP边界继续，不扩建配置治理。

## 最终验证记录

DS源码提交0033b60，导航与外链66项针对检查、DS类型／构建／design及classes护栏通过。本站双层types、最终生产构建、锁文件冻结离线安装和正式接口HTTP回归通过；实际预览10路由连续切页、逐帧固定64px、无JS首帧、水合刷新、分组记忆、键盘、三密度和904／390布局共18项通过，浏览器错误为空。日志与最终健康版本存检查点。

验收发现旧Webpack依赖缓存仍使用原DS，隔离该缓存后重建并确认实际新组件，再做最终验收；首次手机脚本错误等待不存在的桌面导航，已改等抽屉入口。随后发现缺失favicon造成404，已复用现有观澜SVG声明站点图标，最终完整检查重跑通过。初轮结果不当最终通过。
