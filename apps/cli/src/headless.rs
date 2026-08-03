use anyhow::{anyhow, Result};
use rust_i18n::t;
use std::{
    sync::Arc,
    thread,
    time::{Duration, Instant},
};

use crate::{
    adapters::{DefaultAppPaths, KeyringSecretStore},
    cli_bootstrap::{apply_approval_level, GlobalCliOptions},
    daemon::{DaemonClient, ensure_daemon},
    host_runtime::RuntimeEvent,
    model_registry::AppConfig,
    ports::{AppPaths, SecretStore},
    runtime_handle::RuntimeHandle,
    ts_bridge::BridgeRuntimeEvent,
};

const POLL_INTERVAL: Duration = Duration::from_millis(50);
const DEFAULT_TURN_TIMEOUT: Duration = Duration::from_secs(60 * 30);
const DAEMON_NOTIFICATION_POLL: Duration = Duration::from_millis(500);

/// Run a single non-interactive turn. stdout receives only the final assistant text.
pub fn run_headless_prompt(
    prompt: &str,
    options: &GlobalCliOptions,
    config: AppConfig,
) -> Result<()> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("{}", t!("cli.headless.prompt_empty")));
    }

    // Migration switch: SPIRIT_INPROCESS_HOST=1 keeps the legacy sidecar path.
    if std::env::var("SPIRIT_INPROCESS_HOST").ok().as_deref() != Some("1") {
        return run_headless_prompt_via_daemon(trimmed, options);
    }

    run_headless_prompt_inprocess(trimmed, options, config)
}

/// Legacy path: spawn the host-bridge sidecar in-process (deprecated).
fn run_headless_prompt_inprocess(
    trimmed: &str,
    options: &GlobalCliOptions,
    config: AppConfig,
) -> Result<()> {
    let app_paths = DefaultAppPaths::new();
    let secret_store: Arc<dyn SecretStore> = Arc::new(KeyringSecretStore);
    let workspace_root = app_paths.workspace_root();
    let mut runtime = RuntimeHandle::new(config, secret_store, workspace_root)?;

    if let Some(approval) = options.approval.as_deref() {
        apply_approval_level(&mut runtime, approval)?;
    }

    // Match TUI startup: run sessionStart hooks before the first user turn.
    runtime.run_session_start("startup")?;

    runtime.submit_user_turn(trimmed.to_string(), None)?;

    let mut pending_assistant = String::new();
    let mut final_assistant = String::new();
    let mut has_pending_assistant = false;
    let mut runtime_notices: Vec<String> = Vec::new();
    let deadline = Instant::now() + DEFAULT_TURN_TIMEOUT;

    loop {
        if Instant::now() > deadline {
            return Err(anyhow!("{}", t!("cli.headless.timeout")));
        }

        runtime.poll();
        runtime.handle_stream_stall_timeout();
        for event in runtime.drain_events() {
            match event {
                RuntimeEvent::BeginAssistantResponse => {
                    pending_assistant.clear();
                    has_pending_assistant = true;
                }
                RuntimeEvent::AssistantChunk(chunk) => {
                    // Accumulate silently; headless never prints intermediate text.
                    if has_pending_assistant {
                        pending_assistant.push_str(&chunk);
                    }
                }
                RuntimeEvent::ReplacePendingAssistant(content) => {
                    pending_assistant = content;
                    has_pending_assistant = true;
                }
                RuntimeEvent::AssistantResponseCompleted => {
                    if has_pending_assistant {
                        final_assistant = pending_assistant.clone();
                        has_pending_assistant = false;
                    }
                }
                RuntimeEvent::RemovePendingAssistant => {
                    pending_assistant.clear();
                    has_pending_assistant = false;
                }
                RuntimeEvent::OpenAskQuestions { .. } => {
                    return Err(anyhow!("{}", t!("cli.headless.blocked_questions")));
                }
                RuntimeEvent::PushMessage(message) => {
                    // Tool cards stay off stdout; keep plain agent notices for failure reporting.
                    if message.tool_block.is_none() {
                        let content = message.content.trim();
                        if !content.is_empty() {
                            runtime_notices.push(content.to_string());
                        }
                    }
                }
                RuntimeEvent::UpdatePendingAssistantThinking(_)
                | RuntimeEvent::AssistantThinkingSegmentFinalized(_)
                | RuntimeEvent::UpdatePendingAssistantCompaction(_)
                | RuntimeEvent::UpsertToolPreview { .. } => {}
            }
        }

        if runtime.has_pending_tool_approval() {
            return Err(anyhow!("{}", t!("cli.headless.blocked_approval")));
        }

        if runtime.pending_subagent_approval().is_some() {
            return Err(anyhow!("{}", t!("cli.headless.blocked_approval")));
        }

        if !runtime.is_busy() {
            break;
        }

        thread::sleep(POLL_INTERVAL);
    }

    if final_assistant.trim().is_empty() && !pending_assistant.trim().is_empty() {
        final_assistant = pending_assistant;
    }

    if final_assistant.trim().is_empty() {
        if let Some(notice) = runtime_notices.last() {
            return Err(anyhow!(
                "{}",
                t!("cli.headless.runtime_failed", err = notice.as_str())
            ));
        }
        return Err(anyhow!("{}", t!("cli.headless.empty_response")));
    }

    println!("{final_assistant}");
    Ok(())
}

