# 来源配置与配置审计只读工作台

2026-11-06，设计253，接续配置管理业务参数995。

## 实现

官方DS管理侧栏增加数据接入／来源配置和高级管理／配置审计，两入口与管理总览、launcher同源，导航保持四字。两页共用ShellPageContainer、PageHeading、InputGroup、NativeSelect、PanelCard、DataTable、StatusBadge、EmptyState和Drawer，支持配置／来源／适配及映射版本检索、登记状态筛选、keyset分页与完整范围详情。不显示额外读取时间，不推进分析数据截至。

来源配置读取现有source_binding_head对应的当前修订；配置审计读取source_binding_revision不可变历史，精确版本详情。审计目前仅覆盖来源配置，不冒充成员、模板等全系统配置审计。登记启用不代表网络连接正常或数据完整；覆盖起点不代表已接收截至；数据库记录主体不等于业务审批人，登记依据仍需核对原件与业务签认。无新增、启停、编辑、测试连接或写API，接收执行／数据更新继续归业务。

新增独立admin.sources.view与admin.configuration_audit.view权限及四个GET接口；真实RP身份、平台订阅和产品权限先于解析，owner无绕过、机器拒绝。空库baseline仅增加权限目录种子，无角色赋权、无新表或Prisma改变，仍67表。DDL仅应用于随机专用本机合同库，没有改业务数据库或迁移旧库。

存储适配器使用只读可重复读事务，同租户／完整五维范围及物理参数标志在LIMIT之前过滤。历史逐版本判断，不能凭当前小范围显示旧大范围记录。应用／数据库摘要、binding结构、工作空间、版本及范围逐条校验，lookahead也校验。审计游标保留UTC微秒、标识与字符串numeric版本，防同时间版本跳漏或JS精度损失；参数重复、未知字段、非法游标及超过numeric(30)位数的版本拒绝。整页查询及空页／缺失详情在返回前重验身份、权限、完整scope和有效期。

接口仅GET，no-store／Vary Cookie／nosniff、安全错误正文，原成员404协议保持。客户端取消过时请求，切换条件立即清旧数据；详情401／403关闭Drawer并清整页，需要显式重新读取恢复。正式会话未接入时显示真实门槛，不回退合成记录。地域仍只是分析偏好，不伪装为配置授权范围。

## 验证

717全量单测最终通过tmp/source-management-tests-final.log；最终版本长度边界与成员404兼容修正后，19项针对单测及双层types通过tmp/source-management-unit-final.log和tmp/source-management-types-verified.log。生产构建通过tmp/source-management-build-final.log；57项HTTP通过tmp/source-management-http-final.log，包含四接口匿名401、POST405、缓存边界及两正式门槛页唯一中文H1，无假记录或写操作。

441项实际PostgreSQL合同通过tmp/source-management-pg-final.log，含新增7项：权限种子无角色赋权、完整范围在分页前过滤、历史逐版本隔离、同时间微秒与多版本分页无重漏、literal检索及暂停状态、真实只读运行角色／失败回滚释放、实际撤权后空／缺失结果拒绝、损坏摘要及lookahead整页拒绝。首轮夹具member_role插入漏显式列名造成失败，已修member_role和role_permission列名后重跑全套，首轮失败不计成功。测试使用专用本机cluster的随机合同库，收尾停止本轮启动的cluster，不删除已有目录。

浏览器正式管理总览／两门槛页三宽1280、904、390共9组，独立loopback实际组件两页三宽6组：每页唯一H1，无文档溢出，正式正文无横溢；手机详情完整限定390px。组件检索、暂停筛选、空结果、21条数据翻至末页、五维范围详情、503、列表403、详情403清整页和Drawer、迟到响应隔离通过。正式移动DS导航与launcher跳转通过。一次定位误用了不支持的level选项，改按h1定位复核，不将定位失败计为页面通过。warn/error空；临时18／19关闭、viewport恢复。证据artifacts/source-management-qa；合成组件记录与正式身份门槛明确区分，未伪造正式来源或登录。

文档编号、ASCII、schema-mirror、SCA、交付守卫及staged gitleaks按收尾记录；最终commit与63333健康见artifacts/formal-checkpoints/source-management.json。仅本地预览，无push、外部部署、真实签认或生产上线，无新增聊天或自动任务。

## 后续

下一批先梳理受审来源配置治理与对象映射：授权原件／字段、配置变更依据和版本、映射校验及连接测试契约，再实现可核验的写路径；现有只读记录不能算完整治理。责任组织主档／授权写入、生产规则回放签认／发布、其他配置审计待续。原P1接收工作台／分阶段消息／受审重新基准／按需接收、P2共同可用版本与报告依赖及真实来源／平台环境／Beta容量恢复／业务UAT／生产批准依赖保持。
