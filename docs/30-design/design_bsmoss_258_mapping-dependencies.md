# 映射变更的聚合与报告依赖预览

2026-11-07，接续257。用户授权继续实际下游影响评估。

## 定位

在对象映射有效期预检中增加“下游依赖”。查当前聚合head和当前生成报告head中的明确映射引用，不声称必然受影响、不把记录清单当完整重算范围，也不只按有效期差分查部分周期。历史聚合／报告版本、已发布但不是当前生成head的报告、未发布聚合、未来新增依赖及无显式映射证据的旧记录均不覆盖。当前head不再引用时不能复活旧依赖。

本批只接映射预检。来源配置修订与这些聚合／报告没有直接binding修订证据，来源预检继续保持聚合／报告未评估，不用同sourceId冒充精确来源版本影响。接收任务及跨版本最新位置继续按既有边界，不扩大执行功能。

## 证据与范围

聚合：精确workspace＋sourceId＋规范mapped-object-v1对象身份，完整映射范围先验；SQL先过滤输出指标和实际输入指标，dependencies模式即使无输入也要求指标定义的全部依赖范围。当前input_manifest的authorityRevisions、mappingWindows／mappingPeriods或inputs必须显式引用映射ID；各20条加1条lookahead。用原interval／state／gauge纯内核从已存plan＋inputs重新计算，核对完整result、fingerprint、版本和series对象／指标／周期，验证lookahead，损坏失败，不读当前原量或发布结果。

报告：current_revision清单按manifest.requiredScope五维及物理参数完整过滤后LIMIT，不能仅因映射可见就披露整份报告。检索主数据、日级依赖及汇总成员中的明确引用；从同事务重新读存储报告，复用原manifest重建／摘要／系列元数据与scope校验，再按已知schema核对明确引用。只返回记录ID、精确字符串revision、标题或指标、粒度和分析区间，不披露主体、输入原量、manifest或摘要。

两类授权范围可能不同，独立admin.mappings.aggregate_impact.view及admin.mappings.report_impact.view；不继承映射预检、业务报告、owner或机器权。无权不查对应表、不返回0影响；范围内无记录明确不是全局无影响。空库baseline只登记两permission，不赋角色，67表／Prisma保持。

## 事务与界面

定义、重叠检查及两类依赖同一只读可重复读事务，原预检完整权限在先；成功／missing／stale／SQL失败均末次重验预检与已解析的各独立影响权、身份／租户／scope／过期。授权后端故障不降级，撤权优先屏蔽结果。POST／同源／8192字节／no-store门槛保持，无新API，无写入／标失效／重算／重生成／审批或推进截至。

使用官方DS StatusBadge及现有表单，聚合／报告各折叠列表，显示“已展示”“尚有更多”；标题下解释当前head、授权范围和完整性边界。保留取消迟到、草案变更清结果、关闭销毁及403清整页。三宽验证长ID、numeric大版本、空范围、单独授权及双无权。正式RP门槛与独立合成组件分开验收。
