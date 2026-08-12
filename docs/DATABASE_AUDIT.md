# 当前数据结构审计

## 1. 审计基线

本审计以当前 `server/data/db.json`、`server/src/store.js`、`server/src/api.js` 和已通过测试为准。产品文档中的未来字段不自动进入数据库。

## 2. JSON 集合到 MySQL

| JSON 集合 | MySQL 表 | 主关联 |
| --- | --- | --- |
| `users` | `app_users` | 微信身份、账号、角色与资料状态 |
| `parentProfiles` | `parent_profiles` | `userId -> users.id` |
| `teachers` | `teachers` | `userId -> users.id` |
| `teacherSubjects` | `teacher_subjects` | `teacherId -> teachers.id` |
| `teacherCertifications` | `teacher_certifications` | `teacherId -> teachers.id` |
| `parentRequirements` | `parent_requirements` | `parentUserId -> users.id` |
| `orders` | `tutor_orders` | 家长用户与老师 |
| `orderStatusLogs` | `order_status_logs` | `orderId -> orders.id` |
| `reviews` | `reviews` | 订单、家长、老师 |
| `complaints` | `complaints` | 订单、投诉双方、处理管理员 |
| `unlockRecords` | `unlock_records` | 购买用户与解锁目标 |
| `paymentOrders` | `payment_orders` | 购买用户、目标与支付占位状态 |
| `contactLogs` | `contact_logs` | 用户与已联系目标 |
| `phoneVerifications` | `phone_verifications` | 手机验证风控 |
| `admins` | `admin_users` | 管理员账号 |
| `adminLoginTickets` | `admin_login_tickets` | 管理员一次性登录票据 |
| `tokenRevocations` | `token_revocations` | 用户/管理员退出登录撤销 |
| `operationLogs` | `admin_operation_logs` | 管理操作和系统通知日志 |
| `frontendConfigs` | `frontend_configs` | 首页、字典、推荐配置 |
| `uploadedFiles` | `uploaded_files` | 上传文件元数据 |

## 3. 关键状态兼容值

- 用户：`normal`、`frozen`、`banned`。
- 资料：`pending_role`、`pending_profile`、`completed`。
- 老师审核：`not_submitted`、`pending`、`approved`、`rejected`、`rechecking`、`banned`。
- 接单：`available`、`paused`。
- 订单：`pending_teacher`、`pending_class`、`in_class`、`pending_parent_confirm`、`completed`、`canceled`、`rejected`、`complaint`、`closed`。
- 投诉：`pending`、`processing`、`resolved`。
- 支付和解锁沿用当前 API 已写入值，不在本轮改变业务规则。

## 4. 命名与历史兼容

- JSON 使用 camelCase，MySQL 使用 snake_case，由 `table-definitions.js` 统一映射。
- `admins` 同时存在 `status/accountStatus` 和 `lastLoginAt/lastLoginTime`，本轮保留两组字段兼容现有 API，不静默删除。
- 金额在 JSON/API 中仍使用元，在 MySQL 中映射为 `*_cents` 整数分。
- 数组和对象在 MySQL 使用 JSON 列。
- 时间继续保存为统一 ISO 8601 文本，保持接口返回兼容。
- 可选唯一字段的空字符串写入 MySQL 时转换为 `NULL`，避免多个未绑定账号发生唯一索引冲突。

## 5. 原 schema.sql 缺口

原结构未覆盖家长需求、订单状态日志、解锁记录、支付单、联系记录、手机号验证、前端配置、管理员操作日志、上传文件元数据、迁移版本、序列和事务锁；部分表名及字段名与当前 Store 不一致。本轮已按当前运行行为补齐。
