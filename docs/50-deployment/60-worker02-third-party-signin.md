# worker02 第三方账号登录接入

2026-11-15。用户指定域名 https://bsmoss.ruyin.work，部署 worker02（与 yucer 同机）。用户进一步明确：按第三方应用登记，只接账号与登录，不接模型、能力、订阅权益、S2S 或用量上报。本次范围覆盖此前首次交付通用文档中的平台商业接入要求；那些要求不作为本次第三方账号登记的前提。业务数据源及产品自身权限仍独立管理，不因登录而开放。

## 已准备

- yucer 工作区原为干净 main，已 fetch 并快进到 f918c15c9c0445a33067b849ad3de00fc89ae02b。未修改 yucer 业务源码。
- 公开登记参数：deploy/environments/worker02-prod.registration.json。平台已签发 client ID bsmoss；产品保持草稿，客户端 stable 已启用，文件不表示已经部署。
- 域名与 OIDC 回调：/api/auth/oidc/callback；退出返回 /；反向退出 /auth/backchannel-logout。申请范围 openid profile email，不申请电话、模型、商业或机器通道权限。
- 私有运行配置样本：deploy/environments/worker02-prod.app.env.example。OIDC_CLIENT_MODE=third_party，禁用 S2S 回退；Cookie / nonce / PKCE / issuer / audience 校验继续保留。
- 独立目录提案 /srv/md0/bsmoss，与 yucer 隔离；端口留空，必须先在权威登记表确认。样本不是已分配资源。
- 登录页与会话状态入口 /entry，权威状态 /api/entry-status，私有禁缓存。当前活跃账号可以登录，无需工作区、商业档位。读取失败显示连接异常，不显示未开通。重新检查读取服务器；恢复登录在新标签页进行并保留当前页；焦点返回时重新检查。
- 页面参照用户提供的 2026-11-13 CoSpace 套件：中心卡片、品牌替换、淡化静态插图、身份卡、48px DS 按钮、无数据保留承诺、无虚构姓名组织。
- 四个部署工作流复用 yucer 最新 tailnet-ssh-connect，环境级 SSH secrets 优先、端口参数与加密密钥支持、已核验 known_hosts 必填；仍为手动工作流、不可变镜像与原有 readiness 门槛。

## 外部执行状态

用户已完成 opera 与 Claude 登录及 TOTP 二次验证，并明确确认提交。平台已于 2026-11-15 创建 bsmoss 第三方 sso_only 产品，供应方 Ruyin Studio，产品草稿；正式 stable 机密客户端 bsmoss 已启用，openid/profile/email、强制 PKCE、参与后端退出。运营域与独立订阅关闭，仅 Web。一次性凭据已保存至仓库外当前用户专用的私有目录，不进入源码、日志或聊天。登记成功凭证：tmp/platform-entry/registration-success.png。

接入检查确认产品登记通过、启用客户端就绪，但尚无真实登录记录。该检查仍要求模型授权、能力授权及 Webhook，与本产品 sso_only 范围不符；未为通过检查而扩大接入范围，需平台修正检查适用条件。

权威端口表已读取，尚无 bsmoss，L2 新增须 owner 决定；不在仓内重建端口表、不自取号。未分配端口、未改 DNS/代理、未执行 DDL、未部署。GitHub 仓库可管理，但当前无 build/beta/prod Environment 或仓库级变量/密钥；组织级读取返回权限不足，不尝试提权。后续需获配端口及可用的 worker02 部署环境/SSH Secrets，再执行生产部署和真实登录验收。
## 验证记录

本次类型、登录相关测试35项、入口HTTP测试2项、生产构建、交付守卫和251份文档编号检查通过，日志在 tmp/platform-entry/。浏览器访问此前的本地源权限限制仍尊重；不能将 HTTP 或源代码检查称为逐页视觉验收。真实平台登记后需以正式账号验证登录、回调、会话恢复、前/后通道退出和重新登录，再部署到获配端口并验证域名 TLS。


## 端口登记后续

用户授权代为处理端口与部署配置，并明确授权向 Claude 原会话发送原件修改指令。2026-11-15 已在权威 artifact 核实 bsmoss 新增成功、L2 留白相应收缩，状态为未部署；正式端口已填入部署 env 样本。数据库仍待基建登记，不复制 yucer 生产密钥。用户确认存在组织级 Secrets/Variables，当前 CLI 缺 admin:org；已打开组织配置页，等待用户登录后检查本仓访问范围。

## GitHub 交付配置

2026-11-15 用户完成 GitHub 登录，并逐项确认向 vxture/vxture-bsmoss 开放六项 DEPLOY_WORKER02_* 组织密钥（HOST/PORT/USER/KNOWN_HOSTS/SSH_KEY/SSH_KEY_PASSPHRASE）。已保存，仅新增本仓授权，各密钥原八仓授权保留，密钥值未读取、轮换或复制。Tailscale、NODE_AUTH_TOKEN 与 ACR 组织密钥/变量对公开仓库可用；本仓为公开仓库。四个 SSH 工作流优先环境专用 DEPLOY_*，再回退 worker02 组织密钥，保留严格主机指纹校验。

已创建 build/prod Environment，设置 IMAGE_REPOSITORY、正式 STACK_ROOT、PROJECT_NAME 和登记端口变量。尚未上传生产 app/stack 配置、初始化数据库或部署服务。全量业务测试 1063/1063，通过当前交付文件及145个历史提交的 gitleaks 扫描。用户明确批准空仓一次性以根提交 ff2d30f 初始化 main，再提交完整交付 feature PR，六项 CI 通过后合并并推进发布。
