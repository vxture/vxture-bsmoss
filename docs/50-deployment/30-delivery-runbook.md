# bsmoss 首次交付操作说明

适用于新产品、独立空库。参考 yucer 的制品→受保护环境→显式 db-init→部署→检查→回滚流程。
本文件和工作流已经形成，可供审阅；没有执行远端操作。运行脚本需要 Linux、Bash、Docker Compose v2、flock 和 curl。

## 环境配置

beta/prod 分别登记以下变量，不复制 yucer 的域名、端口、主机或数据目录。

| 配置 | 存放位置 | 要求 |
|---|---|---|
| IMAGE_REPOSITORY | 仓库/Environment variable | 已登记的 `ghcr.io/<namespace>/bsmoss-app`；build 与部署一致 |
| STACK_ROOT | Environment variable | 专属 POSIX 绝对目录，拒绝 Windows/MSYS 路径及系统根目录 |
| DEPLOY_HOST、DEPLOY_USER | Environment variables | 已授权目标和 SSH 用户；工作流 runner 必须能访问该网络 |
| NODE_AUTH_TOKEN | Actions/构建 secret | GitHub Packages 只读；Docker 构建通过 secret mount 获取 |
| VXTURE_PACKAGES_READ_TOKEN | Dependabot secret | 与 Actions secret 分开配置，用于解析 @vxture 包 |
| DEPLOY_SSH_KEY、DEPLOY_KNOWN_HOSTS | Environment secrets | 主机指纹事先核验，工作流不禁用 host-key 检查 |
| APP_ENV_FILE | Environment secret | 依据根 `.env.example`；应用身份 DATABASE_URL 必须为 bsmoss_svc |
| STACK_ENV_FILE | Environment secret | 依据 `deploy/stack.env.example`；包含 owner 凭据和 Compose 插值变量 |

`APP_PUBLISH_PORT` 来自端口登记；容器内固定 3000 并不代表分配了宿主端口。
宿主只向 loopback 发布应用端口，由目标环境已有反向代理提供 TLS。
PostgreSQL 和 Redis 不发布宿主端口。持久目录由 DATA_DIR 明确指定。
生产 Compose 强制关闭样例预览。

平台登记路径参照 yucer 当前实现：OIDC callback `/api/auth/oidc/callback`，
provisioning webhook `/api/webhooks/vxture`，backchannel `/auth/backchannel-logout`。
完整 URI 以本产品正式登记值为准。beta 使用独立 client/密钥/数据库/Redis/目录和 project name。

## 首次空库交付

1. 在正式仓库配置六项 required checks，应用 `rebuild/main-ruleset.json`，核验没有 bypass actor。
   工作流文件存在不等于分支保护已经生效。依赖/密钥扫描和所有测试必须通过。
2. 运行 build-image，审核构建 SHA 和输出 digest。同一 digest 从 Beta 晋级生产；部署不重新构建。
3. 分别运行 env-update 的 app、stack 配置更新，将两个文件放在 `STACK_ROOT/etc/`，权限 0600。
   修改配置不会自动重启应用。app.env 不得包含 POSTGRES_PASSWORD 或 owner 连接串。
4. DBA 在独立 PostgreSQL 中预置非 owner、非 superuser、不可建库/建角色的 bsmoss_svc 登录身份，
   设置其密码并填入 app.env 的 DATABASE_URL。角色密码不写进 SQL 仓库。
5. 运行 db-init，明确环境和 image_ref。脚本启动 db/Redis，取得初始化事务锁，拒绝已有产品 schema，
   一次应用 00_baseline→97_runtime_grants→98_column_locks。不会清空或转换已有数据库。
6. 维护经过确认的成员、功能角色/权限和 data_scope；scope 包含 workspaceId、sourceIds、stationIds、
   metricKeys、serviceIds、deviceIds、allowSiteParameters 和独立的 expires_at。只有有限显式对象，禁止通配符。
   本批未提供授权管理页面或自动分配全省范围。
7. 运行 deploy，指定已审核 digest。脚本互斥执行、pull、健康等待和 `/api/ready` 核验。
   `/api/health` 是进程存活；`/api/ready` 检查数据库契约和 Redis，不能替代真实登录与业务验收。
8. 用真实测试账号验证 C1→C2→C3、本地授权、受限测量查询，以及拒绝跨 workspace/站址访问。
   配套来源与三类口径签认之后，才可以启用连接器和正式周期结果。

空库初始化的管理连接不会加载进应用容器。Web应用启动命令仅运行Next.js；可选独立后台进程与明确workers=on／off交付见[周期任务进程交付](50-worker-host-runbook.md)，不会在启动时执行DDL。
local_usage 标准表目前只读预留，不会将站址业务流量自动上报为 SaaS 计费量。
对账服务 `pollProvisioning` 已实现但没有自动调度，待运行环境确认后纳入任务生命周期。

## 检查与回滚

部署成功后记录 SHA、digest、配置版本、数据库基线、来源映射、指标字典、模板和首发范围。
`state/current-image` 与 `state/previous-image` 只在 readiness 通过后推进。
若 readiness 失败，保留现场和已有数据，显式选择已审核的上一 digest 运行 rollback。
此过程不自动回滚数据库、不删除证据，也不代替备份恢复演练。

上线验收仍遵循 [发布计划](20-release-plan.md)。本机已验证的测试不能替代 Beta 网络、真实 IdP、
Linux 镜像、备份恢复、容量或生产业务验收。当前环境未安装 Docker，容器构建与部署尚待执行。
