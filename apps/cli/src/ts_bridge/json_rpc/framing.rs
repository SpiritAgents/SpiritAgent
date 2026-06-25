use anyhow::{Context, Result, anyhow};
use serde_json::Value;
use std::{
    io::{BufRead, Write},
    process::ChildStdin,
    sync::{Arc, Mutex},
};

pub(crate) fn read_framed_message(reader: &mut dyn BufRead) -> Result<Vec<u8>> {
    let mut content_length = None;
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader.read_line(&mut line)?;
        if read == 0 {
            return Err(anyhow!("TS bridge stdout 已提前关闭。"));
        }

        if line == "\r\n" || line == "\n" {
            break;
        }

        let mut parts = line.splitn(2, ':');
        let name = parts.next().unwrap_or_default().trim().to_ascii_lowercase();
        let value = parts.next().unwrap_or_default().trim();
        if name == "content-length" {
            content_length = Some(value.parse::<usize>().context("解析 Content-Length 失败")?);
        }
    }

    let len = content_length.ok_or_else(|| anyhow!("TS bridge 消息缺少 Content-Length"))?;
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    Ok(body)
}

pub(crate) fn write_message_to_stdin(
    stdin: &Arc<Mutex<ChildStdin>>,
    payload: &Value,
) -> Result<()> {
    let body = serde_json::to_vec(payload)?;
    let header = format!("Content-Length: {}\r\n\r\n", body.len());
    let mut guard = stdin
        .lock()
        .map_err(|_| anyhow!("获取 TS bridge stdin 锁失败"))?;
    guard.write_all(header.as_bytes())?;
    guard.write_all(&body)?;
    guard.flush()?;
    Ok(())
}

pub(crate) fn is_json_rpc_response(message: &Value) -> bool {
    message.get("id").is_some()
        && (message.get("result").is_some() || message.get("error").is_some())
}
