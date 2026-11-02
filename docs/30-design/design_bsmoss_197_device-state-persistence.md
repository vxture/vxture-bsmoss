# 设备状态周期持久化

2026-11-02。I08内部纵向切片，沿规则／授权服务／可信快照／存储分层；承接已有状态时间线核心，不代表真实设备接入或正式查询上线。

## 来源与对象

仅支持首批字典的runtime.device.state，物理设备归属站址，不按运营商分摊。请求只给来源、映射定位、指标、粒度和时刻，不能给保持时长、完成状态或预计算结果。

唯一active且覆盖完整目标周期的已核验来源能力必须声明native_grain=event、非空validation_ref及stateAggregation={version:1,authorityRef,maxHoldMilliseconds}；保持时长限定1秒至24小时。能力与字典分类／语义／单位匹配后才读取事实。不从样例行推断来源权威。

同一设备的相关映射须覆盖整个目标周期，重复与重叠拒绝；事件映射切换允许在第17分钟等非固定网格边界。每条事实的at和validUntil须在其映射有效期内，validUntil-at不得超过核验保持时长。跨映射不能沿用旧状态。回看起点为max(周期开始-保持时长,能力生效时刻)，不借用来源权威生效以前的状态。

## 时间线与质量

SQL先确定同来源／事件／分量／指标的最高事实修订，再过滤设备映射与时间。修订移到另一设备或另一窗口后，旧值撤回，不复活旧修订。质量取每条事实的最高决定。expired／pending／rejected事件也读取，因为它们会覆盖更早的有效状态；删掉这些事件会错误延续旧running。

纯规则按事件＋分量选择事实和质量版本，拒绝冲突重放。同刻不一致状态不猜测顺序，记unknown。周期输出running／standby／fault／offline／maintenance／unknown的整数毫秒、已知转换／未知边界转换次数、末态与分段证据。所有状态时长之和严格等于目标周期时长，未知时段不折算为正常或零故障。缺少有效时间时仍返回unknown时长，完整性为missing；部分已知为partial，全已知但来源未确认是preliminary。

## 完成证明与快照

只使用source_completion_set全对象周期证明。指纹包含核验策略、能力有效期、完整映射、事件修订、最高质量、转换和原载荷摘要；证明同时绑定映射清单摘要。先读取最高对象证明再比较摘要，撤销／失效不能回退旧证明，也不回退单映射账本。确认只证明来源完成，不能补齐未知时间。

读取器单独使用REPEATABLE READ READ ONLY；由刷新执行绑定时，共享外层REPEATABLE READ，事实／能力／证明／head／发布／任务回执同一快照。并发新head导致旧执行回滚，不能把旧状态配上新head覆盖结果。

## 结果与授权

aggregate_revision新增state类型及state_value JSON，保留六态整数时长和转换数，约束拒绝缺字段、负时长、分数转换次数及混入数值列。result_payload.value须等于state_value；输入清单、结果修订与outbox保持追加。沿空库00／97／98基线，Prisma仅标量镜像，共33表，不做旧库迁移。

PgAggregateRepository封装既有CAS／重放／租约事务，interval与state适配器各自固定纯计算器并拒绝读取另一语义。state-service先校验平台metering能力、独立aggregate／view权限和workspace；适配器继续限制source／station／device／metric有限范围。

刷新协调按服务器字典语义选择读取器与存储，客户端不能指定计算器。入队、领取、执行和失败登记继续重查权限。state结果、head、outbox、成功回执与任务成功原子提交。

## 保留出口

本批没有设备协议连接器、生产机器身份、常驻扫描／worker、输入事务outbox或自动修订影响解析；也未暴露state HTTP查询。I08瞬时值持久化及跨对象权威汇总仍待办，I09正式调度及I11/I12不能标完成。保持费用预留、退服P2与陕西演示范围。
