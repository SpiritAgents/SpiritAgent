use anyhow::{anyhow, Result};

use crate::{
    mcp::spirit_agent_data_dir,
    rewind::{self, DesktopRewindCheckpointSnapshot, RewindRestoreOutcome},
    ts_bridge::TsBridgeRuntime,
};

impl TsBridgeRuntime {
    pub fn can_rewind_message(&self, message_id: usize) -> bool {
        self.rewind.can_rewind_message(message_id)
    }

    pub fn set_todo_session_key(&mut self, session_key: &str) -> Result<()> {
        self.call_bridge(
            "hostInternal.setTodoSessionKey",
            Some(serde_json::json!({ "sessionKey": session_key })),
        )?;
        Ok(())
    }

    pub fn list_session_todos(&mut self) -> Result<Vec<rewind::HostTodoRecord>> {
        #[derive(serde::Deserialize)]
        struct HostTodoListResponse {
            todos: Vec<rewind::HostTodoRecord>,
        }
        let value = self.call_bridge("hostInternal.listSessionTodos", None)?;
        let parsed: HostTodoListResponse = serde_json::from_value(value)?;
        Ok(parsed.todos)
    }

    pub fn replace_session_todos(&mut self, records: Vec<rewind::HostTodoRecord>) -> Result<()> {
        self.call_bridge(
            "hostInternal.replaceSessionTodos",
            Some(serde_json::json!({ "records": records })),
        )?;
        Ok(())
    }

    pub fn record_rewind_checkpoint(
        &mut self,
        message_id: usize,
        message_index: usize,
        snapshot: DesktopRewindCheckpointSnapshot,
    ) -> Result<()> {
        let checkpoint = rewind::create_rewind_checkpoint_metadata(
            message_id,
            message_index,
            self.rewind.next_sequence(),
        );
        let spirit_data_dir = spirit_agent_data_dir();
        rewind::save_rewind_checkpoint_snapshot(
            &spirit_data_dir,
            &self.rewind.session_id,
            &checkpoint.id,
            &snapshot,
        )?;
        self.rewind.upsert_checkpoint(checkpoint);
        Ok(())
    }

    pub fn rewind_message(&mut self, message_id: usize) -> Result<RewindRestoreOutcome> {
        let checkpoint = self
            .rewind
            .checkpoint_for_message_id(message_id)
            .cloned()
            .ok_or_else(|| anyhow!("该消息没有可用的回溯检查点。"))?;
        let spirit_data_dir = spirit_agent_data_dir();
        let snapshot = rewind::load_rewind_checkpoint_snapshot(
            &spirit_data_dir,
            &self.rewind.session_id,
            &checkpoint.id,
        )?
        .ok_or_else(|| anyhow!("回溯检查点文件不存在，无法回溯。"))?;

        let changes_to_restore = self
            .rewind
            .file_changes
            .iter()
            .filter(|change| change.sequence > checkpoint.sequence)
            .cloned()
            .collect::<Vec<_>>();
        let mut loaded_changes = Vec::new();
        let mut warnings = Vec::new();
        for metadata in changes_to_restore {
            if let Some(stored) = rewind::load_rewind_file_change(
                &spirit_data_dir,
                &self.rewind.session_id,
                &metadata.id,
            )? {
                loaded_changes.push(stored);
            } else {
                warnings.push(rewind::HostFileRewindWarning {
                    change_id: Some(metadata.id.clone()),
                    path: metadata.resolved_path.clone(),
                    action: metadata.kind.clone(),
                    message: "文件变更快照缺失，已跳过该项回溯。".to_string(),
                });
            }
        }

        let restore_result = rewind::restore_host_file_changes(&loaded_changes)?;
        let mut outcome = rewind::resolve_before_checkpoint_state(&snapshot);
        outcome.restored = restore_result.restored;
        outcome.skipped = restore_result.skipped + warnings.len();
        outcome.warnings.extend(warnings);
        outcome.warnings.extend(restore_result.warnings);

        self.rewind.prune_after_checkpoint(checkpoint.sequence);
        self.replace_runtime_archive(&outcome.before_archive)?;
        let todos_to_restore = snapshot
            .before_todos
            .clone()
            .or(snapshot.todos.clone())
            .unwrap_or_default();
        self.replace_session_todos(todos_to_restore)?;
        Ok(outcome)
    }
}
