# 后台任务服务身份实施与验收

日期：2026-11-03。设计226，接续20a89ac。本包推进I05／I09／I12后台身份适配，不代表已在平台注册、部署或上线。

## 实现

新增worker-identity服务器适配，复用产品既有confidential client换取aud=bsmoss的service模式票据。基于平台product_210 §2／§3和实际token-exchange签发代码，不另起跨产品标准；原产品接入通则仍需登录，实际自受众签发须联调验收。签名必须RS256并有kid，校验issuer／精确单受众、act.sub=bsmoss、固定workspace、scope、无用户sub以及exp／iat／jti。TTL不超过300秒，实际过期立即拒绝，不借通用JOSE的60秒容差延长任务身份。

单provider固定配置与workspace，缓存只有无凭据的证明，提前30秒刷新／并发singleflight；有效期取签名与换票请求开始时间加expires_in的最早值。32KiB实际流／16KiB票据上界、10秒请求截止、禁止重定向、沿既有机密出口检查，错误只固定代码，不带IdP正文／token／secret。aud=vxture平台通道实现保持原用途。

VerifiedIdentity明确区分user与service。服务ACL／审计索引s2s:bsmoss由已验证调用产品派生，是产品本地授权键，不是虚构平台用户或另一套凭据；人用身份保留该前缀不可占用。service仅能在data plane执行aggregate／report_generate／report_export_execute。没有用户account_status／角色、owner基线、自动member／role／范围。即使持有后台身份也不能发布模板／报告、恢复任务或下载报告。

production-ports抽取浏览器和worker共用的C3实例、C2权益、本地PG有效授权和功能开关策略；数据库保持按需取得，无身份请求不初始化数据库。worker-access及workers/runtime提供内部组合根，固定subject和workspace，复用现有事务与循环，不新开HTTP入口或启用生产daemon。聚合supervisor把机器验权错误归为授权失败，不消耗业务重试。

## 验证

534项单元测试（新增9）、353项实际PG（新增6）及双层类型检查通过。最终生产构建／20HTTP／125篇文档与61表镜像守卫／扫描和运行SHA及日志摘要见 `artifacts/formal-checkpoints/worker-service-identity.json` 与 `tmp/worker-identity-*.log`。新增真实RS256和本地HTTP、生产策略与有限范围测试；测试签发端和业务来源均为合成，未连接实际IdP或客户来源。验证用户／OBO、其他产品／workspace／scope、多受众、kid／签名、缺失／过期／超长有效期、实际流和声明大小、刷新失败无旧票回退、并发换票、响应延迟不延长寿命、禁止重定向、固定错误与无身份数据库惰性。

实际PG使用专用本地58874集群、随机bsmoss_contract空库和bsmoss_svc运行角色。新增独立UUID租户，真实签名provider→生产C3／本地授权→聚合／报告循环：未赋ACL不自动建member，撤销授权和C3立即拒绝；缺数仍缺数；写入后的真实DB授权撤销、provider失败使结果／回执回滚，独立聚合租约保留；报告生成回滚保留pending；人工审阅发布后服务导出，写后撤权使artifact／attempt回滚，恢复后才成功，服务仍不能下载或发布。人工reviewer测试端口与服务provider独立。

首轮测试修正了新增夹具的periods模块路径和基于时钟跨秒的TTL反例；人工交互夹具不能借bundled数据面权益，改成独立有效tier，不放宽产品规则。无DDL／Prisma／依赖变化，仍61表空库；沿实际PG镜像比对和静态镜像守卫，无旧库迁移。无UI改动，不重复地图组件QA；生产构建和保护路由HTTP回归准确计数以检查点为准。

## 后续

服务身份适配已具备，仍需平台实际注册／aud=bsmoss签发／C1/C2/C3验收、受审的机器ACL及周期登记和生产daemon托管。真实来源字段／脱敏样例／单位与粒度／映射和业务签认、目标Linux／域名TLSregistryDB、私有app.env与stack.env、远端build-beta-prod、11万站3倍突发容量、安全恢复／回滚、UAT及生产批准仍是独立交付条件。

五项1–3本地完成，4–5active；已有bs-moss heartbeat继续复用。本包未push／PR／远端CI／真实来源接入／外部部署或生产上线。陕西客户演示、费用预留、退役P2和新产品无迁移不变。
