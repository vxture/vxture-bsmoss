# yucer 工程体系适配记录

2026-10-28。产品代码统一为 `bsmoss`，包域为 `@bsmoss`。本批按用户要求，直接实施公共工程能力。
参考仓库为 `../vx-agent-yucer`，核对版本 `80f5114ae68f5eb65c8d99b494381989385b473f`。
平台仓库仍是治理权威；yucer 是已存在的实现参照，不能将其注册记录、运行凭据和发布历史当作本产品事实。

## 适配矩阵

| 层面 | bsmoss 实施结果 | 验收边界 |
|---|---|---|
| 仓库与分层 | pnpm workspace、Next.js 门户、shared 品牌、domains 的规则/服务/store 分离 | 已有三类指标、配置、测量模型继续使用 |
| C1 身份 | PKCE/state/nonce、RS256/JWKS、Redis opaque session、刷新串行化、登出和 backchannel | 单测与未配置时 HTTP 拒绝已验证；真实 IdP 登录待注册联调 |
| C2 商业覆盖 | 平台产品服务 Bearer 换票、工作空间隔离、响应缓存、失效处理 | 缺配置与过期后故障均拒绝；无生产 mock 回退 |
| 产品功能策略 | 显式 `BSMOSS_METERING_ENABLED`，当前版本只启用 metering | 已知 tier 可交互访问；bundled 仅数据通道；没有自造收费分档 |
| 产品权限 | local_authz 五张标准表及 data_scope，可信令牌→覆盖→操作→有限范围 | owner 只补操作基线，不能自动看到全省数据；授权管理页面待后续 |
| C3 下行 | 原始请求验签、密钥轮换、delivery 绑定、PostgreSQL 事务去重/序号/开通状态 | 并发、乱序和回滚实测通过；下线归档，不删除证据 |
| C3 对账与回执 | 沿用全量分页对账和 ready ACK 客户端，ACK 在事务提交后发送 | 作为可调用服务实现；没有启动后台定时器或远端任务 |
| 平台用量 | local_usage.raw/checkpoint 标准缓冲结构 | 仅结构预留；未注册商业计量键，未启用上报 |
| 正式证据查询 | `/api/measurements` 从 RP cookie 构造服务端身份和 Pg store 范围 | 不接受客户端 workspace/sub/角色；当前返回原始测量修订，不冒充聚合报告 |
| 数据库 | 15 张基站领域表 + 10 张平台标准表 + 1 张本地范围表，共 26 张 | 空库 00/97/98，Prisma 标量镜像；应用启动不执行 DDL |
| CI | quality-gate、build、test-coverage、audit、gitleaks、db-contract | 配置已落库；本地测试有记录，未声称 GitHub Actions 已运行 |
| 治理与扫描 | 空 bypass ruleset、本地 secret hook、固定扫描器版本/摘要、Dependabot | ruleset 为待应用配置；SCA watch 仅手动触发，不自动发 issue/评论 |
| 制品 | standalone 多阶段 Dockerfile，BuildKit secret、非 root、SHA 版本字段 | Windows 生产构建通过；当前环境无 Docker，Linux 镜像待流水线验证 |
| 交付 | build、deploy、rollback、db-init、env-update 手动工作流，beta/prod Environment | 只使用登记后的端口、目录、域名、仓库及密钥；未实际部署 |

## 有意收紧的适配

1. C1 需要本产品 client、secret、redirect 和 Redis 才能启用。访问令牌必须有 exp/sub，刷新后不能更换 sub。
   logout token 使用独立的 iat/jti 校验配置，允许 OIDC 的 sid-only 形式；backchannel 同时校验事件、时间和重放。
2. 不输出身份服务错误响应正文。退出登录使用同源 POST。未确认的 accounts status-query 协议没有进入本产品代码。
3. C2 最多缓存 45 秒，尊重 no-store/no-cache/max-age=0，过期后获取失败就拒绝。
   并发读取合并，调用方不能改写缓存；失效发生前发出的响应不能重新填回旧授权。
4. webhook 的状态、去重记录与序号必须同事务提交。生产依赖 PostgreSQL，不会因缺 DATABASE_URL 改用内存。
   `InMemoryProvisioningStore` 仅供测试依赖注入。
5. 应用连接身份固定为 bsmoss_svc；应用读取的 app.env 不包含数据库 owner 密码。DDL 和本地授权维护使用独立管理路径。

## 业务范围保持

保留经营服务性、运营状态、运行参数三类；覆盖陕西约 11 万站址是容量规划，不是已导入数据。
通话、流量、短信、电耗等是受监管对象的测量事实，不能直接写入平台商业用量缓冲。
费用、无人机、机器狗和设备控制均未启用。

正式查询还需有效开通状态、C2 覆盖、本地成员、权限和显式有限范围。没有这些条件时，空数据不能被包装成“正常运行”。
真实来源、周期聚合、调度、报告、导出和完整管理界面仍按 I06–I14 逐项推进，样例门户继续明确标识为样例。

## 本地验证与交付事实

本批证据包括单元测试、真实 PostgreSQL 空库/adapter 测试、双层类型检查、Prisma 校验、生产构建和 HTTP 冒烟。
具体最终数量及检查结果见本目录后续验证记录和工作台账。

npm 审计端点曾返回 ECONNRESET，不能据此认定依赖无漏洞。CI 的 audit 继续以 OSV 阻断扫描为准。
六项 required checks 定义已落库，不代表远端分支保护或 Actions 已启用。
没有创建远端 PR、提交/推送、镜像发布、端口分配、产品注册、Beta 或生产部署。

下一步按 [部署操作说明](../50-deployment/30-delivery-runbook.md) 交接环境配置，并在授权来源资料到位后推进 I06。
