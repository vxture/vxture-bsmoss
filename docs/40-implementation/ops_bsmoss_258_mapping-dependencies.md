# 对象映射的聚合与报告依赖预览

2026-11-07，设计258，接续257／de3b5b0。

## 交付

/settings/mappings当前详情“变更预检”增加下游依赖。聚合及报告各20条＋lookahead，分别独立admin.mappings.aggregate_impact.view／admin.mappings.report_impact.view，无权不查对应表、不计0；原映射完整范围在影响权内才查询，报告还须完整manifest.requiredScope五维与物理参数先过滤后LIMIT。无owner／机器／预检权自动绕过。空库baseline仅2permission种子、无角色赋权，67表与Prisma保持，DDL只应用随机专用本机合同库。

当前聚合head按workspace／source／规范mapped对象身份，以及授权输出／全部实际输入指标、dependencies模式全部依赖指标过滤。input_manifest计划的authorityRevisions、mappingWindows／mappingPeriods或inputs必须显式引用映射ID。用interval／state／gauge原内核重算已存plan＋inputs，核对完整结果、输入摘要、聚合版本、对象／指标／周期及数字字符串revision；不是读取当前原量、重算写库或推进可分析截至。

当前生成报告head检索主数据、日级依赖和汇总成员的明确映射引用；复用readStoredReportInTransaction在同事务核对原manifest重建、摘要、系列元数据与完整scope，再按schema核对映射引用。旧head有引用而新head无引用时不列入；授权外的新报告不会占LIMIT隐藏可见报告。不能只因映射可见就披露整份报告。

配置基线／重叠／聚合／报告同只读可重复读事务、15秒SQL上限。成功、missing、stale及SQL失败均末次重验预检及已解析的两类独立影响权限、主体／租户／完整scope／过期；授权后端故障不降级成0影响。HTTP原POST／8192字节／同源／no-store门槛保持，无新API或自动赋权。

UI官方DS StatusBadge、原表单布局，两类折叠明细，展示记录ID／精确revision／指标或报告名／粒度／分析区间，未评估、空范围、尚有更多准确区分。指标名称复用reportLabels，ID／版本／日期分层，日期和版本按完整段换行，避免长标识挤断关键数字。草案变更清结果、迟到隔离、收起、关闭销毁及403清整页保持。

## 范围边界

这是授权范围内、已有明确引用的当前版本关联预览，不是必受影响结论或完整重算清单。不按有效期差分限制周期，因为版本变化也涉及整个原新区间；历史聚合／报告、非当前生成head的已发布报告、未发布聚合、未来新增依赖及无显式引用旧数据不覆盖。聚合／报告版本与全部原证据保留，本批不标失效、不重算、不重生成、不审批、不推进数据截至。

来源预检没有精确binding修订到聚合／报告的依赖证据，仍保持两项未评估，不能以同sourceId冒充该来源修订影响。映射预检接收任务影响仍未评估；跨版本接收位置与受审重新基准、可信依据原件验证／提交批准契约及真实连接核验继续待。

## 验证

754全量单测通过tmp/mapping-impact-unit.log，14针对通过tmp/mapping-impact-targeted-final.log；新增6项覆盖存储结果精确重放、主／日／peer／汇总引用及无关标题排除、无完整独立scope不查询、两类独立权／owner机器拒绝、成功与错误全路径撤权和授权后端故障不降级。双层types通过tmp/mapping-impact-types-final.log；最终UI调整后的production build含类型通过tmp/mapping-impact-build-final.log。

479实际PostgreSQL合同通过tmp/mapping-impact-db-final.log，新增11项：permission种子无角色赋权；21个实际聚合版本及21份内核构造存储报告的有界查询和完全无写入；独立授权不查另一类；第21聚合及报告损坏拒绝；22份更新但隐藏报告不占LIMIT；无输入derived结果仍要求全部依赖指标；peer主查询下日级证据与汇总成员引用可查；state／gauge设备计划重放；并发新报告时同一基线快照；旧引用不因历史版本保留被复活；实际PG权限撤销后成功／missing／stale／SQL失败均拒绝。外租户同名资源与报告隔离，结果不泄漏原量／主体／输入摘要。夹具只属随机专用本机数据库，不当真实来源验收。

首轮单测UTC零点夹具不符合北京时间分析日已修；首轮PG汇总内核第三参数误传period对象，改为period.start，并补当前head覆盖回归后全量重跑，不将初轮失败算通过。最终60项HTTP通过tmp/mapping-impact-http.log，原正式RP门槛与方法限制保持。

独立无头Chrome＋实际MappingWorkspace＋应用DS Providers，1280／904／390三宽普通结果及展开40项依赖明细6组、完整大数字、空范围／双无权／单类授权、输入清结果／迟到／409／503／403／关闭销毁回归通过。首次截图长版本与ISO日期随ID断字不够清楚，已按完整版本／时间段优化后构建重验；最终证据artifacts/mapping-impact-qa/checks.json及截图。正式管理／来源／映射三页三宽门槛、最终SHA与健康见formal-checkpoints/mapping-dependencies.json。合成组件与正式门槛分开，不操作用户标签页、不伪造真实身份验收。

文档编号／schema-mirror／SCA／delivery／ASCII／diff及staged gitleaks收尾，最终检查点为准。无新依赖，未改DS／平台／yucer，未push或外部部署／上线、未创建聊天／自动任务。专用本机PG与63334夹具停止，保留63333本地预览。

## 接续

下一先核对跨版本接收位置和受审重新基准的只读差异及处置契约，再可信依据原件／业务提交批准契约下受审写入与真实连接核验。来源修订到聚合／报告的精确依赖证据，以及完整历史／潜在依赖仍待，不把本批当前映射关联当全治理完成。组织主档／授权写入、规则发布、其他配置审计、原P1工作台／消息／按需接收、P2共同可用版本及真实来源／平台注册环境／Beta容量恢复／UAT／生产批准依赖保持。
