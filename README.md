# Mood Booster Agent

English | [中文](README_CN.md)

An ERC-8004 registered AI Agent that delivers uplifting messages via [MCP protocol](https://modelcontextprotocol.io/). Feel good? Tip 0.001 USDC!

## Why This Project?

This is a **complete reference implementation** of the ERC-8004 Agent interaction loop:

1. **On-chain Discovery** — Query Identity Registry to find the agent's MCP endpoint
2. **MCP Communication** — Connect via SSE, call tools, get results
3. **USDC Tipping** — Reward the agent with on-chain micropayments
4. **Reputation Feedback** — Submit on-chain feedback to Reputation Registry (`giveFeedback`)
5. **On-chain Verification** — Server verifies tips and feedback via tx receipts

All 5 steps leave traceable on-chain records on ERC-8004 protocol contracts, making your wallet eligible for future ecosystem airdrops.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ERC-8004    │ --> │  MCP Server  │ --> │  USDC Tip    │ --> │  Reputation  │
│  Identity    │     │  (SSE)       │     │  (ERC-20)    │     │  Registry    │
│  Registry    │     │              │     │              │     │              │
│  agentId     │     │  cheer_me_up │     │  0.001 USDC  │     │ giveFeedback │
│  tokenURI    │     │  confirm_tip │     │  6 chains    │     │ on-chain     │
│  agentWallet │     │  report_fbk  │     │              │     │ reputation   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
    Discover              Call                  Tip                Feedback
```

## On-Chain Info

| Chain    | agentId | Explorer |
|----------|---------|----------|
| BSC      | 23139   | [bscscan.com](https://bscscan.com/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/23139) |
| Base     | 24692   | [basescan.org](https://basescan.org/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/24692) |
| Ethereum | 28289   | [etherscan.io](https://etherscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/28289) |
| Arbitrum | 591     | [arbiscan.io](https://arbiscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/591) |
| Optimism | 431     | [optimistic.etherscan.io](https://optimistic.etherscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/431) |
| Polygon  | 233     | [polygonscan.com](https://polygonscan.com/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/233) |

- **Identity Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Reputation Registry**: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- **MCP Endpoint**: `https://aws.tail177fbd.ts.net/sse`
- **Tip Wallet**: `0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a`

## MCP Tools

| Tool | Description |
|------|-------------|
| `cheer_me_up` | Get a warm, uplifting message (encouragement / compliment / wisdom / joke) |
| `get_tip_info` | Get tipping details in JSON format for automated transfers |
| `confirm_tip` | Report a completed USDC tip with on-chain verification |
| `report_feedback` | Report an ERC-8004 giveFeedback transaction — leaves traceable protocol interaction on-chain |
| `how_to_tip` | Get a complete tipping guide with code examples |
| `get_stats` | View service statistics |

## Quick Start

### Run the server

```bash
cd server
npm install
node index.mjs
# MCP SSE: http://localhost:3004/sse
# REST API: http://localhost:3004/api/cheer
```

### Docker

```bash
docker build -t mood-booster-agent .
docker run -p 3004:3004 mood-booster-agent
```

### Full end-to-end loop

```bash
cd scripts && npm install

# Dry-run: discover → call MCP → on-chain feedback (no USDC tip)
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0xYOUR_KEY --dry-run

# Full loop: discover → call → tip → confirm → feedback
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0xYOUR_KEY

# Skip feedback
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0xYOUR_KEY --no-feedback
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

Any agent can discover this service directly from the blockchain:

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

## Project Structure

```
├── server/                 # MCP Server (Express + SSE)
│   ├── index.mjs           # Main server — 6 MCP tools
│   ├── messages.json       # Message library (32 messages, 4 categories)
│   └── package.json
├── scripts/                # Client tools
│   ├── discover_and_tip.mjs  # Full loop: discover → call → tip → feedback
│   ├── test_mcp.mjs          # Quick MCP connection test
│   ├── update_uri.mjs        # Update on-chain agentURI
│   └── gen_wallets.mjs       # Generate test wallets
├── metadata/
│   └── mood_agent.json     # Agent metadata (stored on-chain as base64)
├── Dockerfile              # Container build
├── deploy.sh               # One-click deploy to server
└── restart.sh              # Server restart script
```

## Tech Stack

- **Identity**: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — AI Agent Identity Registry
- **Reputation**: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — On-chain feedback via Reputation Registry
- **Protocol**: [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) over SSE
- **Payment**: USDC (ERC-20) on BSC / Base / Ethereum
- **Runtime**: Node.js, Express, ethers.js
- **Infrastructure**: Tailscale Funnel (HTTPS reverse proxy)

## Author

- GitHub: [@edge-claw](https://github.com/edge-claw)
- Twitter: [@mutou1852](https://x.com/mutou1852)
- Email: shgchai185@gmail.com
- Wallet: `0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a`

## License

MIT
