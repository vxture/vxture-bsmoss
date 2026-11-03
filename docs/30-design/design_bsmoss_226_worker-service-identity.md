# 后台周期任务服务身份

日期：2026-11-03。接续225；本设计只实现本产品适配，不新增跨产品标准或服务账号。

## 已有依据与待验证项

平台仓库 `docs/30-design/product_210_tool-protocol.md` §2、§3.1–3.3 明确复用产品既有 confidential client，服务模式用于无人参与的后台 Job／定时同步，RS256／kid／JWKS、单目标受众、act.sub、workspace_id、mode=service、scope 与短期 exp／iat／jti；service 模式无用户 sub。平台 `bff/auth-bff/src/oidc/token-exchange.service.ts` 的实际签发与此一致。原产品接入通则链接仍需登录，不复制或改写其权威内容。平台注册与自受众实际签发验收仍是上线条件。

后台为固定 workspace 换取 aud=bsmoss 的票据，沿既有 bsmoss／bsmoss-beta 客户端配置；aud=vxture 的平台通道票据继续只用于平台调用，不充当本产品后台身份。拒绝 OBO、用户 sub、多受众、其他调用产品／workspace／scope、无 kid、过期与超过300秒有效期。token 与密钥不写日志或本地文件。

## 产品内权限边界

验证后映射为显式 service 身份。产品 ACL／审计键 `s2s:bsmoss` 来源于验签后的 act.sub，是既有 local_authz 中的授权索引，不是平台用户 sub、账号或第二套凭据。用户身份不得使用保留的 s2s: 前缀。不得虚构用户 account_status 或治理角色。

service 仅允许 data plane 的 aggregate、report_generate、report_export_execute。每次仍独立验证 C3 app_instance、C2 当前权益、产品功能开关、显式有效本地授权与有限数据范围；不自动创建 member／role／scope，不赋 owner 基线。不允许浏览器分析、导入、模板操作、人工发布和受审恢复。原周期／导出／聚合事务及提交前身份和范围复核保持。

身份缓存固定到单个 provider 的 workspace／配置，提前30秒刷新，合并并发换票；有效期取 JWT 与响应最早值，失败不退回旧票。请求10秒截止、禁止重定向、限制响应32KiB和token16KiB，密钥携带目标沿既有出口检查，错误仅固定代码。C2／C3与本地授权不随票据缓存。

## 验收与交付边界

真实RS256正反测试、换票HTTP与流上界／并发／刷新测试、访问边界及实际PG事务撤权测试。浏览器与worker共享生产权益／授权策略，数据库连接保持按需，不因无身份请求初始化数据库。无DDL、Prisma、依赖或旧库迁移。

本包提供服务身份与生产 AccessPorts 组合，不包含生产 daemon 托管或实际平台注册／换票验收。真实来源、私有环境、Linux／TLS／registry／数据库、Beta／容量恢复／UAT及生产批准仍需实际完成；本地测试不构成上线。
