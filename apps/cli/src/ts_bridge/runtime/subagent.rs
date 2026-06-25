use anyhow::Result;
use serde_json::json;

use crate::{
    ports::{SubagentSessionArchiveEntry, SubagentSessionSummary},
    ts_bridge::{types::bridge::BridgeSubagentSessionArchiveEntry, TsBridgeRuntime},
    view::{ChatMessage, PendingAssistantAux, PendingSubagentApprovalView},
};

impl TsBridgeRuntime {
    pub fn subagent_sessions(&self) -> &[SubagentSessionSummary] {
        &self.child_sessions_cache
    }

    pub fn subagent_session_archive(
        &mut self,
        session_id: &str,
    ) -> Result<Option<SubagentSessionArchiveEntry>> {
        let value = self.call_bridge(
            "runtime.subagentSessionArchive",
            Some(json!({
                "sessionId": session_id,
            })),
        )?;

        if value.is_null() {
            return Ok(None);
        }

        let archive: BridgeSubagentSessionArchiveEntry = serde_json::from_value(value)?;
        Ok(Some(SubagentSessionArchiveEntry {
            summary: SubagentSessionSummary {
                session_id: archive.summary.session_id,
                parent_tool_call_id: archive.summary.parent_tool_call_id,
                title: archive.summary.title,
                status: archive.summary.status,
                started_at_unix_ms: archive.summary.started_at_unix_ms,
                updated_at_unix_ms: archive.summary.updated_at_unix_ms,
                completed_at_unix_ms: archive.summary.completed_at_unix_ms,
                latest_message: archive.summary.latest_message,
                final_output: archive.summary.final_output,
                error: archive.summary.error,
            },
            llm_history: archive.llm_history,
        }))
    }

    pub fn subagent_pending_aux_state(
        &mut self,
        session_id: &str,
    ) -> Result<Option<PendingAssistantAux>> {
        let value = self.call_bridge(
            "runtime.subagentPendingAuxState",
            Some(json!({
                "sessionId": session_id,
            })),
        )?;

        if value.is_null() {
            return Ok(None);
        }

        Ok(Some(serde_json::from_value(value)?))
    }

    pub fn subagent_live_messages(&self, session_id: &str) -> Vec<ChatMessage> {
        self.subagent_message_cache
            .get(session_id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn pending_subagent_approval(&self) -> Option<PendingSubagentApprovalView> {
        let approval = self.current_pending_approval.as_ref()?;
        let session_id = approval.subagent_session_id.clone()?;
        Some(PendingSubagentApprovalView {
            session_id,
            session_title: approval
                .subagent_title
                .clone()
                .unwrap_or_else(|| "SubAgent".to_string()),
            tool_name: approval.tool_name.clone(),
            prompt: approval.prompt.clone(),
        })
    }
}
