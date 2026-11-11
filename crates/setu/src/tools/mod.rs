use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use serde_json::{json, Value};

use crate::bridge::Bridge;
use crate::mcp::protocol::CallToolResult;

pub mod eda;
pub mod engineering;
pub mod scripts;

pub struct Ctx {
    pub bridge: Bridge,
}

pub type ToolFuture<'a> = Pin<Box<dyn Future<Output = anyhow::Result<CallToolResult>> + Send + 'a>>;
pub type ToolHandlerFn = Arc<dyn Fn(&Value, &Arc<Ctx>) -> ToolFuture<'static> + Send + Sync>;

pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub input_schema: Value,
    pub handler: ToolHandlerFn,
}

impl ToolDef {
    pub fn new(
        name: &'static str,
        description: &'static str,
        input_schema: Value,
        handler: ToolHandlerFn,
    ) -> Self {
        Self {
            name,
            description,
            input_schema,
            handler,
        }
    }

    pub fn listing(&self) -> Value {
        json!({"name": self.name, "description": self.description, "inputSchema": self.input_schema})
    }
}

#[macro_export]
macro_rules! tool {
    ($name:expr, $desc:expr, $schema:expr, $handler:expr) => {{
        let h: $crate::tools::ToolHandlerFn = std::sync::Arc::new(move |args, ctx| {
            let args = args.clone();
            let ctx = ctx.clone();
            Box::pin(async move { ($handler)(&args, &*ctx).await })
        });
        $crate::tools::ToolDef::new($name, $desc, $schema, h)
    }};
}

pub fn invalid_arg(key: &str, why: &str) -> CallToolResult {
    CallToolResult::error(format!("Invalid argument '{key}': {why}"))
}

pub fn require_str<'a>(args: &'a Value, key: &str) -> Result<&'a str, CallToolResult> {
    args[key]
        .as_str()
        .ok_or_else(|| invalid_arg(key, "missing or not a string"))
}

pub fn opt_str<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args[key].as_str()
}

pub fn require_f64(args: &Value, key: &str) -> Result<f64, CallToolResult> {
    args[key]
        .as_f64()
        .ok_or_else(|| invalid_arg(key, "missing or not a number"))
}

pub fn opt_f64(args: &Value, key: &str) -> Option<f64> {
    args[key].as_f64()
}

pub fn all() -> Vec<ToolDef> {
    let mut tools = eda::tools();
    tools.extend(engineering::tools());
    tools
}
