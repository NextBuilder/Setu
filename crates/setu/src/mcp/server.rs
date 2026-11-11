use std::collections::HashMap;
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::Mutex;

use super::protocol::{CallToolResult, Content};
use crate::guide::{Guide, INSTRUCTIONS};
use crate::tools::{self, Ctx, ToolDef};

pub struct Server {
    tools: HashMap<&'static str, ToolDef>,
    order: Vec<&'static str>,
    ctx: Arc<Ctx>,
    guide: Guide,
}

impl Server {
    pub fn new(ctx: Ctx) -> Self {
        let defs = tools::all();
        let order = defs.iter().map(|t| t.name).collect();
        Self {
            tools: defs.into_iter().map(|t| (t.name, t)).collect(),
            order,
            ctx: Arc::new(ctx),
            guide: Guide::default(),
        }
    }

    fn missing(def: &ToolDef, args: &Value) -> Option<String> {
        def.input_schema["required"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .find(|k| args.get(*k).is_none_or(Value::is_null))
            .map(str::to_string)
    }

    pub async fn call(&self, name: &str, args: Value) -> CallToolResult {
        let Some(def) = self.tools.get(name) else {
            return CallToolResult::error(format!("Unknown tool: {name}"));
        };
        if let Some(key) = Self::missing(def, &args) {
            return CallToolResult::error(format!("Missing required argument '{key}' for {name}"));
        }
        let mut result = match (def.handler)(&args, &self.ctx).await {
            Ok(r) => r,
            Err(e) => CallToolResult::error(e.to_string()),
        };
        if !result.is_error {
            if let Some(text) = self.guide.note(name) {
                result.content.push(Content::Text { text });
            }
        }
        result
    }

    pub async fn handle(&self, msg: Value) -> Option<Value> {
        let id = msg.get("id").cloned()?;
        let method = msg["method"].as_str().unwrap_or_default();
        let result = match method {
            "initialize" => json!({
                "protocolVersion": msg["params"]["protocolVersion"].as_str().unwrap_or("2025-06-18"),
                "capabilities": {"tools": {"listChanged": false}},
                "serverInfo": {"name": "setu", "title": "Setu", "version": env!("CARGO_PKG_VERSION")},
                "instructions": INSTRUCTIONS,
            }),
            "ping" => json!({}),
            "tools/list" => {
                json!({"tools": self.order.iter().map(|n| self.tools[n].listing()).collect::<Vec<_>>()})
            }
            "tools/call" => {
                let name = msg["params"]["name"].as_str().unwrap_or_default();
                let args = msg["params"]["arguments"].clone();
                let args = if args.is_null() { json!({}) } else { args };
                serde_json::to_value(self.call(name, args).await).unwrap_or_default()
            }
            "resources/list" => json!({"resources": []}),
            "prompts/list" => json!({"prompts": []}),
            _ => {
                return Some(
                    json!({"jsonrpc": "2.0", "id": id, "error": {"code": -32601, "message": format!("Method not found: {method}")}}),
                )
            }
        };
        Some(json!({"jsonrpc": "2.0", "id": id, "result": result}))
    }
}

pub async fn serve_stdio(server: Server) -> anyhow::Result<()> {
    let server = Arc::new(server);
    let out = Arc::new(Mutex::new(tokio::io::stdout()));
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }
        let msg: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let reply = json!({"jsonrpc": "2.0", "id": null, "error": {"code": -32700, "message": e.to_string()}});
                write(&out, &reply).await;
                continue;
            }
        };
        let server = server.clone();
        let out = out.clone();
        tokio::spawn(async move {
            if let Some(reply) = server.handle(msg).await {
                write(&out, &reply).await;
            }
        });
    }
    Ok(())
}

async fn write(out: &Arc<Mutex<tokio::io::Stdout>>, reply: &Value) {
    let mut out = out.lock().await;
    let _ = out.write_all(format!("{reply}\n").as_bytes()).await;
    let _ = out.flush().await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bridge::Bridge;

    fn server() -> Server {
        Server::new(Ctx {
            bridge: Bridge::with_ports(1, 1),
        })
    }

    #[tokio::test]
    async fn initializes_with_the_stage_guide() {
        let r = server()
            .handle(json!({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}}))
            .await
            .unwrap();
        assert_eq!(r["result"]["serverInfo"]["name"], "setu");
        assert!(r["result"]["instructions"]
            .as_str()
            .unwrap()
            .contains("easyeda-pro-review-agent"));
    }

    #[tokio::test]
    async fn lists_tools_and_runs_a_calculator_offline() {
        let s = server();
        let list = s
            .handle(json!({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}))
            .await
            .unwrap();
        let names: Vec<_> = list["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap().to_string())
            .collect();
        assert!(names.contains(&"export_manufacturing".to_string()));
        assert!(names.contains(&"calc_trace_width".to_string()));
        let r = s.call("calc_trace_width", json!({"current_a": 2.0})).await;
        assert!(!r.is_error);
        assert!(r
            .content
            .iter()
            .any(|c| matches!(c, Content::Text { text } if text.contains("easyeda-power-design"))));
    }

    #[tokio::test]
    async fn refuses_missing_arguments_and_unknown_tools() {
        let s = server();
        assert!(s.call("add_track", json!({"net": "GND"})).await.is_error);
        assert!(s.call("nope", json!({})).await.is_error);
        assert!(s
            .handle(json!({"jsonrpc": "2.0", "method": "notifications/initialized"}))
            .await
            .is_none());
    }
}
