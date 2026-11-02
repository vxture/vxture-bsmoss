# I05 第一批：可信身份到测量授权的内部适配

日期：2026-10-28。I05 状态为 in_progress。本批交付可测试的内部授权编排和测量门面，
未开放真实 HTTP 接口，未实现 OIDC RP、C2 网络客户端、C3 接收或生产联调。

## 权威核验及限制

平台权威入口为 [产品接入通则原件](https://claude.ai/code/artifact/20e37039-ea59-4c5d-9fab-ba3ca3ad54f0)。
本次实际打开后显示“Sign in to view this page”，未读取正文；原件仍需核验，不能据本批认定外部契约验收完成。
本文件是本产品实施记录，不替代原件、不另定义平台标准。

本地交叉核验材料：平台 product_200_integration、product_240_repo-template §2.4、
identity/080-rp-integration；platform-api 的 platform-entitlements.router、entitlement-view；
yucer 的 session、claims、entitlement/capability、platform/channel-token 和注册检查表。
参考目录为 D:/MyWebSite/vxture/vxture-platform 及 D:/MyWebSite/vxtureagents/vx-agent-yucer。

上述材料明确区分工作空间隔离键、平台治理角色、产品功能权限、商业权益及产品能力矩阵。
本批只用内部端口表达这些职责，不新增或推演跨仓接口路径、字段、验签、缓存协议。
旧材料之间存在过时表述，实施外部通道前须以原件为准；不照搬历史共享口令、登录旁路或陈旧授权回退。

## 代码及调用顺序

- `domains/access/resolve.ts`：内部 VerifiedIdentity、Coverage、LocalGrant 三端口与授权解析。
- `domains/access/measurements.ts`：调用现有 measurements/service 的授权门面，每次用解析出的范围创建独立 store。
- `domains/access/resolve.test.ts`：身份、权限、范围、撤销、异步过期及门面行为验证。

调用顺序：服务端验证会话 → 工作空间商业覆盖 → 产品功能策略 → 本地操作权限 → 有限数据范围 → 测量服务 → PostgreSQL store。
VerifiedIdentity 只允许由完整验签、issuer/audience/时效核验及服务端会话实现返回，不能用解码 JWT 或请求 JSON 代替。
当前没有它的生产实现。用户会话与后续 worker 服务身份应各自核验，不能把用户入口伪装成连接器身份。

接口只接操作和服务端固定的 interactive/data 平面，没有让请求选择工作空间、sub 或授权集合的参数。
缺会话、缺活跃工作空间、非 active 账号、过期或不一致的商业覆盖立即拒绝；不猜工作空间、不回退到样例身份。
interactive 需 tier 非空，data 允许 tier 或 bundled 覆盖；具体功能仍必须由产品自己的 featuresFor 策略授予。
尚无 BS-MOSS 商业档位方案或生产能力矩阵，本批未从 yucer 复制档位与功能，不因任意非空 tier 自动放行 metering。
测试中的 fixture-tier 是内部假数据，不是平台枚举或已登记套餐。

本地权限按 `(workspaceId, sub, operation)` 解析。只支持当前 metering.view / metering.ingest 操作。
workspace:owner 有这两项操作的基线，org:owner、workspace:manager、裸 owner/admin 或 token 中业务权限字符串均不自动获得该基线。
owner 仍必须取得本地有效记录和明确范围；没有本地范围时拒绝，不生成全省、全部来源或全部物理设备权限。

范围包括 sourceIds、stationIds、metricKeys、serviceIds、deviceIds、allowSiteParameters。
它们由本地可信范围实现解析，不能从城市/运营商筛选器直接当作授权。
不支持通配符；空集合表示没有该项数据授权。运营商服务关系不会自动授予电耗或设备权限。
PgMeasurementStore 继续执行这些范围和映射约束，本批不以门面替换其行级检查。

所有输入快照化；授权集合使用不提供 add/delete 的只读视图，避免 Object.freeze(Set) 仍可扩权的问题。
每次门面调用重新读取身份、覆盖和本地授权；任何依赖失败不重用先前结果。
异步解析完成及 store 构造后检查最早过期时刻。单次操作之后发生的撤销由下一次授权检查生效，
不承诺在途 SQL 的即时取消，也不以这个内部端口替代真实 C2 缓存/失效机制。

写入门面不接收 workspaceId / quality.decidedBy，二者由可信上下文构造。
查询及写入拒绝额外授权字段；原测量规则和 store 继续校验源事件、值类型、映射、时间窗和质量。
门面输入在第一个 await 之前快照化，防止调用方在授权等待期间替换来源或载荷。

## 验证范围

新增 17 项行为测试，总计 43 项单测；根目录及应用类型检查通过。
文档编号检查通过（30 篇），静态结构镜像检查通过（15 表）。
用受控内部端口验证两道门顺序、跨产品/空间、缺省/异常身份、bundled 平面区别、
产品策略拒绝未知档位、治理角色边界、有限物理范围、撤销及过期、只读快照、
请求注入拒绝、写入身份归属与每次独立创建 store。
这不是平台真实账号、远端 C2 或数据库整链验收；数据库结构未修改，此前 I04 的真实 DB 证据仍独立保留。

## 后续工作拆分

| 子项 | 状态 | 出口 |
|---|---|---|
| I05-1 内部授权编排与测量门面 | done | 本批测试及类型检查通过 |
| I05-2 原件与注册资料核验 | 待资料 | 原件可读；产品、环境、OIDC、回调及服务凭据登记证据 |
| I05-3 C1 RP 与服务端会话 | backlog | PKCE、验签、刷新、退出及真实账号验证；无本地身份旁路 |
| I05-4 C2 与产品能力策略 | backlog | 权威共享值域、实际权益响应、缓存/失效及本产品矩阵；未知档位保守处理 |
| I05-5 本地授权和范围持久化 | backlog | 业务角色/权限目录与显式来源、站址、服务、设备范围；真实数据库验收 |
| I05-6 C3 生命周期与整链联调 | backlog | 按原件实现验签、幂等、有序、事务及业务空间状态；真实联测 |

I05 完成前不进入真实来源接入或宣称 I11 授权查询完成。基站通话/流量/短信是业务监测事实，
不能把它们直接视为平台商业 consume 用量；本阶段不新增费用功能或商业计量注册。
