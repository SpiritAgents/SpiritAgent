use anyhow::{anyhow, Result};
use rust_i18n::t;
use std::{
    sync::Arc,
    thread,
    time::{Duration, Instant},
};

use crate::{
    adapters::{DefaultAppPaths, JsonConfigStore, KeyringSecretStore},
    cli_bootstrap::{apply_approval_level, GlobalCliOptions},
    daemon::DaemonRuntime,
    host_runtime::RuntimeEvent,
    model_registry::AppConfig,
    ports::{AppPaths, ConfigStore, SecretStore},
    runtime_handle::RuntimeHandle,
};

const POLL_INTERVAL: Duration = Duration::from_millis(50);
const DEFAULT_TURN_TIMEOUT: Duration = Duration::from_secs(60 * 30);

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

/// Daemon path: same event loop as the in-process path, but the runtime
/// lives in the shared Spirit Server daemon (events arrive via WS push).
fn run_headless_prompt_via_daemon(trimmed: &str, options: &GlobalCliOptions) -> Result<()> {
    let app_paths = DefaultAppPaths::new();
    let secret_store: Arc<dyn SecretStore> = Arc::new(KeyringSecretStore);
    let workspace_root = app_paths.workspace_root();
    let config = JsonConfigStore.load()?;
    let mut runtime = DaemonRuntime::new(config, secret_store, workspace_root)?;

    if let Some(approval) = options.approval.as_deref() {
        let level = crate::cli_bootstrap::parse_cli_approval_level(approval)?;
        runtime.set_approval_level(&level)?;
    }

    runtime.run_session_start("startup")?;
    runtime.submit_user_turn(trimmed.to_string(), None)?;

    let deadline = Instant::now() + DEFAULT_TURN_TIMEOUT;
    let result = run_daemon_headless_turn(&mut runtime, deadline);
    // Headless sessions are ephemeral — never leave them parked in the daemon.
    runtime.close_session();
    result
}

fn run_daemon_headless_turn(runtime: &mut DaemonRuntime, deadline: Instant) -> Result<()> {
    let mut pending_assistant = String::new();
    let mut final_assistant = String::new();
    let mut has_pending_assistant = false;

    loop {
        if Instant::now() > deadline {
            return Err(anyhow!("{}", t!("cli.headless.timeout")));
        }

        for event in runtime.drain_events() {
            match event {
                RuntimeEvent::BeginAssistantResponse => {
                    pending_assistant.clear();
                    has_pending_assistant = true;
                }
                RuntimeEvent::AssistantChunk(chunk) => {
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
                _ => {}
            }
        }

        if runtime.has_pending_tool_approval() {
            // Headless parity with the sidecar path: decline and stop. The
            // daemon session is closed so no runtime parks on the answer.
            runtime.respond_to_pending_tool_approval("n");
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
        return Err(anyhow!("{}", t!("cli.headless.empty_response")));
    }
    println!("{final_assistant}");
    Ok(())
}
