use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, bail, Result};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::{any, get, post};
use axum::{Json, Router};
use futures::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::sync::{mpsc, oneshot, Mutex};

pub const SERVICE: &str = "easyeda-bridge";
pub const FIRST_PORT: u16 = 49620;
pub const LAST_PORT: u16 = 49629;

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

struct Pending {
    window: String,
    reply: oneshot::Sender<Result<Value, String>>,
}

#[derive(Default)]
pub struct Hub {
    windows: Mutex<Vec<(String, mpsc::UnboundedSender<String>)>>,
    active: Mutex<Option<String>>,
    pending: Mutex<HashMap<String, Pending>>,
}

impl Hub {
    pub async fn windows(&self) -> Vec<(String, bool)> {
        let active = self.active.lock().await.clone();
        self.windows
            .lock()
            .await
            .iter()
            .map(|(id, _)| (id.clone(), Some(id) == active.as_ref()))
            .collect()
    }

    pub async fn select(&self, id: &str) -> Result<()> {
        if !self.windows.lock().await.iter().any(|(w, _)| w == id) {
            bail!("EasyEDA window \"{id}\" is not connected");
        }
        *self.active.lock().await = Some(id.to_string());
        Ok(())
    }

    async fn register(&self, id: String, tx: mpsc::UnboundedSender<String>) {
        let mut windows = self.windows.lock().await;
        windows.retain(|(w, _)| w != &id);
        windows.push((id.clone(), tx));
        let mut active = self.active.lock().await;
        if active.is_none() {
            *active = Some(id);
        }
    }

    async fn unregister(&self, id: &str) {
        let mut windows = self.windows.lock().await;
        windows.retain(|(w, _)| w != id);
        let mut active = self.active.lock().await;
        if active.as_deref() == Some(id) {
            *active = windows.first().map(|(w, _)| w.clone());
        }
        let mut pending = self.pending.lock().await;
        let lost: Vec<String> = pending
            .iter()
            .filter(|(_, p)| p.window == id)
            .map(|(k, _)| k.clone())
            .collect();
        for key in lost {
            if let Some(p) = pending.remove(&key) {
                let _ = p
                    .reply
                    .send(Err(format!("EasyEDA window \"{id}\" disconnected")));
            }
        }
    }

    async fn resolve(&self, id: &str, outcome: Result<Value, String>) {
        if let Some(p) = self.pending.lock().await.remove(id) {
            let _ = p.reply.send(outcome);
        }
    }

    pub async fn execute(&self, code: &str, window: Option<&str>, wait: Duration) -> Result<Value> {
        let target = match window {
            Some(w) => w.to_string(),
            None => self.active.lock().await.clone().ok_or_else(|| {
                anyhow!("No EasyEDA window is connected. Open EasyEDA Pro with the API gateway extension running.")
            })?,
        };
        let tx = self
            .windows
            .lock()
            .await
            .iter()
            .find(|(w, _)| *w == target)
            .map(|(_, tx)| tx.clone())
            .ok_or_else(|| anyhow!("EasyEDA window \"{target}\" is not connected"))?;
        let id = uuid::Uuid::new_v4().to_string();
        let (reply, rx) = oneshot::channel();
        self.pending.lock().await.insert(
            id.clone(),
            Pending {
                window: target.clone(),
                reply,
            },
        );
        let msg = json!({"type": "execute", "id": id, "code": code, "windowId": target, "timestamp": now_ms()});
        if tx.send(msg.to_string()).is_err() {
            self.pending.lock().await.remove(&id);
            bail!("EasyEDA window \"{target}\" closed its connection");
        }
        match tokio::time::timeout(wait, rx).await {
            Ok(Ok(Ok(v))) => Ok(v),
            Ok(Ok(Err(e))) => Err(anyhow!(e)),
            Ok(Err(_)) => Err(anyhow!("EasyEDA dropped the request")),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err(anyhow!(
                    "EasyEDA did not answer within {} s",
                    wait.as_secs()
                ))
            }
        }
    }
}

