use anyhow::Result;
use serde_json::Value;
use std::{path::PathBuf, sync::Arc};

use crate::{
    ask_questions::AskQuestionsResult,
    daemon::DaemonRuntime,
    host_runtime::RuntimeEvent,
    mcp::{McpScope, McpServerConfig},
    mcp_types::{
        ManagedMcpServer, McpDiscoveredPrompt, McpDiscoveredResource, McpDiscoveredTool,
        McpServerInspection,
    },
    model_registry::AppConfig,
    plan::PlanMetadata,
    ports::{
        AssistantAuxArchiveEntry, ChatArchive, McpStatusSnapshot, SecretStore,
        SubagentSessionArchiveEntry, SubagentSessionSummary,
    },
    rewind::{DesktopRewindCheckpointSnapshot, RewindRestoreOutcome},
    session::SessionModel,
    skills::ActiveSkillPayload,
    ts_bridge::{
        CliExtensionEntry, CliHostMetadataSnapshot, CliMarketplaceCatalogItem,
        CliMarketplaceDetail, CliMarketplacePreparedInstall, TsBridgeRuntime,
    },
    view::{ChatMessage, PendingAssistantAux, PendingSubagentApprovalView},
};

#[derive(Clone, Debug)]
pub struct RuntimeExportState {
    pub api_messages: Vec<Value>,
    pub system_prompts: Value,
    pub api_request_trace: Vec<Value>,
}

/// True when the CLI should embed the legacy host-bridge sidecar instead of
/// attaching to the shared daemon. Deprecated migration escape hatch.
pub(crate) fn prefer_inprocess_host() -> bool {
    std::env::var("SPIRIT_INPROCESS_HOST").ok().as_deref() == Some("1")
}

enum RuntimeBackend {
    Bridge(TsBridgeRuntime),
    Daemon(DaemonRuntime),
}

/// TUI-facing runtime handle. The default backend is the shared daemon
/// (`@spiritagent/server`); `SPIRIT_INPROCESS_HOST=1` selects the legacy
/// in-process host-bridge sidecar during the migration window.
pub struct RuntimeHandle {
    backend: RuntimeBackend,
}

macro_rules! dispatch {
    ($self:ident . $method:ident ( $($arg:expr),* $(,)? )) => {
        match &mut $self.backend {
            RuntimeBackend::Bridge(runtime) => runtime.$method($($arg),*),
            RuntimeBackend::Daemon(runtime) => runtime.$method($($arg),*),
        }
    };
}

macro_rules! dispatch_ref {
    ($self:ident . $method:ident ( $($arg:expr),* $(,)? )) => {
        match &$self.backend {
            RuntimeBackend::Bridge(runtime) => runtime.$method($($arg),*),
            RuntimeBackend::Daemon(runtime) => runtime.$method($($arg),*),
        }
    };
}

impl RuntimeHandle {
    pub fn new(
        config: AppConfig,
        secret_store: Arc<dyn SecretStore>,
        workspace_root: PathBuf,
    ) -> Result<Self> {
        if prefer_inprocess_host() {
            return Ok(Self {
                backend: RuntimeBackend::Bridge(TsBridgeRuntime::new(
                    config,
                    secret_store,
                    workspace_root,
                )?),
            });
        }
        Ok(Self {
            backend: RuntimeBackend::Daemon(DaemonRuntime::new(config, secret_store, workspace_root)?),
        })
    }

    pub fn config(&self) -> &AppConfig {
        dispatch_ref!(self.config())
    }

    pub fn validate_config_change(&self, config: &AppConfig) -> Result<()> {
        dispatch_ref!(self.validate_config_change(config))
    }

    pub fn replace_config(&mut self, config: AppConfig) {
        dispatch!(self.replace_config(config))
    }

    pub fn store_config(&mut self, config: AppConfig) {
        dispatch!(self.store_config(config))
    }

    pub fn set_llm_http_version(&mut self, llm_http_version: &str) -> Result<()> {
        dispatch!(self.set_llm_http_version(llm_http_version))
    }

