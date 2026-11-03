# 后台任务独立进程与交付

日期：2026-11-03。设计227，接续3c573c8。推进I09／I12的生产托管实现，不代表已经部署。

## 实现

新增host-config／host／process／entry。宿主严格读取显式绝对路径JSON，32KiB实际读取上界和UTF-8校验；kind与容器角色必须一致，拒绝nil工作区、主体覆盖、未知字段、越界登记／轮询／步数和停机期限。主体固定s2s:bsmoss，复用226签名身份及原C3／C2／显式有限ACL，不自动登记、授予权限或发布报告。样例nil工作区必须替换，不能直接运行。

需明确启用后台、关闭模拟预览、开启计量功能、配置真实产品client／平台与服务数据库；拒绝管理员数据库角色和PG_FORCE_NATIVE。validate命令只检查本地配置／固定代码，不接触IdP、数据库或执行任务；部署在替换进程前运行精确候选镜像的validate。

每个进程一个循环与自有pool；独立健康文件原子更新，只含schema／状态、kind、PID、SHA、配置摘要和计数。所有配置lane被观察且没有失败才running；授权／存储失败及backoff期间保留degraded，PID存在不等于健康。health命令校验实际文件上界、当前配置摘要、kind／SHA／PID存活／时效。状态写入串行化，停止后不会回到running。SIGTERM／SIGINT等待现有步骤结束、关闭pool，最长配置90秒；超时固定日志并非零退出，容器120秒宽限。未提交事务靠PG断连回滚、独立租约按原规则恢复。

声明直接构建依赖esbuild0.27.7，复用锁中原版本，离线安装没有增加包版本或传递依赖。单独CJS打包所有运行依赖，除了Node内置模块与未启用pg-native，脱离node_modules可启动；不在生产运行tsx。Docker同一digest包含Web与worker，后者独立command；CI build增加制品及脚本冒烟，六个required contexts不变。

docker-compose.workers.yml作为显式可选叠加文件，聚合／报告各一个进程，独立worker.env和只读JSON、无端口、非root、只读根／tmpfs／资源上限／日志轮换。env_file的required=false仅便于关闭已删除配置的旧worker，on部署必须先查三个私有文件再候选镜像validate，缺凭据不能启动。保存时也将既有etc目录收紧至0700。JSON不含秘密，在私有etc目录下0644以供非root只读bind访问；worker.env保持0600，不载入数据库owner配置。

部署和回滚workflow明确workers=on或off，默认off；on先validate再只重建app与两个worker，数据库／Redis作为既有依赖，使用--no-deps明确排除依赖重建；off先对两个确切服务stop120秒／rm，无卷删除和项目全局orphan清理。digest及worker模式仅readiness成功后推进。env-update扩展worker.env及两个JSON秘密配置来源，保存不自动重启；JSON由镜像validate严格验证，不把简单shell检查当语义校验。回滚旧Web-only镜像必须选off。

## 验证范围

最终计数、日志SHA及提交／构建信息见 `artifacts/formal-checkpoints/worker-process-host.json` 和 `tmp/worker-host-*.log`。纯规则验证严格字段、服务主体、历史lane上界；宿主验证在途步骤与关闭顺序、健康故障关闭资源、backoff保持降级、全部lane观察、摘要／PID／SHA／过期与真实文件上界。实际PG增加自有pool、结果写入期间abort、真实COMMIT后才close及不启动下一步。

制品复制到全新临时目录、无node_modules启动，验证禁用／错误kind／公开明文目标／原生PG模式／管理员连接拒绝且不泄密，health CLI正反例、只配置validate不联网、实际连接失败降级。Windows只做强制进程清理，**没有把它计为POSIX优雅SIGTERM验证**；同一Linux CI用真实SIGTERM检查零退出与stopped文件，远端CI当前尚未运行。

Git Bash运行真实部署／配置脚本，Docker／curl／flock均为合成适配：on精确镜像校验且失败不推进指针，off确切服务停机、配置隔离／保留previous、无卷删除或全局orphan清理。它不等于实际Docker Compose或Linux镜像部署。首轮修正了宿主测试误传额外字段及Next扩展ProcessEnv类型，无业务规则放宽。

## 剩余交付

Linux镜像构建／Compose、POSIX信号及网络验收、实际平台注册／自受众签发、受审机器ACL／登记和私有配置、授权真实来源、Beta部署、11万3倍突发、备份恢复／回滚、业务UAT和生产批准仍待。I08分层规模及I11角色层级独立推进。无DDL／Prisma变化或旧库迁移；五项1–3本地完成，4–5active，没有push／PR／远端CI／外部部署或上线。费用预留、退役P2和陕西演示保持。

本地收尾：540单测、354实际PG、6制品／进程／交付脚本冒烟、双层类型、生产构建及20HTTP通过；128篇编号文档、61表静态镜像、交付与SCA配置守卫通过。重建worker bundle后重新运行6项冒烟，验证包含部署up失败不推进image／worker状态，以及--no-deps排除数据库依赖重建。PG专用58874仅用于随机合同库，收尾已停止。Linux Docker／POSIX信号／远端CI仍未实测。2026-11-03只读预检仍缺远端源码、build／beta／prod环境及目标私有配置，见artifacts/release-preflight/result.json。

## 并发测试超时修复

原夹具在pnpm test／双层类型并发时曾出现Git Bash脚本30秒超时及降级观察10秒超时；新复核未稳定复现失败，但相同脚本从约5秒升到19–22秒，说明墙钟预算受启动负载影响。降级观察又与生产身份请求10秒截止同长，未给进程启动／健康IO留时间。保持生产10秒请求截止和全部业务断言，改用单调时钟30秒观察、子进程提前退出立即失败、测试45秒外层和脚本60秒／75秒外层边界。

TCP夹具使用真实resetAndDestroy并新增静默连接分支；前者验证快速断连，后者实走约10秒请求截止后出现degraded。允许轮询漏过首轮但必须failedSteps>=1、completedSteps=0，不能以空闲／成功掩盖失败。测试清理所有本地socket。6项制品测试与540单测／类型并发通过，Windows仍只验证强制进程清理，POSIX停机未声称通过。
