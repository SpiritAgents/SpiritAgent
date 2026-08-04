use std::{path::PathBuf, sync::Arc};

use crate::{
    model_registry::AppConfig,
    plan::PlanMetadata,
    ports::SecretStore,
    rewind,
    rules::EnabledRule,
    runtime_sync::RuntimeSyncState,
    skills::EnabledSkillCatalogEntry,
};

mod archive;
mod constants;
mod host_dispatch;
mod json_rpc;
mod runtime;
mod sync;
mod tool_ui;
pub(crate) mod transport;
mod types;

#[cfg(test)]
mod tests;

#[cfg(test)]
pub(crate) use constants::{ENV_API_KEY, ENV_RUNTIME_BACKEND_NODE_PATH};
use json_rpc::JsonRpcProcess;
pub(crate) use json_rpc::{resolve_node_path, resolve_server_entry};
pub(crate) use crate::runtime_sync::PendingApprovalKind;
pub(crate) use archive::chat_archive_to_bridge_json;
pub(crate) use tool_ui::{
    approval_decision_from_input, tool_request_from_host_value, tool_request_from_local_mcp,
    tool_request_from_streaming_preview,
};
pub(crate) use types::{
    BridgeChatArchive, BridgeExportState, BridgeManualToolCommandStartResult,
    BridgePendingApproval, BridgeRuntimeEvent, BridgeRuntimeSnapshot,
    BridgeSubagentSessionArchiveEntry, BridgeWorkspaceFileReferenceSuggestions,
    LocalMcpToolFailedEvent, LocalMcpToolResultEvent,
};
pub use types::*;

pub struct TsBridgeRuntime {
    pub(crate) process: JsonRpcProcess,
    pub(crate) config: AppConfig,
    pub(crate) secret_store: Arc<dyn SecretStore>,
    pub(crate) workspace_root: PathBuf,
    pub(crate) rewind: rewind::StoredDesktopRewindMetadata,
    pub(crate) enabled_rules: Vec<EnabledRule>,
    pub(crate) enabled_skill_catalog: Vec<EnabledSkillCatalogEntry>,
    pub(crate) plan_metadata: PlanMetadata,
    pub(crate) active_plan_path: Option<PathBuf>,
    /// Sync projection shared with the daemon backend (events/snapshot → TUI state).
    pub(crate) sync: RuntimeSyncState,
    pub(crate) bridge_failed: bool,
    /// 忙时切换模型/endpoint 已写入 `config`，但尚未对 TS `runtime.replaceConfig`；空闲后由 `flush_deferred_transport_replace` 应用。
    pub(crate) deferred_transport_replace: bool,
    /// TUI 注册的交互式工作区能力信任提示；未注册时 host 回调默认 deny。
    pub(crate) workspace_capability_trust_prompter: Option<WorkspaceCapabilityTrustPrompter>,
}

pub(crate) fn bootstrap_plan_metadata() -> PlanMetadata {
    PlanMetadata {
        path: PathBuf::new(),
        exists: false,
        agent_mode: "agent".to_string(),
        plan_mode: false,
    }
}
