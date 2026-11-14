# 来源配置预检的当前版本接收影响

2026-11-07，设计257，接续999／5038388。

## 交付

/settings/sources当前来源详情的变更预检增加“接收影响”。独立admin.sources.intake_impact.view，仅空库baseline登记、无角色赋权；不继承预检／来源查看／jobs.view／owner，机器拒绝。无影响权仍可用原预检权查看配置对比，但接收影响准确显示未评估，不查接收表或返回零数量。原配置完整scope必须同时在影响授权内；拟新scope仍由原预检权校验。

同一只读可重复读事务读取原当前绑定、真实资源引用、精确workspace＋bindingID＋revision关联回执和任务。各20条加1条lookahead；未做全量计数。复用receiptRow的计划／位置／应用与数据库摘要校验，以及提取的共用readIntakeTaskEvidence／readIntakeTaskHistory，校验完整任务历史。lookahead也验证；任何损坏拒绝整个响应，不返回部分成功。查询加statement_timeout。成功、missing、stale及SQL失败均末次复核预检权及已解析影响权、主体／租户／完整范围／有效期；授权后端故障不降级成0影响。

结果仅含回执ID／字符串序号／接收区间截至UTC／新增与重复条数，以及任务ID／最新事件字符串版本／状态／尝试次数。不返回manifest、原量、游标、主体和失败明细。started显示“已启动”，不冒充远端正在运行。官方DS StatusBadge及现有布局；各类明细折叠，明确“已展示／尚有更多”。空记录不等于无历史；早期版本、跨版本最新位置及聚合／报告影响仍未评估。现有草案变更取消／清旧结果、关闭销毁、403清整页、历史审计无入口保持。

无配置／位置／任务／输入写入；未终止、恢复、接收或重算。新摘要仍需受审重新基准，历史证据保留。不新建执行API，不拉来源、不验证用户声明的依据原件、不审批、不推进分析截至。67表及Prisma保持，空库DDL仅新增一permission种子，只在随机专用本机合同库应用；无业务库迁移和新依赖。

## 验证

746项全量单测通过tmp/intake-impact-unit.log；随后补owner／机器、成功路径双权限复核，15项针对测试通过tmp/intake-impact-targeted.log。双层types及production build日志见tmp/intake-impact-types.log、tmp/intake-impact-build.log。现有构建生成文件最终无内容差异。

468项实际PostgreSQL合同通过tmp/intake-impact-db.log，新增8项：permission无角色赋权；实际21条空批接收回执／22个任务含失败的有界校验和只读不变；缺完整影响权不查接收表；第21回执摘要损坏拒绝；任务绑定和第21完整历史损坏拒绝；并发真实接收时基线／回执／任务同一快照；旧版本范围更广时不查历史／不把空当前版本当无旧位置；真实影响权撤销后成功／missing／stale／SQL失败全屏蔽。同名外租户绑定及回执隔离、元数据不泄漏manifest／主体／游标一并断言。真实回执通过内部只读源夹具生成，不当真实来源验收。

60项HTTP通过tmp/intake-impact-http.log；原POST64KiB／RP／同源／no-store及GET／PUT／DELETE拒绝保持，无新路由。独立无头Chrome＋实际SourceWorkspace＋官方DS Providers，三宽普通结果及展开40条影响明细6组均无Drawer／文档横溢，应用异常／warning空。大序号和事件版本保持精确字符串；无影响权、空当前版本、更多标识、修改草案清结果、400／409／503／403、迟到隔离、关闭销毁与审计无入口通过。截图已复核，证据artifacts/intake-impact-qa/checks.json。正式三页三宽RP门槛与最终SHA／健康见formal-checkpoints/intake-impact.json；合成63334组件不注入正式63333，不当真实身份或业务验收。

文档编号、schema-mirror、SCA、delivery、ASCII／diff及staged gitleaks收尾；最终检查点为准。专用本机PG和合成组件收尾停止，保留本机63333预览。未push、外部部署、上线、新聊天或自动任务。

## 接续

本批覆盖当前来源版本的接收关联证据，不算所有下游影响或完整配置治理完成。下一优先聚合／报告实际依赖及其完整范围授权，再跨版本位置和受审重新基准、可信提交／批准契约与原件验证下写入和真实连接核验。组织主档／授权写入、规则发布、其他配置审计、原P1工作台／消息／按需接收与P2共同版本、真实来源／平台注册环境／Beta容量恢复／UAT／生产批准依赖保持。
