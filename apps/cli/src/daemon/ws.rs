//! Minimal RFC 6455 WebSocket client over a blocking TcpStream — no extra
//! crates (sha2 + base64 + uuid are already CLI dependencies).
//!
//! Client frames are masked as required by the spec; server frames arrive
//! unmasked. Supports text/binary messages, fragmentation, ping/pong, and
//! the close handshake.

use anyhow::{Context, Result, anyhow, bail};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::io::{Read, Write};
use std::net::TcpStream;

const WS_GUID: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME_PAYLOAD: usize = 64 * 1024 * 1024;
const MAX_HANDSHAKE_BYTES: usize = 16 * 1024;

/// SHA-1 (RFC 3174) — needed only for the Sec-WebSocket-Accept handshake.
/// The `sha2` crate has no SHA-1 and adding crates is not an option here.
fn sha1_digest(data: &[u8]) -> [u8; 20] {
    let mut h: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut message = data.to_vec();
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&bit_len.to_be_bytes());

    for block in message.chunks_exact(64) {
        let mut w = [0u32; 80];
        for (i, word) in block.chunks_exact(4).enumerate() {
            w[i] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let (mut a, mut b, mut c, mut d, mut e) = (h[0], h[1], h[2], h[3], h[4]);
        for (i, &word) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A827999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDC),
                _ => (b ^ c ^ d, 0xCA62C1D6),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(word);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
    }

    let mut out = [0u8; 20];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

const OPCODE_CONTINUATION: u8 = 0x0;
const OPCODE_TEXT: u8 = 0x1;
const OPCODE_BINARY: u8 = 0x2;
const OPCODE_CLOSE: u8 = 0x8;
const OPCODE_PING: u8 = 0x9;
const OPCODE_PONG: u8 = 0xa;

#[derive(Debug)]
pub(crate) struct WsFrame {
    pub(crate) fin: bool,
    pub(crate) opcode: u8,
    pub(crate) payload: Vec<u8>,
}

#[derive(Debug)]
pub(crate) enum WsReadEvent {
    Text(String),
    /// Binary frames carry no protocol meaning for us; payload is discarded.
    Binary,
    Closed,
}

pub(crate) struct WsStream {
    stream: TcpStream,
}

impl WsStream {
    pub(crate) fn try_clone(&self) -> Result<Self> {
        Ok(Self {
            stream: self.stream.try_clone().context("clone ws socket")?,
        })
    }

