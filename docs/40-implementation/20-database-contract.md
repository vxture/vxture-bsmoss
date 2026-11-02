# I03 空库建库验证记录

日期：2026-10-28。I03完成：15表空库DDL、Prisma标量镜像、运行角色授权、列锁及数据库契约验证。
这不是生产部署，I04持久化适配器、平台注册、真实来源、页面和发布流水线仍未完成。

## 验证环境与证据

Windows x64、本机独立临时PostgreSQL 18.4，仅监听127.0.0.1临时端口。
测试二进制来源：@embedded-postgres/windows-x64 18.4.0-beta.17的native目录，
实际postgres --version为18.4；不是安装为Windows服务，也未连接现有业务库。
Prisma CLI固定7.8.0，pg固定8.22.0；schema validate通过。

scripts/database/contract.test.mjs每次创建随机bsmoss_contract_*数据库，
按00_baseline→97_runtime_grants→98_column_locks顺序执行，结束后删除本次创建的数据库。
只接受本机TEST_DATABASE_ADMIN_URL，未提供时失败，不默认连接DATABASE_URL。
角色由测试管理员预置为NOLOGIN、非超级用户、不能创建库/角色；不修改已有角色属性。
专用本地测试cluster可复用此角色，不能把测试初始化流程用于生产角色注册。

数据库测试共15个子检查全部通过（node:test连同父测试报告16项）：
空库建库、实际字段对照、跨租户外键、区间排斥及相邻窗、服务有效期、
并发重放、测量唯一键、来源映射一致、类型互斥/NULL、numeric上下界、
零分母及状态表示、来源验证证据、原证据不可变、模板列锁和修订链/质量外键。
运行角色测试真实SET ROLE执行，不以模拟store替代权限验证。
现有15项规则/配置单测仍独立执行。

## 重现方法

提供专用本机PostgreSQL测试cluster的管理员连接，通过环境变量TEST_DATABASE_ADMIN_URL注入。
执行pnpm test:db；仅创建及清理本次随机数据库，不重置已有库。不要把真实凭据写进仓库。
执行pnpm prisma:validate、pnpm lint:schema-mirror、pnpm type-check:all和pnpm test。
本次使用本地node入口执行相同脚本；未配置远端CI，未声称GitHub检查通过。

## 适用边界

Prisma镜像为标量字段与索引，外键/CHECK/排斥及授权由DDL拥有；未执行client生成或实现adapter。
静态检查只对照表/字段/类型/可空性；真实DB测试补充实际目录对照与关键约束，
不代表所有业务状态、负载、数据恢复、模型公式或行级查询范围已验收。
数据库服务角色是产品级身份，不是最终用户行权限。workspace/区域/主体裁剪仍由可信服务执行。
metric JSON、模板JSON、测量语义、映射生效时间、状态TTL、整数输入的原始小数拒绝需服务校验。
特别是numeric(30,0)会在入库前舍入小数，数据库边界测试不替代入站整数格式校验。
发布模板切换的业务审计与版本条件更新留给后续配置store服务。

后续任务：I04数据库store适配；不需要旧库迁移或历史数据搬迁。
