use crate::{
    ports::{AssistantAuxArchiveEntry, ArchivedLlmMessage, ChatArchive},
    rewind::{self, ConversationMessageRole, ConversationMessageSnapshot},
};

/// Stackable fork title: `My Chat` → `(1) My Chat` → `(2) My Chat`.
pub fn derive_forked_session_display_name(source_display_name: &str) -> String {
    let trimmed = source_display_name.trim();
    if let Some(rest) = trimmed.strip_prefix('(') {
        if let Some(close_paren) = rest.find(')') {
            let number_text = rest[..close_paren].trim();
            if let Ok(current) = number_text.parse::<u32>() {
                let base = rest[close_paren + 1..].trim_start();
                return format!("({}) {}", current + 1, base);
            }
        }
    }
    format!("(1) {}", source_display_name)
}

pub fn resolve_fork_anchor_index(
    messages: &[ConversationMessageSnapshot],
    message_id: usize,
) -> Option<usize> {
    let index = messages
        .iter()
        .position(|message| message.id == message_id)?;
    let message = messages.get(index)?;
    if message.role != ConversationMessageRole::Assistant || message.pending {
        return None;
    }
    Some(index)
}

pub fn truncate_messages_through_index(
    messages: &[ConversationMessageSnapshot],
    index: usize,
) -> Vec<ConversationMessageSnapshot> {
    if index >= messages.len() {
        return Vec::new();
    }
    sanitize_truncated_messages_for_fork(&messages[..=index])
}

fn sanitize_truncated_messages_for_fork(
    messages: &[ConversationMessageSnapshot],
) -> Vec<ConversationMessageSnapshot> {
    messages
        .iter()
        .map(|message| ConversationMessageSnapshot {
            pending: false,
            ..message.clone()
        })
        .collect()
}

pub fn build_truncated_chat_archive_for_fork(
    source: &ChatArchive,
    source_desktop: &[ConversationMessageSnapshot],
    anchor_index: usize,
) -> ChatArchive {
    let truncated_desktop = truncate_messages_through_index(source_desktop, anchor_index);
    let message_count = truncated_desktop.len();
    ChatArchive {
        messages: archive_messages_from_desktop(&truncated_desktop),
        assistant_aux: filter_assistant_aux(&source.assistant_aux, message_count),
        llm_history: truncate_llm_history_for_fork(&source.llm_history, &truncated_desktop),
        loop_enabled: source.loop_enabled,
        approval_level: source.approval_level.clone(),
        subagent_sessions: source.subagent_sessions.clone(),
        desktop_messages: Some(truncated_desktop),
        rewind: Some(rewind::create_desktop_rewind_metadata().as_json()),
        session_display_name: None,
    }
}

fn archive_messages_from_desktop(
    messages: &[ConversationMessageSnapshot],
) -> Vec<(String, String)> {
    messages
        .iter()
        .map(|message| {
            let role = if message.role == ConversationMessageRole::User {
                "user"
            } else {
                "assistant"
            };
            (role.to_string(), message.content.clone())
        })
        .collect()
}

fn filter_assistant_aux(
    assistant_aux: &[AssistantAuxArchiveEntry],
    message_count: usize,
) -> Vec<AssistantAuxArchiveEntry> {
    assistant_aux
        .iter()
        .filter(|entry| entry.message_index < message_count)
        .cloned()
        .collect()
}

fn truncate_llm_history_for_fork(
    full_history: &[ArchivedLlmMessage],
    truncated_desktop: &[ConversationMessageSnapshot],
) -> Vec<ArchivedLlmMessage> {
    if full_history.is_empty() {
        return Vec::new();
    }

    let user_turn_count = truncated_desktop
        .iter()
        .filter(|message| {
            message.role == ConversationMessageRole::User && !message.content.trim().is_empty()
        })
        .count();
    if user_turn_count == 0 {
        return full_history.first().cloned().into_iter().collect();
    }

    let mut users_seen = 0usize;
    let mut cut_exclusive = full_history.len();
    for (index, entry) in full_history.iter().enumerate() {
        if entry.role == "user" {
            users_seen += 1;
            if users_seen > user_turn_count {
                cut_exclusive = index;
                break;
            }
        }
    }
    full_history[..cut_exclusive].to_vec()
}

