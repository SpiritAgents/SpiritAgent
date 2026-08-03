use anyhow::Result;
use std::path::PathBuf;

use crate::{
    logging,
    mcp::spirit_agent_data_dir,
    plan,
    ports::ChatArchive,
    rewind,
    ts_bridge::{
        archive::chat_archive_to_bridge_json,
        types::bridge::{
            BridgeDrainEventsResult, BridgeManualToolCommandStartResult, BridgeRuntimeSnapshot,
        },
        TsBridgeRuntime,
    },
};

impl TsBridgeRuntime {
    pub(crate) fn sync_after_command(&mut self) -> Result<()> {
        let value = self.call_bridge("runtime.drainEvents", None)?;
        let drained: BridgeDrainEventsResult = serde_json::from_value(value)?;
        if !drained.events.is_empty() {
            logging::log_event(&format!(
                "[ts-bridge-host] drain events count={} busy={} approval={} aux={}",
                drained.events.len(),
                drained.snapshot.is_busy,
                drained.snapshot.has_pending_approval,
                drained.snapshot.pending_aux_state.is_some()
            ));
        }
        self.apply_bridge_events(drained.events);
        self.apply_snapshot(drained.snapshot);
        Ok(())
    }

    pub(crate) fn sync_snapshot_only(&mut self) -> Result<()> {
        let value = self.call_bridge("runtime.snapshot", None)?;
        self.apply_snapshot(serde_json::from_value(value)?);
        Ok(())
    }

    pub(crate) fn consume_completed_manual_tool_command_result(&mut self) -> Result<()> {
        let value = self.call_bridge("runtime.takeCompletedManualToolCommandResult", None)?;
        if value.is_null() {
            return Ok(());
        }

        let result: BridgeManualToolCommandStartResult = serde_json::from_value(value)?;
        self.handle_manual_tool_command_result(result);
        Ok(())
    }

    pub(crate) fn replace_runtime_archive(&mut self, archive: &ChatArchive) -> Result<()> {
        if self.bridge_failed {
            return Ok(());
        }
        self.sync.subagent_message_cache.clear();
        self.call_bridge(
            "runtime.replaceFromArchive",
            Some(chat_archive_to_bridge_json(archive)),
        )?;
        self.sync_snapshot_only()
    }

    pub(crate) fn record_host_file_change(&mut self, change: rewind::HostRecordedFileChange) -> Result<()> {
        if change.tool_name == "create_plan" && change.after.exists {
            self.active_plan_path = Some(PathBuf::from(change.resolved_path.clone()));
            self.plan_metadata = plan::plan_metadata_snapshot(
                self.plan_metadata.spirit_agent_mode(),
                self.active_plan_path.as_deref(),
            );
        }

        let spirit_data_dir = spirit_agent_data_dir();
        let stored = rewind::to_desktop_file_change(change, self.rewind.next_sequence());
        rewind::save_rewind_file_change(&spirit_data_dir, &self.rewind.session_id, &stored)?;
        self.rewind
            .file_changes
            .push(rewind::file_change_metadata(&stored));
        self.rewind.file_changes.sort_by_key(|entry| entry.sequence);
        Ok(())
    }

    pub(crate) fn apply_snapshot(&mut self, snapshot: BridgeRuntimeSnapshot) {
        self.sync.apply_snapshot(snapshot);
        self.flush_deferred_transport_replace();
    }

    pub(crate) fn should_poll_bridge(&self) -> bool {
        self.sync.is_busy_cache && self.sync.pending_approval_kind.is_none() && !self.sync.pending_questions_active
    }
}
