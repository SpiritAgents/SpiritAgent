use std::{
    collections::{HashMap, VecDeque},
    path::PathBuf,
    sync::Arc,
};

use crate::{
    host_runtime::RuntimeEvent,
    model_registry::AppConfig,
    plan::PlanMetadata,
    ports::{SecretStore, SubagentSessionSummary},
    rewind,
    rules::EnabledRule,
    session::SessionModel,
    skills::EnabledSkillCatalogEntry,
    view::{ChatMessage, PendingAssistantAux},
};

mod archive;
mod constants;
mod host_dispatch;
mod json_rpc;
mod runtime;
mod sync;
mod tool_ui;
mod transport;
mod types;

#[cfg(test)]
mod tests;

#[cfg(test)]
pub(crate) use constants::{ENV_API_KEY, ENV_RUNTIME_BACKEND_NODE_PATH};
use json_rpc::JsonRpcProcess;
pub use types::*;
use types::bridge::BridgePendingApproval;

pub struct TsBridgeRuntime {
    pub(crate) process: JsonRpcProcess,
    pub(crate) config: AppConfig,
    pub(crate) secret_store: Arc<dyn SecretStore>,
    pub(crate) workspace_root: PathBuf,
    pub(crate) session: SessionModel,
    pub(crate) rewind: rewind::StoredDesktopRewindMetadata,
    pub(crate) enabled_rules: Vec<EnabledRule>,
    pub(crate) enabled_skill_catalog: Vec<EnabledSkillCatalogEntry>,
    pub(crate) plan_metadata: PlanMetadata,
    pub(crate) active_plan_path: Option<PathBuf>,
    pending_aux_state: Option<PendingAssistantAux>,
    pub(crate) pending_approval_kind: Option<PendingApprovalKind>,
    pub(crate) current_pending_approval: Option<BridgePendingApproval>,
    pub(crate) pending_questions_active: bool,
    pub(crate) pending_assistant_has_output: bool,
    pub(crate) is_busy_cache: bool,
    pub(crate) child_sessions_cache: Vec<SubagentSessionSummary>,
    pub(crate) subagent_message_cache: HashMap<String, Vec<ChatMessage>>,
    pub(crate) events: VecDeque<RuntimeEvent>,
    pub(crate) bridge_failed: bool,
    /// 忙时切换模型/endpoint 已写入 `config`，但尚未对 TS `runtime.replaceConfig`；空闲后由 `flush_deferred_transport_replace` 应用。
    pub(crate) deferred_transport_replace: bool,
    /// TUI 注册的交互式工作区能力信任提示；未注册时 host 回调默认 deny。
    pub(crate) workspace_capability_trust_prompter: Option<WorkspaceCapabilityTrustPrompter>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PendingApprovalKind {
    Tool,
    Manual,
}

pub(crate) fn bootstrap_plan_metadata() -> PlanMetadata {
    PlanMetadata {
        path: PathBuf::new(),
        exists: false,
        agent_mode: "agent".to_string(),
        plan_mode: false,
    }
}
