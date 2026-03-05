# Mood Booster Agent

An ERC-8004 registered AI Agent that delivers uplifting messages via [MCP protocol](https://modelcontextprotocol.io/). Feel good? Tip 0.001 USDC!

## What is this?

A complete **Agent-to-Agent interaction demo** built on top of [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (AI Agent Identity Registry):

1. **On-chain discovery** — Query ERC-8004 registry to find the agent and its metadata
2. **MCP service call** — Connect to the agent's MCP endpoint via SSE, invoke tools
3. **USDC tipping** — Send a micro-tip as a reward for the service

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  ERC-8004    │  -->  │  MCP Server  │  -->  │  USDC Tip    │
│  Registry    │       │  (SSE)       │       │  (ERC-20)    │
│              │       │              │       │              │
│  agentId     │       │  cheer_me_up │       │  0.001 USDC  │
│  tokenURI    │       │  get_tip_info│       │  BSC / Base  │
│  agentWallet │       │  how_to_tip  │       │              │
└──────────────┘       └──────────────┘       └──────────────┘
    Discover               Call                   Tip
```

## On-Chain Info

| Chain | agentId | Explorer |
|-------|---------|----------|
| BSC   | 23139   | [bscscan.com](https://bscscan.com/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/23139) |
| Base  | 24692   | [basescan.org](https://basescan.org/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/24692) |

- **Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **MCP Endpoint**: `https://aws.tail177fbd.ts.net/sse`
- **Tip Wallet**: `0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a`

## Project Structure

```
├── server/                 # MCP Server (Express + SSE)
│   ├── index.mjs           # Main server — 4 MCP tools
│   ├── messages.json       # Message library (32 messages, 4 categories)
│   └── package.json
├── scripts/                # Client tools
│   ├── discover_and_tip.mjs  # Full loop: discover → call → tip
│   ├── test_mcp.mjs          # Quick MCP connection test
│   ├── update_uri.mjs        # Update on-chain agentURI
│   └── gen_wallets.mjs       # Generate test wallets
├── metadata/
│   └── mood_agent.json     # Agent metadata (stored on-chain as base64)
├── deploy.sh               # One-click deploy to server
└── restart.sh              # Server restart script
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `cheer_me_up` | Get a warm, uplifting message (encouragement / compliment / wisdom / joke) |
| `get_tip_info` | Get tipping details in JSON format for automated transfers |
| `get_stats` | View service statistics |
| `how_to_tip` | Get a complete tipping guide with code examples |

## Quick Start

### Run the server

```bash
cd server
npm install
node index.mjs
# MCP SSE: http://localhost:3004/sse
# REST API: http://localhost:3004/api/cheer
```

### Test MCP connection

```bash
cd scripts
npm install
node test_mcp.mjs http://localhost:3004/sse
```

### Full end-to-end loop

```bash
# Dry-run (no actual transfer)
node discover_and_tip.mjs --agent-id 23139 --chain bsc --dry-run

# With USDC tip
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0xYOUR_KEY
node discover_and_tip.mjs --agent-id 24692 --chain base --wallet-key 0xYOUR_KEY
```

### REST API (no MCP client needed)

```bash
curl https://aws.tail177fbd.ts.net/api/cheer
curl "https://aws.tail177fbd.ts.net/api/cheer?category=joke"
```

## Use with Claude Code

Add this to your `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "mood-booster": {
      "type": "sse",
      "url": "https://aws.tail177fbd.ts.net/sse"
    }
  }
}
```

Then in Claude Code you can say:

```
> Cheer me up!
> Tell me a programming joke
> How do I tip this agent?
```

Claude will automatically call the MCP tools and respond with uplifting messages.

## Use with Any MCP Client

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(new URL("https://aws.tail177fbd.ts.net/sse"));
const client = new Client({ name: "my-agent", version: "1.0.0" });

await client.connect(transport);
const result = await client.callTool({ name: "cheer_me_up", arguments: { category: "random" } });
console.log(result.content[0].text);
await client.close();
```

## On-Chain Discovery

Any agent can discover this service directly from the blockchain — no manual configuration needed:

```javascript
import { ethers } from "ethers";

const registry = new ethers.Contract(
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  ["function tokenURI(uint256) view returns (string)"],
  new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/")
);

const uri = await registry.tokenURI(23139);  // agentId on BSC
const metadata = JSON.parse(atob(uri.split(",")[1]));
console.log(metadata.services[0].endpoint);  // → MCP endpoint URL
```

## Tech Stack

- **Identity**: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — AI Agent Identity Registry
- **Protocol**: [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) over SSE
- **Payment**: USDC (ERC-20) on BSC and Base
- **Runtime**: Node.js, Express, ethers.js
- **Infrastructure**: Tailscale Funnel (HTTPS reverse proxy)

## Author

- GitHub: [@edge-claw](https://github.com/edge-claw)
- Twitter: [@mutou1852](https://x.com/mutou1852)
- Email: shgchai185@gmail.com
- Wallet: `0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a`

## License

MIT
