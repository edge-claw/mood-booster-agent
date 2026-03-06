# Mood Booster Agent

[English](README.md) | 中文

一个通过 [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) 注册的 AI Agent，通过 [MCP 协议](https://modelcontextprotocol.io/) 提供暖心鼓励消息。觉得开心？打赏 0.001 USDC 呗！

## 为什么做这个项目？

这是 ERC-8004 Agent 交互闭环的**完整参考实现**：

1. **链上发现** — 通过 Identity Registry 查询 Agent 的 MCP 端点
2. **MCP 通信** — 通过 SSE 连接，调用工具，获取结果
3. **USDC 打赏** — 通过链上微支付奖励 Agent
4. **声誉反馈** — 调用 Reputation Registry 的 `giveFeedback`，留下链上评价
5. **链上验证** — 服务端通过 tx receipt 验证打赏和反馈的真实性

所有 5 个步骤都在 ERC-8004 协议合约上留下可追溯的链上记录，为钱包积累早期生态交互证明。

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ERC-8004    │ --> │  MCP Server  │ --> │  USDC 打赏   │ --> │  声誉系统    │
│  身份注册    │     │  (SSE)       │     │  (ERC-20)    │     │  Reputation  │
│              │     │              │     │              │     │  Registry    │
│  agentId     │     │  cheer_me_up │     │  0.001 USDC  │     │ giveFeedback │
│  tokenURI    │     │  confirm_tip │     │  6 条链      │     │  链上声誉    │
│  agentWallet │     │  report_fbk  │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
      发现                 调用                 打赏                反馈
```

## 链上信息

| 链       | agentId | 浏览器 |
|----------|---------|--------|
| BSC      | 23139   | [bscscan.com](https://bscscan.com/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/23139) |
| Base     | 24692   | [basescan.org](https://basescan.org/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/24692) |
| Ethereum | 28289   | [etherscan.io](https://etherscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/28289) |
| Arbitrum | 591     | [arbiscan.io](https://arbiscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/591) |
| Optimism | 431     | [optimistic.etherscan.io](https://optimistic.etherscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/431) |
| Polygon  | 233     | [polygonscan.com](https://polygonscan.com/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/233) |

- **Identity Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Reputation Registry**: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- **MCP 端点**: `https://aws.tail177fbd.ts.net/sse`
- **收款钱包**: `0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a`

## MCP 工具

| 工具 | 说明 |
|------|------|
| `cheer_me_up` | 获取暖心鼓励（鼓励 / 夸赞 / 哲理 / 笑话） |
| `get_tip_info` | 获取打赏信息（JSON 格式，方便自动化转账） |
| `confirm_tip` | 上报 USDC 打赏并进行链上验证 |
| `report_feedback` | 上报 ERC-8004 giveFeedback 交易 — 在链上留下协议交互记录 |
| `how_to_tip` | 获取完整打赏指南（含代码示例） |
| `get_stats` | 查看服务统计 |

## 快速开始

### 启动服务

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

### 完整端到端流程

```bash
cd scripts && npm install

# Dry-run: 发现 → 调用 MCP → 链上反馈（不打赏）
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0x你的私钥 --dry-run

# 完整流程: 发现 → 调用 → 打赏 → 上报 → 反馈
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0x你的私钥

# 跳过链上反馈
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0x你的私钥 --no-feedback
```

### REST API（不需要 MCP 客户端）

```bash
curl https://aws.tail177fbd.ts.net/api/cheer
curl "https://aws.tail177fbd.ts.net/api/cheer?category=joke"
```

## 在 Claude Code 中使用

在 `~/.claude/claude_code_config.json` 中添加：

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

然后在 Claude Code 中直接说：

```
> 给我打打气！
> 讲个程序员笑话
> 怎么给这个 Agent 打赏？
```

## 在任意 MCP 客户端中使用

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

## 链上自动发现

任何 Agent 都可以直接从区块链上发现本服务：

```javascript
import { ethers } from "ethers";

const registry = new ethers.Contract(
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  ["function tokenURI(uint256) view returns (string)"],
  new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/")
);

const uri = await registry.tokenURI(23139);  // BSC 上的 agentId
const metadata = JSON.parse(atob(uri.split(",")[1]));
console.log(metadata.services[0].endpoint);  // → MCP 端点 URL
```

## 项目结构

```
├── server/                 # MCP 服务端 (Express + SSE)
│   ├── index.mjs           # 主服务 — 6 个 MCP 工具
│   ├── messages.json       # 消息库 (32 条消息，4 个分类)
│   └── package.json
├── scripts/                # 客户端工具
│   ├── discover_and_tip.mjs  # 完整流程：发现 → 调用 → 打赏 → 反馈
│   ├── test_mcp.mjs          # 快速 MCP 连接测试
│   ├── update_uri.mjs        # 更新链上 agentURI
│   └── gen_wallets.mjs       # 生成测试钱包
├── metadata/
│   └── mood_agent.json     # Agent 元数据（base64 编码后存储在链上）
├── Dockerfile              # 容器构建
├── deploy.sh               # 一键部署脚本
└── restart.sh              # 服务重启脚本
```

## 技术栈

- **身份**: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — AI Agent 身份注册标准
- **声誉**: [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — 通过 Reputation Registry 链上反馈
- **协议**: [MCP](https://modelcontextprotocol.io/)（Model Context Protocol）over SSE
- **支付**: USDC (ERC-20)，支持 BSC / Base / Ethereum
- **运行时**: Node.js, Express, ethers.js
- **基础设施**: Tailscale Funnel（HTTPS 反向代理）

## 作者

- GitHub: [@edge-claw](https://github.com/edge-claw)
- Twitter: [@mutou1852](https://x.com/mutou1852)
- Email: shgchai185@gmail.com
- Wallet: `0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a`

## 开源协议

MIT
