//! Runs the bundled FFmpeg and FFprobe binaries. The webview can only name one
//! of these two programs; arguments are passed as an array, never through a shell.

use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use base64::Engine;
use serde::{Deserialize, Serialize};
use shared_child::SharedChild;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

const MAX_STDERR_BYTES: usize = 64 * 1024;

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Program {
    Ffmpeg,
    Ffprobe,
}

impl Program {
    fn name(self) -> &'static str {
        match self {
            Program::Ffmpeg => "ffmpeg",
            Program::Ffprobe => "ffprobe",
        }
    }

    /// Bundled binaries (`externalBin` in tauri.conf.json) sit next to the app executable.
    fn path(self) -> Result<PathBuf, String> {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let dir = exe.parent().ok_or("The application folder could not be found.")?;
        let path = dir.join(format!("{}{}", self.name(), std::env::consts::EXE_SUFFIX));
        if path.is_file() {
            Ok(path)
        } else {
            Err(format!("binary-missing:{}", self.name()))
        }
    }
}

fn command(program: Program, args: &[String]) -> Result<Command, String> {
    let mut cmd = Command::new(program.path()?);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    Ok(cmd)
}

fn spawn(program: Program, args: &[String]) -> Result<Arc<SharedChild>, String> {
    let child = SharedChild::spawn(&mut command(program, args)?).map_err(|e| format!("spawn-failed:{e}"))?;
    Ok(Arc::new(child))
}

/// Decodes UTF-8 across read boundaries so multi-byte characters are never split.
#[derive(Default)]
struct Utf8Decoder {
    pending: Vec<u8>,
}

impl Utf8Decoder {
    fn push(&mut self, bytes: &[u8]) -> String {
        self.pending.extend_from_slice(bytes);
        let complete = match std::str::from_utf8(&self.pending) {
            Ok(_) => self.pending.len(),
            Err(error) if error.error_len().is_none() => error.valid_up_to(),
            Err(_) => self.pending.len(),
        };
        let rest = self.pending.split_off(complete);
        let head = std::mem::replace(&mut self.pending, rest);
        String::from_utf8_lossy(&head).into_owned()
    }
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProcessEvent {
    Stdout { data: String },
    Stderr { data: String },
    Exit { code: Option<i32> },
}

/// Long-running processes, tracked so they can be cancelled and killed on exit.
#[derive(Default)]
pub struct Processes {
    next_id: AtomicU32,
    running: Mutex<HashMap<u32, Arc<SharedChild>>>,
}

impl Processes {
    pub fn kill_all(&self) {
        if let Ok(running) = self.running.lock() {
            for child in running.values() {
                let _ = child.kill();
            }
        }
    }
}

fn forward<R: Read + Send + 'static>(source: Option<R>, channel: Channel<ProcessEvent>, is_stdout: bool) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let Some(mut source) = source else { return };
        let mut buffer = [0u8; 16 * 1024];
        let mut decoder = Utf8Decoder::default();
        // Keep draining even if the webview stopped listening, so the process never blocks on a full pipe.
        while let Ok(n) = source.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let data = decoder.push(&buffer[..n]);
            if data.is_empty() {
                continue;
            }
            let event = if is_stdout { ProcessEvent::Stdout { data } } else { ProcessEvent::Stderr { data } };
            let _ = channel.send(event);
        }
    })
}

/// Starts FFmpeg and streams its stdout/stderr as text. `Exit` is always the last event.
#[tauri::command]
pub fn process_spawn(
    app: AppHandle,
    state: State<'_, Processes>,
    program: Program,
    args: Vec<String>,
    on_event: Channel<ProcessEvent>,
) -> Result<u32, String> {
    let child = spawn(program, &args)?;
    let id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    state.running.lock().map_err(|e| e.to_string())?.insert(id, child.clone());

    let readers = [
        forward(child.take_stdout(), on_event.clone(), true),
        forward(child.take_stderr(), on_event.clone(), false),
    ];
    thread::spawn(move || {
        let status = child.wait();
        for reader in readers {
            let _ = reader.join();
        }
        if let Ok(mut running) = app.state::<Processes>().running.lock() {
            running.remove(&id);
        }
        let _ = on_event.send(ProcessEvent::Exit { code: status.ok().and_then(|s| s.code()) });
    });
    Ok(id)
}

#[tauri::command]
pub fn process_kill(state: State<'_, Processes>, id: u32) {
    if let Ok(running) = state.running.lock() {
        if let Some(child) = running.get(&id) {
            let _ = child.kill();
        }
    }
}

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Encoding {
    Text,
    Base64,
}

#[derive(Serialize)]
pub struct CaptureResult {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn capture(program: Program, args: &[String], timeout: Duration, max_stdout: usize, encoding: Encoding) -> Result<CaptureResult, String> {
    let child = spawn(program, args)?;
    let overflow = Arc::new(AtomicBool::new(false));

    let stdout_reader = {
        let (child, overflow, source) = (child.clone(), overflow.clone(), child.take_stdout());
        thread::spawn(move || {
            let mut data = Vec::new();
            let Some(mut source) = source else { return data };
            let mut buffer = [0u8; 64 * 1024];
            while let Ok(n) = source.read(&mut buffer) {
                if n == 0 {
                    break;
                }
                if data.len() + n > max_stdout {
                    overflow.store(true, Ordering::Relaxed);
                    let _ = child.kill();
                    break;
                }
                data.extend_from_slice(&buffer[..n]);
            }
            data
        })
    };
    let stderr_reader = {
        let source = child.take_stderr();
        thread::spawn(move || {
            let mut data = Vec::new();
            let Some(mut source) = source else { return data };
            let mut buffer = [0u8; 8 * 1024];
            while let Ok(n) = source.read(&mut buffer) {
                if n == 0 {
                    break;
                }
                let room = MAX_STDERR_BYTES.saturating_sub(data.len());
                data.extend_from_slice(&buffer[..n.min(room)]);
            }
            data
        })
    };

    let deadline = Instant::now() + timeout;
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("{} timed out after {} ms.", program.name(), timeout.as_millis()));
        }
        thread::sleep(Duration::from_millis(10));
    };

    let stdout = stdout_reader.join().unwrap_or_default();
    let stderr = stderr_reader.join().unwrap_or_default();
    if overflow.load(Ordering::Relaxed) {
        return Err("Process output exceeded the allowed size.".into());
    }
    Ok(CaptureResult {
        code: status.code(),
        stdout: match encoding {
            Encoding::Text => String::from_utf8_lossy(&stdout).into_owned(),
            Encoding::Base64 => base64::engine::general_purpose::STANDARD.encode(&stdout),
        },
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
    })
}

/// Runs a short-lived process (probing, thumbnails) and returns its output.
#[tauri::command]
pub async fn process_capture(
    program: Program,
    args: Vec<String>,
    timeout_ms: u64,
    max_stdout_bytes: usize,
    encoding: Encoding,
) -> Result<CaptureResult, String> {
    tauri::async_runtime::spawn_blocking(move || capture(program, &args, Duration::from_millis(timeout_ms), max_stdout_bytes, encoding))
        .await
        .map_err(|e| e.to_string())?
}
