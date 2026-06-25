use serde_json::{Value, json};

use crate::{
    llm_types::LlmMessage,
    ports::{ArchivedLlmMessage, ArchivedLlmToolCall},
};

pub(crate) fn llm_history_to_json(history: &[LlmMessage]) -> Vec<Value> {
    history
        .iter()
        .map(|message| {
            archived_llm_message_to_json(
                &ArchivedLlmMessage::from_text_and_images(
                    message.role.to_string(),
                    message.content.clone(),
                    message.image_paths.clone(),
                )
                .with_tool_call_id(message.tool_call_id.clone())
                .with_tool_calls(message.tool_calls.as_ref().map(|tool_calls| {
                    tool_calls
                        .iter()
                        .map(|tool_call| ArchivedLlmToolCall {
                            id: tool_call.id.clone(),
                            name: tool_call.name.clone(),
                            arguments_json: tool_call.arguments_json.clone(),
                        })
                        .collect()
                }))
                .with_provider_state(message.provider_state.clone()),
            )
        })
        .collect()
}

pub(crate) fn archived_llm_message_to_json(message: &ArchivedLlmMessage) -> Value {
    let mut value = json!({
        "role": message.role,
        "content": message.content,
    });

    if let Some(tool_call_id) = &message.tool_call_id {
        if let Some(object) = value.as_object_mut() {
            object.insert(
                "toolCallId".to_string(),
                Value::String(tool_call_id.clone()),
            );
        }
    }

    if let Some(tool_calls) = &message.tool_calls {
        if let Some(object) = value.as_object_mut() {
            object.insert(
                "toolCalls".to_string(),
                serde_json::to_value(tool_calls).unwrap_or(Value::Null),
            );
        }
    }

    if let Some(provider_state) = &message.provider_state {
        if let Some(object) = value.as_object_mut() {
            object.insert("providerState".to_string(), provider_state.clone());
        }
    }

    value
}


pub(crate) fn chat_archive_to_bridge_json(archive: &crate::ports::ChatArchive) -> Value {
    let mut value = json!({
        "messages": archive.messages.iter().map(|(role, content)| {
            json!({
                "role": role,
                "content": content,
            })
        }).collect::<Vec<_>>(),
        "assistantAux": archive.assistant_aux.iter().map(|entry| {
            json!({
                "messageIndex": entry.message_index,
                "thinking": entry.thinking,
                "compaction": entry.compaction,
                "finishTaskNotice": entry.finish_task_notice,
            })
        }).collect::<Vec<_>>(),
        "llmHistory": archive.llm_history.iter().map(archived_llm_message_to_json).collect::<Vec<_>>(),
        "loopEnabled": archive.loop_enabled,
        "approvalLevel": archive.approval_level,
        "subagentSessions": archive.subagent_sessions.iter().map(|entry| {
            json!({
                "summary": {
                    "sessionId": entry.summary.session_id,
                    "parentToolCallId": entry.summary.parent_tool_call_id,
                    "title": entry.summary.title,
                    "status": entry.summary.status,
                    "startedAtUnixMs": entry.summary.started_at_unix_ms,
                    "updatedAtUnixMs": entry.summary.updated_at_unix_ms,
                    "completedAtUnixMs": entry.summary.completed_at_unix_ms,
                    "latestMessage": entry.summary.latest_message,
                    "finalOutput": entry.summary.final_output,
                    "error": entry.summary.error,
                },
                "llmHistory": entry.llm_history.iter().map(archived_llm_message_to_json).collect::<Vec<_>>(),
            })
        }).collect::<Vec<_>>(),
    });

    if let Some(rewind) = &archive.rewind {
        if let Some(object) = value.as_object_mut() {
            object.insert("rewind".to_string(), rewind.clone());
        }
    }

    value
}
