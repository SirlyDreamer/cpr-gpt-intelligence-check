# 第三方组件

本插件仅使用 ModelTrace 检测方法；没有集成 Meow 检测器。

- ModelTrace： https://github.com/xqy2006/ModelTrace ，MIT。算法已移植为 Rust；固定提交和数据来源见源码 `vendor/modeltrace/SOURCE.json`，原许可证见同目录 `LICENSE` 并收录于 `THIRD_PARTY.txt`。
- Codex Proxy RS SDK： https://github.com/zyycn/codex-proxy-rs ，Apache-2.0。固定提交见 `backend/Cargo.toml`。
- 订阅标签的配色、显示规则与 CPR 品牌图形参考或改编自 Codex Proxy RS v3.52.1 的 `AccountPlanBadge.vue`、`AppBrandMark.vue` 与 OpenAI 套餐显示映射，Apache-2.0；插件适配为宿主主题变量与精简账户字段。Apache-2.0 完整许可文本见 `THIRD_PARTY.txt`。
- @codex-proxy/ui： https://github.com/zyycn/codex-proxy-ui ，使用 0.12.0 发布包。
- Vue： https://github.com/vuejs/core ，MIT。
- Lucide： https://github.com/lucide-icons/lucide ，ISC。
- 发布包不再包含 CPython、NumPy 或其原生运行库；Python 参考实现仅用于开发时的结果对照。
- UI 构建配置参考 rs-reauth-manager，MIT，Copyright (c) 2026 Lemon-57。原许可证附于下文。

请求接口用法参考 https://github.com/R-lmmortal/codex-model-health-plugin ，未复制该项目代码或非商业许可检测器。

MIT License

Copyright (c) 2026 Lemon-57

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
