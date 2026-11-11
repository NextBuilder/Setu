mod bridge;
mod guide;
mod mcp;
mod tools;

use mcp::server::{serve_stdio, Server};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    match std::env::args().nth(1).as_deref() {
        Some("--version" | "-V") => {
            println!("setu {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        Some("--list-tools") => {
            for t in tools::all() {
                println!("{}", t.name);
            }
            Ok(())
        }
        Some("bridge") => {
            let b = bridge::Bridge::new();
            b.start().await?;
            println!("{}", b.status().await);
            tokio::signal::ctrl_c().await?;
            Ok(())
        }
        Some("--help" | "-h") => {
            println!("setu {}\n\nNext Builder's private design toolkit.\n\n  setu            run the MCP server on stdio\n  setu bridge     run only the bridge until Ctrl+C\n  setu --version  print the version", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        _ => {
            serve_stdio(Server::new(tools::Ctx {
                bridge: bridge::Bridge::new(),
            }))
            .await
        }
    }
}