    pub fn replace_plan_metadata(&mut self, metadata: PlanMetadata) {
        dispatch!(self.replace_plan_metadata(metadata))
    }

    pub fn activate_skill(&mut self, skill: ActiveSkillPayload) -> Result<()> {
        dispatch!(self.activate_skill(skill))
    }

    pub fn load_cli_host_metadata(&mut self, agent_mode: &str) -> Result<CliHostMetadataSnapshot> {
        dispatch!(self.load_cli_host_metadata(agent_mode))
    }

    pub fn load_plan_metadata(&mut self, agent_mode: &str) -> Result<PlanMetadata> {
        dispatch!(self.load_plan_metadata(agent_mode))
    }

    pub fn has_active_plan(&self) -> bool {
        dispatch_ref!(self.has_active_plan())
    }

    pub fn active_plan_path(&self) -> Option<&std::path::Path> {
        dispatch_ref!(self.active_plan_path())
    }

    pub fn list_workspace_file_reference_suggestions(
        &mut self,
        input: &str,
        cursor_chars: usize,
    ) -> Result<(Vec<String>, bool)> {
        dispatch!(self.list_workspace_file_reference_suggestions(input, cursor_chars))
    }

    pub fn prime_workspace_file_reference_index(&mut self) -> Result<()> {
        dispatch!(self.prime_workspace_file_reference_index())
    }

    pub fn write_rule_state(
        &mut self,
        enabled_overrides: std::collections::BTreeMap<String, bool>,
    ) -> Result<PathBuf> {
        dispatch!(self.write_rule_state(enabled_overrides))
    }

    pub fn write_skill_state(
        &mut self,
        enabled_overrides: std::collections::BTreeMap<String, bool>,
    ) -> Result<PathBuf> {
        dispatch!(self.write_skill_state(enabled_overrides))
    }

    pub fn reload_host_metadata(&mut self, agent_mode: &str) -> Result<()> {
        dispatch!(self.reload_host_metadata(agent_mode))
    }

    pub fn list_extensions(&mut self) -> Result<Vec<CliExtensionEntry>> {
        dispatch!(self.list_extensions())
    }

    pub fn import_extension_archive(
        &mut self,
        archive_bytes: &[u8],
        file_name: Option<&str>,
    ) -> Result<CliExtensionEntry> {
        dispatch!(self.import_extension_archive(archive_bytes, file_name))
    }

    pub fn delete_extension(&mut self, id: &str) -> Result<()> {
        dispatch!(self.delete_extension(id))
    }

    pub fn list_marketplace_extensions(&mut self) -> Result<Vec<CliMarketplaceCatalogItem>> {
        dispatch!(self.list_marketplace_extensions())
    }

    pub fn get_marketplace_extension_detail(
        &mut self,
        extension_id: &str,
    ) -> Result<CliMarketplaceDetail> {
        dispatch!(self.get_marketplace_extension_detail(extension_id))
    }

    pub fn get_marketplace_extension_readme(&mut self, extension_id: &str) -> Result<String> {
        dispatch!(self.get_marketplace_extension_readme(extension_id))
    }

    pub fn prepare_marketplace_extension_install(
        &mut self,
        extension_id: &str,
        version: Option<&str>,
    ) -> Result<CliMarketplacePreparedInstall> {
        dispatch!(self.prepare_marketplace_extension_install(extension_id, version))
    }

    pub fn install_marketplace_extension(
        &mut self,
        extension_id: &str,
        version: Option<&str>,
        review_acknowledged: bool,
    ) -> Result<CliExtensionEntry> {
        dispatch!(self.install_marketplace_extension(extension_id, version, review_acknowledged))
    }

    pub fn session(&self) -> &SessionModel {
        dispatch_ref!(self.session())
    }

    pub fn export_llm_state(&mut self) -> Result<RuntimeExportState> {
        dispatch!(self.export_llm_state())
    }

    pub fn export_chat_archive(
        &mut self,
        messages: &[(String, String)],
        assistant_aux: &[AssistantAuxArchiveEntry],
    ) -> Result<ChatArchive> {
        dispatch!(self.export_chat_archive(messages, assistant_aux))
    }