/// Daemon path: attach to (or spawn) the shared Spirit Server and run the turn
/// over WebSocket. The daemon owns the runtime; the CLI only streams events.
fn run_headless_prompt_via_daemon(trimmed: &str, options: &GlobalCliOptions) -> Result<()> {
    let workspace_root = std::env::current_dir()?;
    let (instance, token) = ensure_daemon(&workspace_root)?;
    let mut client = DaemonClient::connect(&instance.host, instance.port, &token)?;

    // The daemon greets each connection with server.connected.
    let hello = client.next_notification(Duration::from_secs(5))?;
    match hello {
        Some(value)
            if value.get("method").and_then(serde_json::Value::as_str)
                == Some("server.connected") => {}
        _ => return Err(anyhow!("daemon 握手失败：未收到 server.connected")),
    }

    client.call(
        "server.initialize",
        serde_json::json!({
            "clientKind": "cli",
            "workspaceRoot": workspace_root.to_string_lossy(),
        }),
    )?;

    let mut create_params = serde_json::json!({
        "workspaceRoot": workspace_root.to_string_lossy(),
    });
    if let Some(approval) = options.approval.as_deref() {
        create_params["approvalLevel"] = serde_json::Value::String(approval.to_string());
    }
    let created = client.call("session.create", create_params)?;
    let session_id = created
        .get("sessionId")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| anyhow!("session.create 未返回 sessionId"))?;

    let result = run_daemon_turn(&mut client, &session_id, trimmed);
    let _ = client.call("session.close", serde_json::json!({ "sessionId": session_id }));
    client.close();
    result
}

fn run_daemon_turn(
    client: &mut DaemonClient,
    session_id: &str,
    text: &str,
) -> Result<()> {
    client.call(
        "session.submitUserTurn",
        serde_json::json!({ "sessionId": session_id, "text": text }),
    )?;

    let mut pending_assistant = String::new();
    let mut final_assistant = String::new();
    let mut has_pending_assistant = false;
    let deadline = Instant::now() + DEFAULT_TURN_TIMEOUT;

    loop {
        if Instant::now() > deadline {
            return Err(anyhow!("{}", t!("cli.headless.timeout")));
        }
        let Some(message) = client.next_notification(DAEMON_NOTIFICATION_POLL)? else {
            continue;
        };
        let method = message.get("method").and_then(serde_json::Value::as_str);
        let params = message.get("params").cloned().unwrap_or(serde_json::Value::Null);
        let params_session = params.get("sessionId").and_then(serde_json::Value::as_str);

        match method {
            Some("runtime.event") if params_session == Some(session_id) => {
                let event_value = params.get("event").cloned().unwrap_or(serde_json::Value::Null);
                let Ok(event) = serde_json::from_value::<BridgeRuntimeEvent>(event_value) else {
                    continue;
                };
                match event {
                    BridgeRuntimeEvent::BeginAssistantResponse => {
                        pending_assistant.clear();
                        has_pending_assistant = true;
                    }
                    BridgeRuntimeEvent::AssistantChunk { text: chunk } => {
                        if has_pending_assistant {
                            pending_assistant.push_str(&chunk);
                        }
                    }
                    BridgeRuntimeEvent::ReplacePendingAssistant { text: content } => {
                        pending_assistant = content;
                        has_pending_assistant = true;
                    }
                    BridgeRuntimeEvent::AssistantResponseCompleted => {
                        if has_pending_assistant {
                            final_assistant = pending_assistant.clone();
                            has_pending_assistant = false;
                        }
                    }
                    BridgeRuntimeEvent::RemovePendingAssistant => {
                        pending_assistant.clear();
                        has_pending_assistant = false;
                    }
                    BridgeRuntimeEvent::ApprovalRequested { .. } => {
                        // Headless parity with the sidecar path: decline and stop.
                        let _ = client.call(
                            "session.replyPendingApproval",
                            serde_json::json!({
                                "sessionId": session_id,
                                "decision": {
                                    "kind": "deny",
                                    "resultText": "Headless mode cannot approve tool calls.",
                                },
                            }),
                        );
                        return Err(anyhow!("{}", t!("cli.headless.blocked_approval")));
                    }
                    BridgeRuntimeEvent::QuestionsRequested { .. } => {
                        return Err(anyhow!("{}", t!("cli.headless.blocked_questions")));
                    }
                    _ => {}
                }
            }
            Some("session.turnFinished") if params_session == Some(session_id) => break,
            _ => {}
        }
    }

    if final_assistant.trim().is_empty() && !pending_assistant.trim().is_empty() {
        final_assistant = pending_assistant;
    }
    if final_assistant.trim().is_empty() {
        return Err(anyhow!("{}", t!("cli.headless.empty_response")));
    }
    println!("{final_assistant}");
    Ok(())
}
