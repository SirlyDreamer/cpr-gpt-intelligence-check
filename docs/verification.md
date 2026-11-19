# v1.27.0 验证记录

适配 CPR `>=3.52.1,<3.53.0`，Linux x86_64、glibc 2.36+。发布者 `sirly`，作者 `Sirly`，插件 ID 保持 `sirly.modeltrace-health`。本版同步上游 API / SDK 与 UI，并跳过暂停账户的模型检测；API 变更按次版本递增规则使用 1.27.0。

## 合同核对

- SDK 与官方打包工具固定至 [CPR v3.52.1](https://github.com/zyycn/codex-proxy-rs/releases/tag/v3.52.1) 提交 `1173f6263da46fabab4715f774d00ceac38e15d3`。相比 3.50.0，SDK 新增额度历史查询和 scheduler v4；本插件不使用这两项能力，继续使用 manifest v2、RPC v7、management v2、maintenance v1。打包器源码未变。
- [CPR 3.52.0](https://github.com/zyycn/codex-proxy-rs/releases/tag/v3.52.0) 将使用记录查询参数 `accountName` 改为 `accountSearch`。插件不调用 `/api/admin/usage/records`；日志触发仍调用 `/api/admin/operations/errors`。
- UI 组件库从 0.8.0 升至 0.12.0，锁文件同步；套餐备用名称和长标签换行对照 3.52.1 的 OpenAI `plan_type_display` 与 `AccountPlanBadge.vue`。
- 账户列表及详情的 `enabled=false`、`status=disabled` 或 `status=quota_paused` 判为暂停。已排队任务每次请求前读取账户详情，暂停时完成为 `paused`；缺少关键状态字段时停止发起请求。额度耗尽、限流保持原有语义。

## 本地验证（2026-11-19）

- Rust 格式检查、27 项单元测试、Clippy 全目标检查及 Windows 调试构建通过。
- 本次业务代码的 Linux release 二进制通过完整 90 项 RPC 回归，耗时 420 秒。覆盖手动提交、排队后暂停、失败重试前暂停、确认复测前暂停、定时及日志触发跳过；同时覆盖并发、取消、预算、持久化和指纹库更新。
- 确定最终版本为 1.27.0 后重新构建 Linux release 二进制，5 项暂停拦截 RPC 再次通过。暂停状态只读宿主账户元数据，模型调用计数不增加，不消耗新的尝试；恢复后可以重新提交检测。
- 前端类型检查、生产构建、API / 分数 / 套餐映射检查及完整浏览器回归通过，无页面异常。覆盖暂停按钮禁用、失败提示覆盖、历史保留、状态恢复、Business Premium / Academic Researchers Plus 换行及深浅色和窄屏布局。
- 2 项构建脚本测试通过，许可证清单重新生成。插件、Rust、Cargo 锁文件及前端版本一致。
- 最终包通过 WSL Fedora Linux 43 的 `verify_artifact.py`：清单版本、架构、资源摘要、页面引用和实际完整评分通过，18 个候选模型，无 Python/NumPy 运行时。
- 最终包通过 `upgrade_smoke.py` 的 Sirly 1.26.1 → 1.27.0 升级检查，配置、计划、历史、指纹库及提交幂等性保留，没有重复探测。
- 推送前清理临时源码与编译缓存、废弃运行时目录，修正本仓库文档入口与 UI 0.12.0 许可标注。再次通过 27 项 Rust 单元测试、格式检查、前端类型检查、API / 分数映射和 2 项构建脚本测试；更新许可后的安装包重新通过 Linux 归档与实际评分检查。

## 本地测试包

文件：`dist/sirly.modeltrace-health-1.27.0-x86_64-unknown-linux-gnu.tar.gz`，1,917,720 字节。

SHA-256：`2c5e1b178b5c42166e8fbedf3ab52117f45d3bfe106ef46212e56bbf42d38ea3`。

使用 Rust 1.99.1、cargo-zigbuild 0.24.1、Zig 0.15.2 构建 `x86_64-unknown-linux-gnu.2.36`，由与 SDK 同提交的官方打包器生成。

## 验证边界

检查使用模拟宿主和模拟账户，不访问真实账户。尚未在真实 CPR 宿主或 glibc 2.36 系统中实机验证；ARM64 本地未构建。本文记录本地验证结果；推送后的 CI 状态以 GitHub Actions 为准，尚未创建公开 Release。

原 `personal.modeltrace-health` 属于另一插件 ID，仍需另行安装并导入配置，历史及在线指纹库不会自动迁移。

前版记录：[1.26.1](verification-v1.26.1.md)、[1.26.0](verification-v1.26.0.md)。