    /// Performs the HTTP upgrade handshake. `auth_token`, when set, is sent
    /// as `Authorization: Bearer` instead of a query parameter.
    pub(crate) fn connect(
        host: &str,
        port: u16,
        path: &str,
        auth_token: Option<&str>,
    ) -> Result<Self> {
        let mut stream =
            TcpStream::connect((host, port)).with_context(|| format!("connect {host}:{port}"))?;
        stream.set_nodelay(true).ok();

        let sec_key = BASE64.encode(uuid::Uuid::new_v4().as_bytes());
        let auth_header = auth_token
            .map(|token| format!("Authorization: Bearer {token}\r\n"))
            .unwrap_or_default();
        let request = format!(
            "GET {path} HTTP/1.1\r\n\
             Host: {host}:{port}\r\n\
             {auth_header}\
             Upgrade: websocket\r\n\
             Connection: Upgrade\r\n\
             Sec-WebSocket-Key: {sec_key}\r\n\
             Sec-WebSocket-Version: 13\r\n\
             \r\n"
        );
        stream.write_all(request.as_bytes())?;

        let mut raw = Vec::new();
        let mut byte = [0u8; 1];
        while !raw.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut byte)?;
            raw.push(byte[0]);
            if raw.len() > MAX_HANDSHAKE_BYTES {
                bail!("ws handshake response too large");
            }
        }
        let response = String::from_utf8_lossy(&raw);
        let status_line = response.lines().next().unwrap_or_default();
        if !status_line.contains(" 101") {
            bail!("ws handshake rejected: {status_line}");
        }
        let expected_accept = BASE64.encode(sha1_digest(format!("{sec_key}{WS_GUID}").as_bytes()));
        let accept = response.lines().find_map(|line| {
            let (name, value) = line.split_once(':')?;
            if name.trim().eq_ignore_ascii_case("sec-websocket-accept") {
                Some(value.trim().to_string())
            } else {
                None
            }
        });
        if accept.as_deref() != Some(expected_accept.as_str()) {
            bail!("ws handshake accept-key mismatch");
        }
        Ok(Self { stream })
    }

    pub(crate) fn send_text(&mut self, text: &str) -> Result<()> {
        self.write_frame(OPCODE_TEXT, text.as_bytes(), true)
    }

    pub(crate) fn send_pong(&mut self, payload: &[u8]) -> Result<()> {
        self.write_frame(OPCODE_PONG, payload, true)
    }

    pub(crate) fn send_close(&mut self) -> Result<()> {
        let mut payload = Vec::with_capacity(2);
        payload.extend_from_slice(&1000u16.to_be_bytes());
        self.write_frame(OPCODE_CLOSE, &payload, true)
    }

    fn write_frame(&mut self, opcode: u8, payload: &[u8], fin: bool) -> Result<()> {
        let mask: [u8; 4] = uuid::Uuid::new_v4().as_bytes()[..4]
            .try_into()
            .map_err(|_| anyhow!("mask slice"))?;
        let mut frame = Vec::with_capacity(payload.len() + 14);
        frame.push(if fin { 0x80 } else { 0x00 } | opcode);
        let len = payload.len();
        if len < 126 {
            frame.push(0x80 | len as u8);
        } else if len <= 0xffff {
            frame.push(0x80 | 126);
            frame.extend_from_slice(&(len as u16).to_be_bytes());
        } else {
            frame.push(0x80 | 127);
            frame.extend_from_slice(&(len as u64).to_be_bytes());
        }
        frame.extend_from_slice(&mask);
        frame.extend(payload.iter().enumerate().map(|(i, b)| b ^ mask[i % 4]));
        self.stream.write_all(&frame)?;
        Ok(())
    }

    fn read_exact_vec(&mut self, len: usize) -> Result<Vec<u8>> {
        let mut buf = vec![0u8; len];
        self.stream.read_exact(&mut buf)?;
        Ok(buf)
    }

    fn read_frame(&mut self) -> Result<WsFrame> {
        let header = self.read_exact_vec(2)?;
        let fin = header[0] & 0x80 != 0;
        let opcode = header[0] & 0x0f;
        let masked = header[1] & 0x80 != 0;
        let mut length = (header[1] & 0x7f) as u64;
        if length == 126 {
            let ext = self.read_exact_vec(2)?;
            length = u16::from_be_bytes([ext[0], ext[1]]) as u64;
        } else if length == 127 {
            let ext = self.read_exact_vec(8)?;
            length = u64::from_be_bytes(ext.try_into().map_err(|_| anyhow!("len64"))?);
        }
        if length > MAX_FRAME_PAYLOAD as u64 {
            bail!("ws frame too large: {length}");
        }
        let mask = if masked {
            Some(self.read_exact_vec(4)?)
        } else {
            None
        };
        let mut payload = self.read_exact_vec(length as usize)?;
        if let Some(mask) = mask {
            for (i, byte) in payload.iter_mut().enumerate() {
                *byte ^= mask[i % 4];
            }
        }
        Ok(WsFrame {
            fin,
            opcode,
            payload,
        })
    }

    /// Reads one complete message, answering pings and reassembling fragments.
    pub(crate) fn read_event(&mut self) -> Result<WsReadEvent> {
        let mut fragment_opcode: Option<u8> = None;
        let mut fragments: Vec<u8> = Vec::new();
        loop {
            let frame = self.read_frame()?;
            match frame.opcode {
                OPCODE_TEXT | OPCODE_BINARY => {
                    if frame.fin {
                        return self.message_event(frame.opcode, frame.payload);
                    }
                    fragment_opcode = Some(frame.opcode);
                    fragments = frame.payload;
                }
                OPCODE_CONTINUATION => {
                    let Some(opcode) = fragment_opcode else {
                        bail!("unexpected continuation frame");
                    };
                    fragments.extend_from_slice(&frame.payload);
                    if frame.fin {
                        return self.message_event(opcode, std::mem::take(&mut fragments));
                    }
                }
                OPCODE_PING => {
                    self.send_pong(&frame.payload)?;
                }
                OPCODE_PONG => {}
                OPCODE_CLOSE => {
                    return Ok(WsReadEvent::Closed);
                }
                other => bail!("unsupported ws opcode {other}"),
            }
        }
    }

    fn message_event(&self, opcode: u8, payload: Vec<u8>) -> Result<WsReadEvent> {
        if opcode == OPCODE_TEXT {
            Ok(WsReadEvent::Text(
                String::from_utf8(payload).context("ws text frame utf8")?,
            ))
        } else {
            Ok(WsReadEvent::Binary)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha1_matches_rfc3174_vectors() {
        assert_eq!(
            BASE64.encode(sha1_digest(b"abc")),
            "qZk+NkcGgWq6PiVxeFDCbJzQ2J0="
        );
        // RFC 6455 §1.3 handshake example.
        assert_eq!(
            BASE64.encode(sha1_digest(
                format!("dGhlIHNhbXBsZSBub25jZQ=={WS_GUID}").as_bytes()
            )),
            "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
        );
    }

    #[test]
    fn masked_text_frame_round_trips_through_parser() {
        // Encode with the client writer, decode on the accepted server socket.
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let client_socket = TcpStream::connect(addr).unwrap();
        let (server_socket, _) = listener.accept().unwrap();

        let mut client = WsStream {
            stream: client_socket,
        };
        client.send_text("hello").unwrap();

        let mut server = WsStream {
            stream: server_socket,
        };
        // Server side reads a masked client frame via read_frame.
        let frame = server.read_frame().unwrap();
        assert_eq!(frame.opcode, OPCODE_TEXT);
        assert_eq!(frame.payload, b"hello");
    }
}
