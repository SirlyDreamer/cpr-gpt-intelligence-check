# v1.26.1 验证记录

适配 CPR `>=3.50.0,<3.51.0`，Linux x86_64、glibc 2.36+。发布者 `sirly`，作者 `Sirly`，插件 ID 保持 `sirly.modeltrace-health`。本版为版本号递增，业务代码及界面与上一份 1.26.0 测试包一致。

## 本地验证（2026-11-17）

- `plugin.json`、`frontend/package.json`、`backend/Cargo.toml` 及 `backend/Cargo.lock` 中的插件版本均为 `1.26.1`，发行说明文件存在。
- 前端类型检查及生产构建通过。使用 Rust 1.99.1、cargo-zigbuild 0.24.1 和 Zig 0.15.2，重新构建 `x86_64-unknown-linux-gnu.2.36` 后端，嵌入新版本清单。
- 由 CPR v3.50.0 提交 `68b297fc8888e359db01deb5cc59640739be5ce6` 对应官方 `cpr-plugin` 生成安装包。
- 在 WSL Fedora Linux 43 中运行 `verify_artifact.py` 通过：清单版本、架构、资源摘要、前端引用和实际完整评分均通过，包含 18 个候选模型，无 Python/NumPy 运行时。
- `upgrade_smoke.py` 验证 Sirly 1.26.0 → 1.26.1 同插件 ID 升级通过：配置、计划、检测历史、指纹库及提交幂等性保留，没有重复探测。该验证使用模拟宿主状态，不代表真实 CPR 宿主联调。

## 本地测试包

文件：`dist/sirly.modeltrace-health-1.26.1-x86_64-unknown-linux-gnu.tar.gz`，1,913,466 字节。

SHA-256：`340ee7d8806285a33d3df7d14f61d5855fe6049b8eb8428517dfd012759a5d9a`。

## 验证边界

本版未重复执行上一版的完整 Rust、RPC 和浏览器回归；这些结果及功能验证见 [1.26.0 验证记录](verification-v1.26.0.md)。尚未在 glibc 2.36 系统或真实 CPR 宿主中验证，ARM64 未构建，未触发 CI 或公开发布。

旧 `personal.modeltrace-health` 与本插件 ID 不同，需另行安装并导入配置，历史及在线指纹库不会自动迁移。