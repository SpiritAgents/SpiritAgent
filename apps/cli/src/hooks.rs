use std::path::PathBuf;

use anyhow::Result;
use rust_i18n::t;

use crate::{
    adapters::{DefaultAppPaths, KeyringSecretStore},
    daemon::DaemonRuntime,
    hooks_types::{HookListItem, HooksValidationReport},
    ports::AppPaths,
    runtime_handle::prefer_inprocess_host,
    ts_bridge::TsBridgeRuntime,
};

pub enum HookCommand {
    List {
        workspace: Option<PathBuf>,
    },
    Validate {
        workspace: Option<PathBuf>,
    },
}

pub fn handle_hooks_cli(action: HookCommand) -> Result<()> {
    let app_paths = DefaultAppPaths::new();
    match action {
        HookCommand::List { workspace } => {
            let workspace_root = workspace.unwrap_or_else(|| app_paths.workspace_root());
            let items = if prefer_inprocess_host() {
                let mut runtime = TsBridgeRuntime::new_mcp_only(
                    std::sync::Arc::new(KeyringSecretStore),
                    workspace_root.clone(),
                )?;
                runtime.list_hook_entries(Some(workspace_root.to_string_lossy().as_ref()))?
            } else {
                let mut runtime = DaemonRuntime::new_host_only(workspace_root.clone())?;
                runtime.list_hook_entries(Some(workspace_root.to_string_lossy().as_ref()))?
            };
            print_hooks_list(&items);
        }
        HookCommand::Validate { workspace } => {
            let workspace_root = workspace.unwrap_or_else(|| app_paths.workspace_root());
            let report = if prefer_inprocess_host() {
                let mut runtime = TsBridgeRuntime::new_mcp_only(
                    std::sync::Arc::new(KeyringSecretStore),
                    workspace_root.clone(),
                )?;
                runtime.validate_hooks(Some(workspace_root.to_string_lossy().as_ref()))?
            } else {
                let mut runtime = DaemonRuntime::new_host_only(workspace_root.clone())?;
                runtime.validate_hooks(Some(workspace_root.to_string_lossy().as_ref()))?
            };
            print_hooks_validation_report(&report);
        }
    }
    Ok(())
}

fn hook_scope_label(scope: &str) -> String {
    if scope == "workspace" {
        t!("cli.hooks.scope.workspace").into_owned()
    } else {
        t!("cli.hooks.scope.user").into_owned()
    }
}

fn print_hooks_list(items: &[HookListItem]) {
    if items.is_empty() {
        println!("{}", t!("cli.hooks.empty"));
        return;
    }

    println!("{}", t!("cli.hooks.list_header", count = items.len()));
    for item in items {
        println!(
            "  - {} [{}] #{}  {}",
            item.event,
            hook_scope_label(&item.scope),
            item.index,
            item.command,
        );
    }
}

fn print_hooks_validation_report(report: &HooksValidationReport) {
    println!(
        "{}",
        t!("cli.hooks.user_config", path = report.user_config_path)
    );
    if let Some(workspace_path) = &report.workspace_config_path {
        println!(
            "{}",
            t!("cli.hooks.workspace_config", path = workspace_path)
        );
    } else {
        println!("{}", t!("cli.hooks.workspace_unbound"));
    }
    println!();
    println!("{}", t!("cli.hooks.event_summary"));
    for (event, count) in &report.summary {
        println!("  - {event}: {count}");
    }
    println!();
    if report.entries.is_empty() {
        println!("{}", t!("cli.hooks.empty"));
        return;
    }

    println!("{}", t!("cli.hooks.entries_header"));
    for entry in &report.entries {
        let status = if entry.exists { "ok" } else { "missing" };
        println!(
            "  - [{status}] {}:{}#{} ({}) -> {}",
            entry.scope, entry.event, entry.index, entry.command, entry.resolved_path,
        );
    }
}
