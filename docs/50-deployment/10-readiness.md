# 部署准备条件

当前业务系统未部署。新产品仅需空库初始化，不需旧库迁移。
空库基线及角色/列权限已在独立本机PostgreSQL18.4验证，Prisma校验通过，
详见[数据库验证记录](../40-implementation/20-database-contract.md)。

上线前仍需确认端口、域名、OIDC客户端、C2商业权益与产品能力矩阵、C3产品注册、生产服务身份及密钥，
完成真实平台联调、业务worker及上线验收。C1/C2/C3 adapter、CI、db-init和受保护发布配置已落库，
见[适配记录](../40-implementation/60-yucer-alignment.md)及[交付说明](30-delivery-runbook.md)。
不得复用yucer运行端口或凭据。
本机契约测试不是Beta或生产初始化；生产仅执行空库00→97→98并核验独立权限。
