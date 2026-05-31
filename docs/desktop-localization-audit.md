# Desktop 本地化审计

本审计用于支撑 `apps/desktop` 用户可见 UI 文本本地化收尾，并记录跨包文案的处理边界。

## Phase 1 结论

- **当前分支**：`feat/desktop-localization`，按计划在当前分支直接实施。
- **Provider 漏项**：`packages/host-internal/src/model-provider-presets.json` 的 `pickerLabels.custom` 仍是中文 `自定义`，Desktop 通过 `PROVIDER_PICKER_ROWS.label` 直接展示，导致英文 UI 漏中文。
- **Provider 消费点**：`apps/desktop/src/components/settings-view.tsx` 和 `apps/desktop/src/lib/model-picker-groups.ts` 使用 `PROVIDER_PICKER_ROWS` 生成选择器、分组标题和删除确认文案。
- **Desktop 截图漏项**：New Skill 保存位置 hint、slash command 描述、Custom Connection 协议说明、Select Provider 的 `custom` label、文件侧栏标签是优先处理对象。
- **host-internal 漏项**：`workspace-file-references.ts`、`tools.ts` 等文件包含会被宿主错误或 UI 边界展示的中文文案，需要后续区分 Desktop 用户可见、CLI/TUI 专用、模型可见与测试文本。

## 后续处理边界

- **Provider 文案**：采用 `labelKey + fallbackLabel`，`host-internal` 提供稳定 key 和英文 fallback，Desktop 通过 i18n 渲染，CLI 继续可使用 fallback。
- **Desktop UI 文案**：进入 `apps/desktop/src/locales/en.json` 和 `apps/desktop/src/locales/zh-CN.json`，调用点使用 `t(...)`。
- **共享宿主错误**：优先保留英文默认文案或逐步结构化为错误码；不把 Desktop i18n 运行时注入通用 `host-internal`。
- **非目标文本**：注释、测试输入、品牌名、协议名、快捷键和模型可见英文文本不强行本地化。
