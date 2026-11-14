# 正式报告工作区

设计见[212](../30-design/design_bsmoss_212_formal-report-workspace.md)。I12继续in_progress。

## 实施内容

新增`/reports`列表、修订详情和模板生成／发布／撤回／导出操作。关闭preview时根入口转正式报告，preview开启仍进入既有地图；未配置RP的正式页面为未开放态，未登录为平台登录态，不使用演示身份。初次打开不选报告。

ReportStore增加list，授权门面沿view读取及末次完整scope再验权。PgReportStore单RR只读事务、SQL先按完整历史requiredScope过滤再分页、C顺序键集游标、当前修订元数据和SHA验证。列表freshness明确unchecked，不逐份读取原始事实做新鲜度查询，不给出全省总数或容量承诺。

增加生成、发布撤回、导出请求HTTP边界，共用reportCommand；16KiB实际流上限、配置Origin、JSON、无query、严格纯规则与固定私有错误。生成发布沿原事务和CAS，导出返回202任务；未开放普通用户执行器。当前发布查询无事件时200 null，历史事件不存在仍404；读取失败不冒充未发布。

独立生成、快照完整、新鲜度、当前发布、任务成功及可下载状态。三类指标使用从HTML renderer抽出的纯display函数，保留大整数、比率分子分母、状态时长及温度口径。渲染HTML逻辑与版本未改，仍通过旧摘要和转义测试。桌面宽详情／双列卡片，窄屏单列；证据可展开，原始JSON限制局部高度，页面不横向溢出。

## 验证记录

新增5单元测试（总465），扩展授权测试覆盖list及末次范围／身份／权限／有效期变化。新增真实PG列表场景覆盖：隐藏较新记录后的满页、同周期无重漏、所有scope维度与物理站开关、租户、末次撤权／无关范围收缩、损坏及SQL异常。原快照／发布／导出PG场景保留。

首轮列表夹具错误地只期待本文件新建的5份短信报告，已有合法短信空态报告也应可见。修正为独立读取完整授权期望集合，并单独验证前5条稳定顺序；没有收窄产品或放宽权限。最终测试计数／构建／HTTP／守卫／扫描及Git SHA以收尾日志和`artifacts/formal-checkpoints/formal-report-workspace.json`为准。

合成浏览器QA通过实际React组件和本地独立夹具接口：不默认选中、首次发布已提交但返回503、同commandId重试、撤回事件CAS、重发事件3、明确发布导出、轮询结束、附件下载和精确长数值。1440×1000与390×844均无横向溢出，无pageerror；截图和HTML在忽略的artifacts/report-workspace-qa。未改用户主地图或重复稳定六场景验收，未给正式API加入测试身份。

日志`tmp/report-workspace-{unit,db,types,build,http,guards,ascii,staged-scan,browser}.log`。本包无DDL／Prisma／依赖变化，不重复已验证50表Prisma CLI或联网扫描；schema镜像及交付／SCA配置守卫仍执行。PG只用专用随机合同库，结束停本地cluster，无业务库操作；临时QA服务器收尾停止。

## 后续

接登记报告调度、机器身份与常驻worker，以及I11配置面板、I08对象分布和分层规模汇总。真实来源／平台注册、Beta环境、11万容量与3倍突发、安全恢复、业务UAT及生产批准仍未完成。没有push／PR／远端CI／外部部署或正式上线，五项目标保持active，费用预留／退服P2／陕西演示不变。