async fn health(State(hub): State<Arc<Hub>>) -> Json<Value> {
    let windows = hub.windows().await;
    Json(json!({
        "service": SERVICE,
        "status": "ok",
        "server": "setu",
        "edaConnected": !windows.is_empty(),
        "edaWindowCount": windows.len(),
        "activeWindowId": windows.iter().find(|(_, a)| *a).map(|(w, _)| w.clone()),
        "pendingRequests": hub.pending.lock().await.len(),
        "timestamp": now_ms(),
    }))
}

async fn list_windows(State(hub): State<Arc<Hub>>) -> Json<Value> {
    let windows = hub.windows().await;
    Json(json!({
        "windows": windows.iter().map(|(w, a)| json!({"windowId": w, "connected": true, "active": a})).collect::<Vec<_>>(),
        "activeWindowId": windows.iter().find(|(_, a)| *a).map(|(w, _)| w.clone()),
        "count": windows.len(),
    }))
}

async fn select_window(State(hub): State<Arc<Hub>>, Json(body): Json<Value>) -> impl IntoResponse {
    let id = body["windowId"].as_str().unwrap_or_default();
    match hub.select(id).await {
        Ok(()) => (
            axum::http::StatusCode::OK,
            Json(json!({"success": true, "activeWindowId": id})),
        ),
        Err(e) => (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({"error": e.to_string()})),
        ),
    }
}

async fn execute_http(State(hub): State<Arc<Hub>>, Json(body): Json<Value>) -> impl IntoResponse {
    let Some(code) = body["code"].as_str() else {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({"error": "Missing \"code\" field (string)"})),
        );
    };
    let window = body["windowId"].as_str();
    match hub.execute(code, window, Duration::from_secs(120)).await {
        Ok(result) => (
            axum::http::StatusCode::OK,
            Json(json!({"success": true, "result": result})),
        ),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"success": false, "error": e.to_string()})),
        ),
    }
}

async fn ws_eda(ws: WebSocketUpgrade, State(hub): State<Arc<Hub>>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| eda_session(socket, hub))
}

async fn ws_agent(ws: WebSocketUpgrade, State(hub): State<Arc<Hub>>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| agent_session(socket, hub))
}

fn handshake(kind: &str) -> String {
    json!({"type": "handshake", "service": SERVICE, "clientType": kind, "timestamp": now_ms()})
        .to_string()
}

async fn eda_session(socket: WebSocket, hub: Arc<Hub>) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let _ = tx.send(handshake("eda"));
    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if sink.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });
    let mut window: Option<String> = None;
    while let Some(Ok(frame)) = stream.next().await {
        let text = match frame {
            Message::Text(t) => t.to_string(),
            Message::Binary(b) => String::from_utf8_lossy(&b).to_string(),
            Message::Close(_) => break,
            _ => continue,
        };
        let Ok(msg) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        match msg["type"].as_str() {
            Some("register") => {
                if let Some(id) = msg["windowId"].as_str() {
                    window = Some(id.to_string());
                    hub.register(id.to_string(), tx.clone()).await;
                }
            }
            Some("ping") => {
                let _ = tx.send(
                    json!({"type": "pong", "id": msg["id"], "timestamp": now_ms()}).to_string(),
                );
            }
            Some("result") => {
                if let Some(id) = msg["id"].as_str() {
                    hub.resolve(id, Ok(msg["result"].clone())).await;
                }
            }
            Some("error") => {
                if let Some(id) = msg["id"].as_str() {
                    let e = msg["error"]
                        .as_str()
                        .unwrap_or("Unknown EasyEDA error")
                        .to_string();
                    hub.resolve(id, Err(e)).await;
                }
            }
            _ => {}
        }
    }
    if let Some(id) = window {
        hub.unregister(&id).await;
    }
    writer.abort();
}

