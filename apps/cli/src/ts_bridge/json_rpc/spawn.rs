use anyhow::{Context, Result, anyhow};
use serde_json::Value;
use std::{
    env,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{ChildStderr, ChildStdout},
    sync::mpsc,
    thread,
};

use crate::{
    logging,
    ts_bridge::constants::{
        ENV_RUNTIME_BACKEND_NODE_PATH, ENV_RUNTIME_BRIDGE_PATH,
        ENV_RUNTIME_HOST_INTERNAL_MODULE_PATH,
    },
};

use super::framing::read_framed_message;

fn release_bundle_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            roots.push(exe_dir.to_path_buf());
            if let Some(parent) = exe_dir.parent() {
                roots.push(parent.to_path_buf());
            }
        }
    }
    roots
}

pub(crate) fn resolve_node_path() -> PathBuf {
    if let Ok(path) = env::var(ENV_RUNTIME_BACKEND_NODE_PATH) {
        return PathBuf::from(path);
    }

    for root in release_bundle_roots() {
        let candidate = if cfg!(windows) {
            root.join("node").join("node.exe")
        } else {
            root.join("node").join("bin").join("node")
        };
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from("node")
}

pub(crate) fn resolve_bridge_script(workspace_root: &Path) -> Result<PathBuf> {
    if let Ok(path) = env::var(ENV_RUNTIME_BRIDGE_PATH) {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    for root in release_bundle_roots() {
        let candidate = root
            .join("packages")
            .join("agent-core")
            .join("dist")
            .join("host-bridge.js");
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    // 与「用户项目目录」无关：bridge 位于 monorepo 的 packages/agent-core/dist。
    // 开发时 cwd 常为 apps/cli，不能仅用 workspace_root（current_dir）推导路径。
    let from_crate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("packages")
        .join("agent-core")
        .join("dist")
        .join("host-bridge.js");
    if from_crate.exists() {
        return Ok(from_crate);
    }

    let direct = workspace_root
        .join("packages")
        .join("agent-core")
        .join("dist")
        .join("host-bridge.js");
    if direct.exists() {
        return Ok(direct);
    }

    if let Some(parent) = workspace_root.parent() {
        let sibling = parent
            .join("packages")
            .join("agent-core")
            .join("dist")
            .join("host-bridge.js");
        if sibling.exists() {
            return Ok(sibling);
        }
    }

    let mut cursor = workspace_root.to_path_buf();
    loop {
        let candidate = cursor
            .join("packages")
            .join("agent-core")
            .join("dist")
            .join("host-bridge.js");
        if candidate.exists() {
            return Ok(candidate);
        }
        if !cursor.pop() {
            break;
        }
    }

    Err(anyhow!(
        "未找到 TS bridge 入口 host-bridge.js。请先在 packages/agent-core 执行 npm run build。"
    ))
}

pub(crate) fn resolve_host_internal_module_path() -> Result<PathBuf> {
    if let Ok(path) = env::var(ENV_RUNTIME_HOST_INTERNAL_MODULE_PATH) {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Ok(candidate);
        }
        return Err(anyhow!(
            "环境变量 {} 指向的 host-internal 模块不存在: {}",
            ENV_RUNTIME_HOST_INTERNAL_MODULE_PATH,
            candidate.display()
        ));
    }

    let from_crate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("packages")
        .join("host-internal")
        .join("dist")
        .join("index.js");
    if from_crate.exists() {
        return Ok(from_crate);
    }

    for root in release_bundle_roots() {
        let candidate = root
            .join("packages")
            .join("host-internal")
            .join("dist")
            .join("index.js");
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(anyhow!(
        "未找到 host-internal bridge 模块。请先构建 packages/host-internal，或设置 {} 指向其 dist/index.js。默认查找路径: {}",
        ENV_RUNTIME_HOST_INTERNAL_MODULE_PATH,
        from_crate.display()
    ))
}

pub(crate) fn spawn_stdout_reader(stdout: ChildStdout, tx: mpsc::Sender<Result<Value>>) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let next = read_framed_message(&mut reader)
                .context("读取 TS bridge stdout 消息失败")
                .and_then(|body| {
                    serde_json::from_slice::<Value>(&body).context("解析 TS bridge JSON 失败")
                });

            match next {
                Ok(value) => {
                    if tx.send(Ok(value)).is_err() {
                        break;
                    }
                }
                Err(err) => {
                    let _ = tx.send(Err(err));
                    break;
                }
            }
        }
    });
}

pub(crate) fn spawn_stderr_drain(stderr: ChildStderr) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => logging::log_event(&format!("[ts-bridge] {}", line.trim_end())),
                Err(err) => {
                    logging::log_event(&format!("[ts-bridge] stderr drain failed: {}", err));
                    break;
                }
            }
        }
    });
}
