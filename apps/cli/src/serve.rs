use anyhow::Result;
use std::process::{Command, Stdio};

use crate::daemon::entry::{resolve_node_path, resolve_server_entry};

/// `spirit serve` — foreground Spirit Server daemon. stdio is inherited so
/// daemon logs (stderr) stream straight into the user's terminal; the
/// daemon never speaks a protocol over stdio.
pub fn run_serve() -> Result<()> {
    let workspace_root = std::env::current_dir()?;
    let entry = resolve_server_entry(&workspace_root)?;
    let node = resolve_node_path();
    let status = Command::new(node)
        .arg(entry)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }
    Ok(())
}
