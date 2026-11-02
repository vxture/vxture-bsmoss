# 聚合worker与提交权限闭环

设计见[215](../30-design/design_bsmoss_215_aggregate-worker-loop.md)，接续ffa5801。I09／I12保持in_progress。

## 实施

新增refresh-access：依据可信snapshot的规范稳定对象元组和实际inputMode，于executeRefreshLease提交前重解真实身份／权益／aggregate权限和必要scope。原主体／租户及原、新有效期都需满足；direct比率不要求未使用依赖，derived／dependencies要求真实输入。无关范围收缩可成功，物理站独立开关不可替代。

新增aggregate-worker和严格配置规则，最多32登记，独立周期／变化和可选结果通道，固定真实机器租户主体、有限轮询／独立退避／公平轮转。复用登记和三语义服务，无Next后台timer或生产身份伪造。runRefreshStep支持claim边界停止，授权错误不转失败回执；结果观察保留failure_recorded中性状态。

无DDL／Prisma、依赖或UI变化，沿用55表空库和既有视觉验收。

## 验证

先以实际PG新增写后撤权回归，修复前准确出现Missing expected rejection，日志tmp/aggregate-worker-regression.log；修复后原合同测试通过。扩展四种值语义逐维撤权、原授权过期／身份切换、无关scope收缩、派生依赖和站级开关，以及暂停／闭环／重启／三个停机边界／授权失败无回执。

扩展夹具最初误用不存在的能耗code，并把PG numeric字符串attempt当number；改成真实字典code和明确边界转换。复用旧能耗来源又遇到既有两个合法capability的歧义，改独立来源／物理站映射／单一受审capability，不放宽产品歧义拒绝规则。类型检查提示输入联合含quarantined／deferred，补明确dead／delayed映射；结果failure_recorded不一概称retry。

最终476单测／266实际PG（265子项＋父项，新增6）／双层类型／生产构建／20HTTP通过；103篇编号文档／55表镜像／交付／SCA守卫通过。ASCII／密钥扫描及日志SHA／预览见artifacts/formal-checkpoints/aggregate-worker-loop.json。只用专用随机合同库，收尾停PG；预览恢复本包SHA，正式匿名读写继续拒绝。

## 后续

真实机器provider／托管宿主、失败回执末次授权审计、持久监控／受审恢复、历史报告变化传播、I11配置面板与I08分布／分层规模。真实来源、平台注册、Beta／容量／安全恢复／UAT和生产批准继续独立验收。五项1–3本地完成、4–5推进；未push、未PR、未远端CI、未外部部署或上线。
