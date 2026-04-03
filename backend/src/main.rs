mod chains;
mod config;
mod db;
mod error;
mod types;

mod api;
mod indexer;
mod sweeper;

mod cctp;
mod swap;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "depositoor", about = "ERC20 deposit sweeper")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run the HTTP API server
    Api,
    /// Run the Transfer event indexer for a single chain
    Indexer {
        #[arg(long)]
        chain_id: u64,
        #[arg(long)]
        rpc_url: String,
    },
    /// Run the sweep executor for a single chain
    Sweeper {
        #[arg(long)]
        chain_id: u64,
        #[arg(long)]
        rpc_url: String,
    },
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Command::Api => api::run().await,
        Command::Indexer { chain_id, rpc_url } => indexer::run(chain_id, &rpc_url).await,
        Command::Sweeper { chain_id, rpc_url } => sweeper::run(chain_id, &rpc_url).await,
    }
}