async fn agent_session(socket: WebSocket, hub: Arc<Hub>) {
    let (mut sink, mut stream) = socket.split();
    let _ = sink.send(Message::Text(handshake("agent").into())).await;
    while let Some(Ok(Message::Text(text))) = stream.next().await {
        let Ok(msg) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let reply = match msg["type"].as_str() {
            Some("execute") => {
                let code = msg["code"].as_str().unwrap_or_default();
                match hub
                    .execute(code, msg["windowId"].as_str(), Duration::from_secs(120))
                    .await
                {
                    Ok(result) => {
                        json!({"type": "result", "id": msg["id"], "result": result, "timestamp": now_ms()})
                    }
                    Err(e) => {
                        json!({"type": "error", "id": msg["id"], "error": e.to_string(), "timestamp": now_ms()})
                    }
                }
            }
            Some("ping") => json!({"type": "pong", "id": msg["id"], "timestamp": now_ms()}),
            _ => continue,
        };
        if sink
            .send(Message::Text(reply.to_string().into()))
            .await
            .is_err()
        {
            break;
        }
    }
}

pub fn router(hub: Arc<Hub>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/eda-windows", get(list_windows))
        .route("/eda-windows/select", post(select_window))
        .route("/execute", post(execute_http))
        .route("/eda", any(ws_eda))
        .route("/agent", any(ws_agent))
        .route("/", any(ws_agent))
        .with_state(hub)
}

#[derive(Clone)]
enum Mode {
    Idle,
    Host(u16),
    Client(u16),
}

pub struct Bridge {
    hub: Arc<Hub>,
    mode: Mutex<Mode>,
    http: reqwest::Client,
    ports: (u16, u16),
}

impl Bridge {
    pub fn new() -> Self {
        Self::with_ports(FIRST_PORT, LAST_PORT)
    }

    pub fn with_ports(first: u16, last: u16) -> Self {
        Self {
            hub: Arc::new(Hub::default()),
            mode: Mutex::new(Mode::Idle),
            http: reqwest::Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(180))
                .build()
                .unwrap_or_default(),
            ports: (first, last),
        }
    }

    async fn probe(&self, port: u16) -> bool {
        let url = format!("http://127.0.0.1:{port}/health");
        match self
            .http
            .get(url)
            .timeout(Duration::from_millis(800))
            .send()
            .await
        {
            Ok(r) => r
                .json::<Value>()
                .await
                .map(|v| v["service"] == SERVICE)
                .unwrap_or(false),
            Err(_) => false,
        }
    }

    pub async fn start(&self) -> Result<()> {
        let mut mode = self.mode.lock().await;
        if let Mode::Host(_) = *mode {
            return Ok(());
        }
        if let Mode::Client(port) = *mode {
            if self.probe(port).await {
                return Ok(());
            }
        }
        for port in self.ports.0..=self.ports.1 {
            if self.probe(port).await {
                *mode = Mode::Client(port);
                return Ok(());
            }
        }
        for port in self.ports.0..=self.ports.1 {
            if let Ok(listener) = tokio::net::TcpListener::bind(("127.0.0.1", port)).await {
                let app = router(self.hub.clone());
                tokio::spawn(async move {
                    let _ = axum::serve(listener, app).await;
                });
                *mode = Mode::Host(port);
                return Ok(());
            }
        }
        bail!(
            "Ports {}-{} are all in use by other programs",
            self.ports.0,
            self.ports.1
        )
    }

    pub async fn status(&self) -> Value {
        let _ = self.start().await;
        let mode = self.mode.lock().await.clone();
        match mode {
            Mode::Host(port) => {
                let windows = self.hub.windows().await;
                json!({
                    "bridge": "setu",
                    "port": port,
                    "windows": windows.iter().map(|(w, a)| json!({"windowId": w, "active": a})).collect::<Vec<_>>(),
                })
            }
            Mode::Client(port) => {
                let windows = self
                    .http
                    .get(format!("http://127.0.0.1:{port}/eda-windows"))
                    .send()
                    .await
                    .ok();
                let windows = match windows {
                    Some(r) => r.json::<Value>().await.unwrap_or(Value::Null),
                    None => Value::Null,
                };
                json!({"bridge": "shared", "port": port, "windows": windows["windows"]})
            }
            Mode::Idle => json!({"bridge": "not running"}),
        }
    }

    pub async fn select(&self, id: &str) -> Result<()> {
        self.start().await?;
        let mode = self.mode.lock().await.clone();
        match mode {
            Mode::Client(port) => {
                let r = self
                    .http
                    .post(format!("http://127.0.0.1:{port}/eda-windows/select"))
                    .json(&json!({"windowId": id}))
                    .send()
                    .await?;
                if !r.status().is_success() {
                    bail!("EasyEDA window \"{id}\" is not connected");
                }
                Ok(())
            }
            _ => self.hub.select(id).await,
        }
    }

    pub async fn execute(&self, code: &str, wait: Duration) -> Result<Value> {
        self.start().await?;
        let mode = self.mode.lock().await.clone();
        match mode {
            Mode::Client(port) => {
                let r: Value = self
                    .http
                    .post(format!("http://127.0.0.1:{port}/execute"))
                    .timeout(wait + Duration::from_secs(5))
                    .json(&json!({"code": code}))
                    .send()
                    .await?
                    .json()
                    .await?;
                if r["success"] == true {
                    Ok(r["result"].clone())
                } else {
                    Err(anyhow!(r["error"]
                        .as_str()
                        .unwrap_or("EasyEDA bridge error")
                        .to_string()))
                }
            }
            _ => self.hub.execute(code, None, wait).await,
        }
    }
}

