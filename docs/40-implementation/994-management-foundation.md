# 管辖范围与成员管理只读基础

2026-11-06，设计251，接续配置职责重组993。

## 实现

官方DS管理侧栏新增组织管辖／管辖范围、成员权限／成员管理，导航均四字。管理总览按组展示入口，组织与成员两组横向对齐，参数组复用两列；五类管理范围继续准确显示部分具备或待建设。业务任务归属不变。

两个真实RP只读工作台提供检索、筛选、keyset翻页；成员详情Drawer展示身份、状态、授权至、已配置角色权限和五维scope／物理参数标志。管辖范围仅查询正式资源表及授权关联数量。使用发布版ShellPageContainer、DataTable、InputGroup、NativeSelect、Button、Drawer和PanelCard，无依赖或DS代码变更。

独立admin.members.view、admin.jurisdiction.view权限加入空库baseline目录；无角色分配、成员创建或写API，owner无自动管理权限，机器拒绝。原真实身份、订阅和产品启用条件保持。成员完整scope SQL过滤先于LIMIT，复合workspace隔离，lookahead再校验；所有读在READ ONLY／REPEATABLE READ事务完成后重验身份、权限、到期和scope，空页／缺失详情也复核。SQL失败回滚释放，不回退空结果。解析拒绝未知／重复／无界参数，不从query取权限；no-store、Cookie Vary、nosniff与安全错误正文。

客户端取消过时请求，筛选翻页即隐藏旧数据；详情401／403直接清空整页并关闭详情，重新读取由用户触发，不以自动重读重新显示刚失权的目录。角色配置不被称为最终有效权限，停用及过期目录记录保持可核对语义。

## 验证

705项单测通过tmp/management-all-unit.log；新增9项管理规则／服务边界与既有3项导航检查，针对日志tmp/management-unit.log。434项实际PG合同通过tmp/management-pg-final.log，含8项新增管理检查：权限目录无自动分配、完整五维过滤与分页、缺scope／非法scope、跨租户、停用／过期、角色投影、授权资源计数、非特权runtime、SQL失败回滚及真实存储撤权。只在本机专用随机bsmoss_contract库应用00／97／98，自动移除；67表及Prisma列镜像不变。

双层types通过tmp/management-types-verified.log；最终production build含类型通过tmp/management-build-final.log；55项HTTP通过tmp/management-http-final.log，含管理匿名401、POST405、cache headers及门槛H1中文内容。静态schema-mirror保持67表。首轮PG撤权夹具误把subject对象传到workspace参数，修正调用签名后全量重跑通过；首轮cache断言误预期private,no-store，依既有共享协议no-store修正。失败均未计入通过结果。

浏览器正式三页1280／904／390共9组与独立loopback实际组件两页三宽6组均1个H1、无正文／文档横溢。手机详情390px内无超宽；成员详情及scope展开、21条keyset翻页、查询403清空、详情403清空列表和Drawer、503安全提示、迟到响应隔离、地市＋站址检索、移动DS导航选择关闭、管理launcher跳转通过。新页面JSX静态属性曾把ASCII Unicode逃逸当字面文字，已改表达式，最终H1及输入提示复测中文正确。管理首页初版纵排空白较多，改横向组对齐后最终截图。warn/error空，viewport恢复、临时16关闭，用户页保持。

证据artifacts/management-foundation-qa：management.png为正式管理首页；fixture-member-detail.png、fixture-mobile-detail.png、fixture-jurisdiction.png为明确合成测试组件，不是真实成员／来源验收；mobile-navigation.png及checks.json。最终SHA和63333健康见artifacts/formal-checkpoints/management-foundation.json。

## 后续

真实身份／平台订阅尚未开放，本地正式路由准确显示身份接入待完成，不伪造组织树、成员目录或实际授权。责任组织主档映射、分配、受审角色／scope写入、配置审计仍待设计实现；下一批先站址分类与分析规则，再来源配置与高级管理。原P1接收工作台、分阶段消息、受审重新基准、按需接收、共同版本及真实来源／平台注册环境／Beta容量恢复／UAT／生产批准依赖不变。

无push、外部部署、自动任务或新聊天；不应用业务库DDL、不扩机器权限、不推进数据截至或声称上线。
