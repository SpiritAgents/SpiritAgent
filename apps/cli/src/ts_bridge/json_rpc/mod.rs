mod framing;
mod spawn;

pub(crate) use framing::{is_json_rpc_response, write_message_to_stdin};
pub(crate) use spawn::resolve_bridge_script;

use anyhow::{Context, Result, anyhow};
use serde_json::{Value, json};
use std::{
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        Arc, Mutex,
        mpsc::{self, Receiver},
    },
};

use crate::mcp::spirit_agent_data_dir;
use crate::ts_bridge::constants::{
    ENV_RUNTIME_HOST_INTERNAL_MODULE_PATH, ENV_RUNTIME_HOST_INTERNAL_SPIRIT_DATA_DIR,
};

use spawn::{
    resolve_host_internal_module_path, resolve_node_path, spawn_stderr_drain, spawn_stdout_reader,
};

pub(crate) struct JsonRpcProcess {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    rx: Receiver<Result<Value>>,
    next_id: u64,
}

impl JsonRpcProcess {
    pub(crate) fn spawn(script_path: PathBuf) -> Result<Self> {
        let node_path = resolve_node_path();
        let mut command = Command::new(&node_path);
        command
            .arg(script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let host_internal_path = resolve_host_internal_module_path()?;
        command.env(ENV_RUNTIME_HOST_INTERNAL_MODULE_PATH, host_internal_path);
        command.env(
            ENV_RUNTIME_HOST_INTERNAL_SPIRIT_DATA_DIR,
            spirit_agent_data_dir(),
        );

        let mut child = command
            .spawn()
            .with_context(|| format!("启动 TS bridge 失败: {}", node_path.display()))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("获取 TS bridge stdin 失败"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("获取 TS bridge stdout 失败"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow!("获取 TS bridge stderr 失败"))?;
        let (tx, rx) = mpsc::channel::<Result<Value>>();
        spawn_stdout_reader(stdout, tx);
        spawn_stderr_drain(stderr);

        Ok(Self {
            child,
            stdin: Arc::new(Mutex::new(stdin)),
            rx,
            next_id: 1,
        })
    }

    pub(crate) fn next_request_id(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    pub(crate) fn write_request(&self, id: u64, method: &str, params: Option<Value>) -> Result<()> {
        let mut payload = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
        });
        if let Some(params) = params {
            payload["params"] = params;
        }
        self.write_message(&payload)
    }

    pub(crate) fn write_message(&self, payload: &Value) -> Result<()> {
        write_message_to_stdin(&self.stdin, payload)
    }

    pub(crate) fn recv_message(&self) -> Result<Value> {
        match self.rx.recv() {
            Ok(result) => result,
            Err(_) => Err(anyhow!("TS bridge stdout 读取通道已关闭。")),
        }
    }
}

impl Drop for JsonRpcProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