impl Default for Bridge {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::Message as Frame;

    async fn fake_eda(port: u16) {
        let (ws, _) = connect_async(format!("ws://127.0.0.1:{port}/eda"))
            .await
            .unwrap();
        let (mut tx, mut rx) = ws.split();
        let first: Value = match rx.next().await.unwrap().unwrap() {
            Frame::Text(t) => serde_json::from_str(&t).unwrap(),
            _ => panic!("expected handshake"),
        };
        assert_eq!(first["service"], SERVICE);
        tx.send(Frame::Text(
            json!({"type": "register", "windowId": "w1"})
                .to_string()
                .into(),
        ))
        .await
        .unwrap();
        tokio::spawn(async move {
            while let Some(Ok(Frame::Text(t))) = rx.next().await {
                let m: Value = serde_json::from_str(&t).unwrap();
                if m["type"] == "execute" {
                    let reply = if m["code"].as_str().unwrap().contains("boom") {
                        json!({"type": "error", "id": m["id"], "error": "boom"})
                    } else {
                        json!({"type": "result", "id": m["id"], "result": {"echo": m["code"]}})
                    };
                    tx.send(Frame::Text(reply.to_string().into()))
                        .await
                        .unwrap();
                }
            }
        });
    }

    #[tokio::test]
    async fn hosts_the_bridge_and_runs_code_in_easyeda() {
        let bridge = Bridge::with_ports(49690, 49692);
        bridge.start().await.unwrap();
        let port = match *bridge.mode.lock().await {
            Mode::Host(p) => p,
            _ => panic!("expected to host"),
        };
        fake_eda(port).await;
        tokio::time::sleep(Duration::from_millis(100)).await;
        let out = bridge
            .execute("return 1", Duration::from_secs(2))
            .await
            .unwrap();
        assert_eq!(out["echo"], "return 1");
        let err = bridge
            .execute("boom", Duration::from_secs(2))
            .await
            .unwrap_err();
        assert!(err.to_string().contains("boom"));

        let second = Bridge::with_ports(49690, 49692);
        let shared = second
            .execute("return 2", Duration::from_secs(2))
            .await
            .unwrap();
        assert_eq!(shared["echo"], "return 2");
        assert_eq!(second.status().await["bridge"], "shared");
    }

    #[tokio::test]
    async fn explains_when_no_window_is_connected() {
        let bridge = Bridge::with_ports(49695, 49696);
        let err = bridge
            .execute("return 1", Duration::from_secs(1))
            .await
            .unwrap_err();
        assert!(err.to_string().contains("No EasyEDA window"));
    }
}