#[cfg(test)]
mod tests {
    use super::{
        build_truncated_chat_archive_for_fork, derive_forked_session_display_name,
        resolve_fork_anchor_index, truncate_messages_through_index,
    };
    use crate::{
        ports::{AssistantAuxArchiveEntry, ArchivedLlmMessage, ChatArchive},
        rewind::{ConversationMessageRole, ConversationMessageSnapshot},
    };

    fn snapshot(id: usize, role: ConversationMessageRole, content: &str, pending: bool) -> ConversationMessageSnapshot {
        ConversationMessageSnapshot {
            id,
            role,
            content: content.to_string(),
            tool: None,
            aux: None,
            pending,
        }
    }

    #[test]
    fn derive_forked_session_display_name_stacks_prefix() {
        assert_eq!(derive_forked_session_display_name("My Chat"), "(1) My Chat");
        assert_eq!(
            derive_forked_session_display_name("(1) My Chat"),
            "(2) My Chat"
        );
        assert_eq!(
            derive_forked_session_display_name("(9) My Chat"),
            "(10) My Chat"
        );
    }

    #[test]
    fn resolve_fork_anchor_index_requires_completed_assistant() {
        let messages = vec![
            snapshot(1, ConversationMessageRole::User, "hi", false),
            snapshot(2, ConversationMessageRole::Assistant, "hello", false),
            snapshot(3, ConversationMessageRole::User, "again", false),
            snapshot(4, ConversationMessageRole::Assistant, "pending", true),
        ];
        assert_eq!(resolve_fork_anchor_index(&messages, 2), Some(1));
        assert_eq!(resolve_fork_anchor_index(&messages, 4), None);
        assert_eq!(resolve_fork_anchor_index(&messages, 1), None);
    }

    #[test]
    fn truncate_messages_through_index_is_inclusive_and_clears_pending() {
        let messages = vec![
            snapshot(1, ConversationMessageRole::User, "hi", false),
            snapshot(2, ConversationMessageRole::Assistant, "hello", true),
        ];
        let truncated = truncate_messages_through_index(&messages, 1);
        assert_eq!(truncated.len(), 2);
        assert!(!truncated[1].pending);
    }

    #[test]
    fn build_truncated_chat_archive_for_fork_trims_history() {
        let desktop = vec![
            snapshot(1, ConversationMessageRole::User, "one", false),
            snapshot(2, ConversationMessageRole::Assistant, "a1", false),
            snapshot(3, ConversationMessageRole::User, "two", false),
            snapshot(4, ConversationMessageRole::Assistant, "a2", false),
        ];
        let source = ChatArchive {
            messages: vec![
                ("user".to_string(), "one".to_string()),
                ("assistant".to_string(), "a1".to_string()),
                ("user".to_string(), "two".to_string()),
                ("assistant".to_string(), "a2".to_string()),
            ],
            assistant_aux: vec![AssistantAuxArchiveEntry {
                message_index: 3,
                thinking: Some("later".to_string()),
                compaction: None,
                finish_task_notice: None,
            }],
            llm_history: vec![
                ArchivedLlmMessage::from_text_and_images("user".to_string(), "one".to_string(), Vec::new()),
                ArchivedLlmMessage::from_text_and_images("assistant".to_string(), "a1".to_string(), Vec::new()),
                ArchivedLlmMessage::from_text_and_images("user".to_string(), "two".to_string(), Vec::new()),
                ArchivedLlmMessage::from_text_and_images("assistant".to_string(), "a2".to_string(), Vec::new()),
            ],
            loop_enabled: true,
            approval_level: "default".to_string(),
            subagent_sessions: Vec::new(),
            desktop_messages: Some(desktop.clone()),
            rewind: None,
            session_display_name: None,
        };

        let truncated = build_truncated_chat_archive_for_fork(&source, &desktop, 1);
        assert_eq!(truncated.messages.len(), 2);
        assert!(truncated.assistant_aux.is_empty());
        assert_eq!(truncated.llm_history.len(), 2);
        assert!(truncated.rewind.is_some());
    }
}