    pub fn mcp_status_snapshot(&mut self) -> McpStatusSnapshot {
        dispatch!(self.mcp_status_snapshot())
    }

    pub fn subagent_sessions(&self) -> &[SubagentSessionSummary] {
        dispatch_ref!(self.subagent_sessions())
    }

    pub fn subagent_session_archive(
        &mut self,
        session_id: &str,
    ) -> Result<Option<SubagentSessionArchiveEntry>> {
        dispatch!(self.subagent_session_archive(session_id))
    }

    pub fn subagent_live_messages(&self, session_id: &str) -> Vec<ChatMessage> {
        dispatch_ref!(self.subagent_live_messages(session_id))
    }

    pub fn subagent_pending_aux_state(
        &mut self,
        session_id: &str,
    ) -> Result<Option<PendingAssistantAux>> {
        dispatch!(self.subagent_pending_aux_state(session_id))
    }

    pub fn pending_subagent_approval(&self) -> Option<PendingSubagentApprovalView> {
        dispatch_ref!(self.pending_subagent_approval())
    }

    pub fn has_pending_tool_approval(&self) -> bool {
        dispatch_ref!(self.has_pending_tool_approval())
    }

    pub fn is_busy(&self) -> bool {
        dispatch_ref!(self.is_busy())
    }

    pub fn loop_enabled(&self) -> bool {
        dispatch_ref!(self.loop_enabled())
    }

    pub fn set_loop_enabled(&mut self, enabled: bool) -> Result<()> {
        dispatch!(self.set_loop_enabled(enabled))
    }

    pub fn approval_level(&self) -> &str {
        dispatch_ref!(self.approval_level())
    }

    pub fn set_approval_level(&mut self, approval_level: &str) -> Result<()> {
        dispatch!(self.set_approval_level(approval_level))
    }

    pub fn abort(&mut self) {
        dispatch!(self.abort())
    }

    pub fn continue_assistant_completion(&mut self) -> Result<()> {
        dispatch!(self.continue_assistant_completion())
    }

    pub fn drain_events(&mut self) -> Vec<RuntimeEvent> {
        dispatch!(self.drain_events())
    }

    pub fn pending_aux_state(&self) -> Option<PendingAssistantAux> {
        dispatch_ref!(self.pending_aux_state())
    }

    pub fn tick_thinking_spinner(&mut self) {
        dispatch!(self.tick_thinking_spinner())
    }

    pub fn poll(&mut self) {
        dispatch!(self.poll())
    }

    pub fn handle_stream_stall_timeout(&mut self) {
        dispatch!(self.handle_stream_stall_timeout())
    }

    pub fn can_rewind_message(&self, message_id: usize) -> bool {
        dispatch_ref!(self.can_rewind_message(message_id))
    }

    pub fn record_rewind_checkpoint(
        &mut self,
        message_id: usize,
        message_index: usize,
        snapshot: DesktopRewindCheckpointSnapshot,
    ) -> Result<()> {
        dispatch!(self.record_rewind_checkpoint(message_id, message_index, snapshot))
    }

    pub fn rewind_message(&mut self, message_id: usize) -> Result<RewindRestoreOutcome> {
        dispatch!(self.rewind_message(message_id))
    }

    pub fn set_todo_session_key(&mut self, session_key: &str) -> Result<()> {
        dispatch!(self.set_todo_session_key(session_key))
    }

    pub fn list_session_todos(&mut self) -> Result<Vec<crate::rewind::HostTodoRecord>> {
        dispatch!(self.list_session_todos())
    }

    pub fn submit_user_turn(
        &mut self,
        text: String,
        explicit_images: Option<Vec<String>>,
    ) -> Result<()> {
        dispatch!(self.submit_user_turn(text, explicit_images))
    }

    pub fn list_mcp_servers(&mut self) -> Result<Vec<ManagedMcpServer>> {
        dispatch!(self.list_mcp_servers())
    }

    pub fn list_hook_entries(&mut self) -> Result<Vec<crate::hooks_types::HookListItem>> {
        dispatch!(self.list_hook_entries(None))
    }

