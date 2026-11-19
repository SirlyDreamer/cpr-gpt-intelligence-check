# v1.26.0 验证记录

适配 CPR `>=3.50.0,<3.51.0`，Linux x86_64 / ARM64（aarch64）、glibc 2.36+。SDK 与官方打包工具固定至 CPR v3.50.0 提交 `68b297fc8888e359db01deb5cc59640739be5ce6`。已生成 Linux x86_64 本地测试包，尚未发布；ARM64 待构建验证。

## 合同核对

对照 [CPR v3.49.0 与 v3.50.0 官方源码](https://github.com/zyycn/codex-proxy-rs/compare/v3.49.0...v3.50.0)：

- `backend/crates/gateway-plugin/sdk`、`backend/apps/plugin-cli`、插件管理前端桥接与 `docs/plugins.md` 无差异；继续使用 manifest v2、RPC v7、管理能力 v2 和维护能力 v1。
- 账户管理 API 将 `quotaLimits` / `quotaLimitsSupported` 改为 `quotaSettings` / `quotaSettingsSupported`。插件未读取或提交这些字段；批量停用只提交 `accountIds` 和 `enabled`，移组只提交 `accountIds` 和 `groupIds`。宿主新契约规定省略 `quotaSettings` 保留原设置，因此无需修改这两条业务路径。
- URL 子路径由宿主管理前端的 API 基地址处理。插件前端 `host.request` 使用相对插件路由，Vite 使用 `base: './'`；后端 `host.http.dispatch` 直接进入宿主 API 分派端口，不经过部署反向代理，因此保留 `/api/admin/...`。
- 插件使用的账户列表、详情、分组、运维错误日志、模型目录、绑定账户模型请求及私有状态 schema 保持兼容。

## 本地验证（2026-11-17）

- Linux x86_64 测试包：Windows Rust 1.99.1 + cargo-zigbuild 0.24.1 + Zig 0.15.2，目标 `x86_64-unknown-linux-gnu.2.36`，由 SDK 同提交官方 `cpr-plugin` 打包。文件 `dist/sirly.modeltrace-health-1.26.0-x86_64-unknown-linux-gnu.tar.gz`，1,913,495 字节；SHA-256：`e7949402eecc794a544b6fc5823d211f922e13ad7147e46f1eff20bdaf9fcdff`。包内及后端嵌入的 manifest 均使用发布者 `sirly`、作者 `Sirly`。
- 最终包在 WSL Fedora Linux 43 中通过 `verify_artifact.py`：目标架构、资源摘要、前端引用及实际插件完整评分通过，18 个候选模型，无 Python/NumPy 资源。二进制引用的最高 GLIBC 版本为 2.34，未超出声明的 2.36 基线；未在 glibc 2.36 系统实机验证。
- 从最终包解出的二进制通过 9 项 Linux RPC 回归：无 Python/临时目录独立运行、绑定与幂等评分、历史分数及重启、指纹库更新/回退/重启应用、无效库拒绝、无子进程重试、旧配置兼容和订阅元数据。

- Windows / Rust 1.99.1：格式检查、单元测试、调试与 release 构建、Clippy 全目标检查通过；Linux x86_64 的交叉 `cargo check` 通过。锁文件更新 SDK 提交和版本，并移除原评分子进程、tar 解包与临时目录依赖。
- Node.js 24.22.1：按原锁文件安装前端依赖，`pnpm --dir frontend build` 类型检查和生产构建通过；`node scripts/api_smoke.mjs` 分页、快照重试和请求错误检查通过。
- 原 Python 参考实现用于生成 69 组评分与 15 组数字解析对照样本；发布与日常构建不依赖 NumPy。
- 构建脚本单元测试 2 项通过，覆盖 ELF 架构和发布资源清单；旧 Python 运行时构建与复用脚本已移除。

## 验证范围

质量历史功能追加验证：

- Rust 单元测试覆盖目标概率 × 100、当次别名映射、最后轮次、0/10/90/100 边界、缺失目标、无效概率和未完成状态；质量分数不改变原检测结论或持久化 schema。
- 新增 RPC 用例覆盖摘要、报告及进度字段一致、改动当前别名不改写历史、重启恢复和失败状态。与旧配置升级、停用/移组组合回归一起，对实际 Windows 二进制执行通过；测试传输已改为带超时队列的跨平台管道读取，未改变宿主消息或业务断言。
- 前端类型检查、生产构建及 `api_smoke.mjs` 通过，覆盖按账户分组与时间排序、颜色边界、缺失和失败数据；颜色仅取决于质量分数，不跟随降智结论。
- `ui_smoke.mjs` 全部通过，无页面异常；新增 `score_history_ui.mjs` 验证最近 20 次限制、空位、悬停、键盘切换、0 分显示、色块准确打开报告，以及浅色、深色和移动布局。账户页的「历史记录」与「最新检测结果」、检测历史页的「质量分数」与「最高候选」均已拆分为独立列，重新构建、运行完整浏览器回归并检查截图。数据来自真实插件模拟宿主结果，质量区间交互另使用浏览器测试样本；不访问真实账户。
- 新配置备份使用 `sirly.modeltrace-health`，浏览器回归确认仍可导入旧 `personal.modeltrace-health` 配置；不同插件 ID 的历史和在线指纹库不会自动迁移。

本机未执行 Linux 完整 RPC 回归、真实 CPR 宿主联调或双架构发布包验证。现有 CI 配置会在 Linux x86_64 与 ARM64 原生 runner 上构建、执行单元测试并验证最终包及 RPC 流程；本次尚未触发或确认 CI 结果。

订阅显示追加验证：

- 对照 CPR v3.50.0 的 `AccountPlanBadge.vue` 和 OpenAI 套餐显示映射，转发 `planTypeDisplay`、`authenticationKind` 与 `upstream.discovered` 的布尔结果，使用同一套宿主主题颜色；不转发上游完整对象。
- Rust 检查以及前端类型检查、构建和 API 检查通过。新增实际二进制 RPC 用例覆盖订阅显示字段、缺失字段兼容与非 OpenAI 账户保留。
- 完整浏览器回归通过，新增 `subscription_ui.mjs` 覆盖 GPT 默认范围、全部提供方切换、组合筛选、失效订阅筛选清理、宿主自定义名称、API / CPR 标记、深浅色配色与定时选项。已保存的订阅 ID 不受显示名称变化影响。

纯 Rust 引擎追加验证：

- 27 项 Rust 单元测试通过；69 组 NumPy 参考样本的最高候选和候选排序一致，概率最大绝对误差 `1.8041124150158794e-15`（容差 `1e-10`）。包含按各模型分布采样、常数、长序列、不同长度和分块边界；另核对家族概率及 15 组 Unicode/说明文字解析样本。
- 覆盖指纹方法、矩阵维度、非有限值、重复模型、校准及融合权重拒绝；所有三个校准路径离线自检。按 SHA-256 缓存最近 4 个库，在途任务保持独立 `Arc` 快照。
- Windows release 二进制为 4,715,008 字节（不是 Linux 发布包体积）。将它单独复制到空目录，清空 PATH、设置无效 Python 和临时目录后，仍完成采样和评分，且未创建其他文件。
- 用原生 release 二进制重新生成浏览器样本后，整套浏览器回归通过，无页面异常。Python/NumPy 原运行环境、Go/crane 镜像拉取与 runtime 资源已从打包路径移除；Python 标准库仅作为开发和打包辅助脚本。
- 实际 Windows 调试二进制的完整 84 项 RPC 回归通过（429 秒），另加的独立二进制隔离用例通过；release 二进制再次通过隔离执行、历史分数与重启、无效样本重试用例。在线库更新/回退、请求预算、持久化恢复及并发调度均在完整回归覆盖范围内。

## 历史验证

[1.25.0](verification-v1.25.0.md)、[1.24.0](verification-v1.24.0.md)、[1.23.0](verification-v1.23.0.md)、[1.22.0](verification-v1.22.0.md)、[1.21.0](verification-arm64.md)、[1.20.0](verification-v1.20.0.md)、[1.19.0](verification-v1.19.0.md)、[1.18.0](verification-v1.18.0.md)、[1.17.0](verification-v1.17.0.md)、[1.16.0](verification-v1.16.0.md)。
