//! Daemon discovery: read the instance registry, attach to a live daemon,
//! or spawn one. The registry lives under `{spiritDataDir}/server/instances/`
//! and is owned by the daemon itself (it prunes on exit; clients only read).

use anyhow::{Context, Result, anyhow};
use serde::Deserialize;
use std::{
    fs,
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use crate::mcp::spirit_agent_data_dir;
use crate::ts_bridge::{resolve_node_path, resolve_server_entry};

const SPAWN_TIMEOUT: Duration = Duration::from_secs(15);
const SPAWN_POLL_INTERVAL: Duration = Duration::from_millis(100);
const CONNECT_PROBE_TIMEOUT: Duration = Duration::from_millis(300);

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DaemonInstance {
    #[allow(dead_code)]
    pub(crate) instance_id: String,
    pub(crate) pid: u32,
    pub(crate) host: String,
    pub(crate) port: u16,
    #[allow(dead_code)]
    pub(crate) started_at: String,
    #[allow(dead_code)]
    pub(crate) version: String,
}

fn instances_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("server").join("instances")
}

fn read_instances(data_dir: &Path) -> Vec<DaemonInstance> {
    let dir = instances_dir(data_dir);
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut instances = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        if let Ok(instance) = serde_json::from_str::<DaemonInstance>(&raw) {
            instances.push(instance);
        }
    }
    instances.sort_by(|a, b| a.started_at.cmp(&b.started_at));
    instances
}

/// A registry record counts as live when its TCP port accepts a connection —
/// stronger than pid liveness (a reused pid would not speak WS anyway).
fn probe(instance: &DaemonInstance) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::new(
            instance.host.parse().unwrap_or(std::net::IpAddr::from([127, 0, 0, 1])),
            instance.port,
        ),
        CONNECT_PROBE_TIMEOUT,
    )
    .is_ok()
}

pub(crate) fn find_live_instance(data_dir: &Path) -> Option<DaemonInstance> {
    read_instances(data_dir).into_iter().find(probe)
}

pub(crate) fn read_server_token(data_dir: &Path) -> Result<String> {
    let path = data_dir.join("server.token");
    let token = fs::read_to_string(&path)
        .with_context(|| format!("读取 daemon token 失败: {}", path.display()))?;
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(anyhow!("daemon token 文件为空: {}", path.display()));
    }
    Ok(token)
}

/// Attaches to a running daemon or spawns one (`node entry.js serve`,
/// detached, stderr → `{dataDir}/server/daemon.log`).
pub(crate) fn ensure_daemon(workspace_root: &Path) -> Result<(DaemonInstance, String)> {
    let data_dir = spirit_agent_data_dir();
    if let Some(instance) = find_live_instance(&data_dir) {
        return Ok((instance, read_server_token(&data_dir)?));
    }

    let entry = resolve_server_entry(workspace_root)?;
    let node = resolve_node_path();
    let log_dir = data_dir.join("server");
    fs::create_dir_all(&log_dir)?;
    let log_file = fs::File::create(log_dir.join("daemon.log"))?;
    let log_err = log_file.try_clone()?;

    let child = Command::new(node)
        .arg(entry)
        .arg("serve")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_err))
        .spawn()
        .context("spawn spirit-server daemon")?;
    let child_pid = child.id();
    // Deliberately not holding/waiting the child: the daemon outlives the CLI.
    drop(child);

    let deadline = Instant::now() + SPAWN_TIMEOUT;
    loop {
        if let Some(instance) = read_instances(&data_dir)
            .into_iter()
            .find(|instance| instance.pid == child_pid)
        {
            if probe(&instance) {
                return Ok((instance, read_server_token(&data_dir)?));
            }
        }
        if Instant::now() > deadline {
            return Err(anyhow!(
                "daemon 启动超时（{}s）。日志: {}",
                SPAWN_TIMEOUT.as_secs(),
                log_dir.join("daemon.log").display()
            ));
        }
        thread::sleep(SPAWN_POLL_INTERVAL);
    }
}