    pub fn save_hook_entry(
        &mut self,
        workspace_binding: Option<&str>,
        request: &crate::hooks_types::SaveHookEntryRequest,
    ) -> Result<()> {
        dispatch!(self.save_hook_entry(workspace_binding, request))
    }

    pub fn inspect_mcp_server(&mut self, name: &str) -> Result<McpServerInspection> {
        dispatch!(self.inspect_mcp_server(name))
    }

    pub fn list_mcp_tools(&mut self, name: &str) -> Result<Vec<McpDiscoveredTool>> {
        dispatch!(self.list_mcp_tools(name))
    }

    pub fn list_mcp_resources(&mut self, name: &str) -> Result<Vec<McpDiscoveredResource>> {
        dispatch!(self.list_mcp_resources(name))
    }

    pub fn list_mcp_prompts(&mut self, name: &str) -> Result<Vec<McpDiscoveredPrompt>> {
        dispatch!(self.list_mcp_prompts(name))
    }

    pub fn list_cached_mcp_prompts(&mut self, name: &str) -> Result<Vec<McpDiscoveredPrompt>> {
        dispatch!(self.list_cached_mcp_prompts(name))
    }

    pub fn attach_mcp_resource(&mut self, server: &str, uri: &str) -> Result<String> {
        dispatch!(self.attach_mcp_resource(server, uri))
    }

    pub fn clear_pending_mcp_resources(&mut self) -> usize {
        dispatch!(self.clear_pending_mcp_resources())
    }

    pub fn apply_mcp_prompt(
        &mut self,
        server: &str,
        prompt: &str,
        args_json: Option<&str>,
        user_message: Option<&str>,
    ) -> Result<String> {
        dispatch!(self.apply_mcp_prompt(server, prompt, args_json, user_message))
    }

    pub fn add_mcp_server(&mut self, scope: McpScope, name: &str, config: McpServerConfig) -> Result<PathBuf> {
        dispatch!(self.add_mcp_server(scope, name, config))
    }

    pub fn execute_mcp_tool(
        &mut self,
        server: &str,
        tool_name: &str,
        args_json: Option<&str>,
    ) -> Result<()> {
        dispatch!(self.execute_mcp_tool(server, tool_name, args_json))
    }

    pub fn respond_to_pending_tool_approval(&mut self, message: &str) {
        dispatch!(self.respond_to_pending_tool_approval(message))
    }

    pub fn respond_to_pending_questions(&mut self, result: &AskQuestionsResult) {
        dispatch!(self.respond_to_pending_questions(result))
    }

    pub fn execute_manual_tool_command(&mut self, message: &str) {
        dispatch!(self.execute_manual_tool_command(message))
    }

    pub fn compact_history(&mut self) {
        dispatch!(self.compact_history())
    }

    pub fn replace_session_from_archive(&mut self, archive: &crate::ports::ChatArchive) {
        dispatch!(self.replace_session_from_archive(archive))
    }

    pub fn activate_forked_session(
        &mut self,
        archive: &crate::ports::ChatArchive,
        todos: Vec<crate::rewind::HostTodoRecord>,
    ) -> Result<()> {
        dispatch!(self.activate_forked_session(archive, todos))
    }

    pub fn reset_session(&mut self) -> Result<()> {
        dispatch!(self.reset_session())
    }

    pub fn run_session_start(&mut self, source: &str) -> Result<()> {
        dispatch!(self.run_session_start(source))
    }

    pub fn set_workspace_capability_trust_prompter(
        &mut self,
        prompter: Option<crate::ts_bridge::WorkspaceCapabilityTrustPrompter>,
    ) {
        dispatch!(self.set_workspace_capability_trust_prompter(prompter))
    }

    pub fn has_workspace_capability_trust_prompter(&self) -> bool {
        dispatch_ref!(self.has_workspace_capability_trust_prompter())
    }

    pub fn add_pending_image(&mut self, path: String) {
        dispatch!(self.add_pending_image(path))
    }

    pub fn clear_pending_images(&mut self) -> usize {
        dispatch!(self.clear_pending_images())
    }
}
