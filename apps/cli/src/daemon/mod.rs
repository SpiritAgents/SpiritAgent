mod client;
mod resolve;
mod ws;

pub(crate) use client::DaemonClient;
pub(crate) use resolve::ensure_daemon;
