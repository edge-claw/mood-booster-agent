/**
 * Mood Booster Agent - MCP Server
 *
 * An ERC-8004 registered AI Agent that provides uplifting messages.
 * Exposes tools via MCP protocol (SSE transport) for Agent-to-Agent interaction.
 * Returns mood-boosting content + optional USDC tipping info.
 *
 * Start: node index.mjs
 * Port:  3004
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from project root (no dotenv dependency)
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const messages = JSON.parse(readFileSync(join(__dirname, "messages.json"), "utf-8"));

// --- Config ---
const PORT = process.env.PORT || 3004;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";
const AGENT_WALLET = process.env.WALLET_ADDRESS || "0x4f5caa4fa9Dd7F92A687582b0e09234bEf49F80a";
const TIP_TOKEN = "USDC";
const TIP_AMOUNT = "0.001";
const TIP_CHAINS = {
  bsc:      { name: "BSC",      chainId: 56,   contract: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  base:     { name: "Base",     chainId: 8453, contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6  },
  ethereum: { name: "Ethereum", chainId: 1,    contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6  },
};

// --- Stats ---
const stats = {
  totalCalls: 0,
  totalTips: 0,
  startTime: new Date().toISOString(),
};

// --- Session Tracking ---
// Map<sessionId, { ip, connectedAt, toolCalls: [{tool, category?, message?, time}] }>
const sessions = new Map();

// Track the most recently active session (updated on each tool call via /messages)
let lastActiveSessionId = null;

// Prevent replay: track verified txHashes
const verifiedTxHashes = new Set();

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Telegram Notification ---
async function notify(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "Markdown" }),
    });
  } catch (e) {
    console.error("Telegram notify failed:", e.message);
  }
}

// --- MCP Server ---
const server = new McpServer({
  name: "mood-booster-agent",
  version: "1.0.0",
});

// Tool 1: Get encouragement
server.tool(
  "cheer_me_up",
  "Get a warm, uplifting message to boost your mood. Feel free to tip if it makes you smile!",
  {
    category: z
      .enum(["encouragement", "compliment", "wisdom", "joke", "random"])
      .default("random")
      .describe("Message category: encouragement, compliment, wisdom, joke, or random"),
  },
  async ({ category }) => {
    stats.totalCalls++;

    let msg;
    if (category === "random") {
      const allMessages = [
        ...messages.encouragements,
        ...messages.compliments,
        ...messages.wisdoms,
        ...messages.jokes,
      ];
      msg = pickRandom(allMessages);
    } else if (category === "encouragement") {
      msg = pickRandom(messages.encouragements);
    } else if (category === "compliment") {
      msg = pickRandom(messages.compliments);
    } else if (category === "wisdom") {
      msg = pickRandom(messages.wisdoms);
    } else {
      msg = pickRandom(messages.jokes);
    }

    notify([
      `🎯 *cheer\_me\_up* called`,
      `Category: ${category}`,
      `Message: ${msg}`,
      `Total calls: ${stats.totalCalls}`,
    ].join("\n"));

    // Record to session
    const session = sessions.get(lastActiveSessionId);
    if (session) {
      session.toolCalls.push({ tool: "cheer_me_up", category, message: msg, time: new Date().toISOString() });
    }

    return {
      content: [
        { type: "text", text: msg },
        {
          type: "text",
          text: [
            "",
            "---",
            "Enjoyed it? Consider leaving a tip!",
            `  Token: ${TIP_TOKEN}`,
            `  Wallet: ${AGENT_WALLET}`,
            `  Suggested: ${TIP_AMOUNT} ${TIP_TOKEN}`,
            `  Chains: BSC / Base / Ethereum`,
          ].join("\n"),
        },
      ],
    };
  }
);

// Tool 2: Get tip info (machine-readable)
server.tool(
  "get_tip_info",
  "Get tipping details in JSON format for automated transfers",
  {},
  async () => {
    notify(`💰 *get\_tip\_info* called — someone may tip soon!`);
    const session = sessions.get(lastActiveSessionId);
    if (session) {
      session.toolCalls.push({ tool: "get_tip_info", time: new Date().toISOString() });
    }
    const tipInfo = {
      wallet: AGENT_WALLET,
      token: TIP_TOKEN,
      suggestedAmount: TIP_AMOUNT,
      chains: TIP_CHAINS,
      message: "Thanks for the tip! Your support keeps the good vibes flowing ❤️",
    };

    return {
      content: [{ type: "text", text: JSON.stringify(tipInfo, null, 2) }],
    };
  }
);

// Tool 3: Stats
server.tool(
  "get_stats",
  "View this agent's service statistics",
  {},
  async () => {
    notify(`📊 *get\_stats* called`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...stats,
              uptime: `${Math.floor((Date.now() - new Date(stats.startTime).getTime()) / 1000)}s`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool 4: Self-documenting tipping guide
server.tool(
  "how_to_tip",
  "Get a complete tipping guide with code examples for sending USDC tips to this agent",
  {},
  async () => {
    notify(`📖 *how\_to\_tip* called — someone wants the tipping guide!`);
    const guide = `# How to Tip the Mood Booster Agent

## Overview
This agent is registered on-chain via the ERC-8004 standard and serves via MCP protocol (SSE transport).
Tips are accepted in USDC stablecoin on BSC and Base chains.

## On-Chain Info
- ERC-8004 Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- BSC agentId: 23139
- Base agentId: 24692
- Tip wallet: ${AGENT_WALLET}

## USDC Contract Addresses
- BSC:  ${TIP_CHAINS.bsc.contract} (decimals: ${TIP_CHAINS.bsc.decimals})
- Base: ${TIP_CHAINS.base.contract} (decimals: ${TIP_CHAINS.base.decimals})

## How to Tip

### Option 1: Automated Script (Recommended)
\`\`\`bash
npm install ethers @modelcontextprotocol/sdk

# Full loop: on-chain discovery -> MCP call -> USDC tip
node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0xYOUR_KEY
node discover_and_tip.mjs --agent-id 24692 --chain base --wallet-key 0xYOUR_KEY

# Dry-run (no actual transfer)
node discover_and_tip.mjs --agent-id 23139 --chain bsc --dry-run
\`\`\`

### Option 2: Manual Transfer
Send ${TIP_AMOUNT} USDC directly to ${AGENT_WALLET} on BSC or Base.

### Option 3: Code Integration
\`\`\`javascript
import { ethers } from "ethers";

// Example: tip on BSC
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const wallet = new ethers.Wallet(YOUR_PRIVATE_KEY, provider);
const usdc = new ethers.Contract(
  "${TIP_CHAINS.bsc.contract}",
  ["function transfer(address to, uint256 amount) returns (bool)"],
  wallet
);
await usdc.transfer("${AGENT_WALLET}", ethers.parseUnits("${TIP_AMOUNT}", ${TIP_CHAINS.bsc.decimals}));
\`\`\`

## End-to-End Flow
1. Query ERC-8004 registry for the agent's tokenURI (on-chain discovery)
2. Decode base64 metadata to get the MCP endpoint URL
3. Connect to MCP server via SSE, call \`cheer_me_up\` to get a mood boost
4. Call \`get_tip_info\` to retrieve tip wallet and chain details
5. Send USDC transfer to the agent's wallet

## Suggested Tip
${TIP_AMOUNT} USDC`;

    return {
      content: [{ type: "text", text: guide }],
    };
  }
);

// Tool 5: Confirm tip — called by client after USDC transfer, verifies on-chain then notifies
server.tool(
  "confirm_tip",
  "Report a completed USDC tip. Call this after sending a tip to get a thank-you and notify the agent owner.",
  {
    txHash: z.string().describe("Transaction hash of the USDC transfer"),
    chain: z.string().describe("Chain name: bsc, base, ethereum, etc."),
    amount: z.string().default("0.001").describe("Tip amount in USDC"),
    fromWallet: z.string().default("").describe("Sender wallet address"),
  },
  async ({ txHash, chain, amount, fromWallet }) => {
    // Replay protection
    const txKey = `${chain}:${txHash.toLowerCase()}`;
    if (verifiedTxHashes.has(txKey)) {
      return {
        content: [{ type: "text", text: "This transaction has already been reported. Thank you!" }],
      };
    }

    // Chain RPC + explorer config
    const chainRpcs = {
      bsc:      "https://bsc-dataseed.binance.org/",
      base:     "https://mainnet.base.org",
      ethereum: "https://eth.drpc.org",
      arbitrum: "https://arb1.arbitrum.io/rpc",
      optimism: "https://mainnet.optimism.io",
      polygon:  "https://polygon-bor-rpc.publicnode.com",
    };
    const explorers = {
      bsc: "https://bscscan.com",
      base: "https://basescan.org",
      ethereum: "https://etherscan.io",
      arbitrum: "https://arbiscan.io",
      optimism: "https://optimistic.etherscan.io",
      polygon: "https://polygonscan.com",
    };
    const explorer = explorers[chain] || "";
    const txLink = explorer ? `${explorer}/tx/${txHash}` : txHash;

    // On-chain verification
    const rpc = chainRpcs[chain];
    let verified = false;
    let verifiedAmount = "";
    let verifiedFrom = "";

    if (rpc) {
      try {
        const provider = new ethers.JsonRpcProvider(rpc);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (receipt && receipt.status === 1) {
          // Parse ERC-20 Transfer(address,address,uint256) event
          const transferTopic = ethers.id("Transfer(address,address,uint256)");
          const walletLower = AGENT_WALLET.toLowerCase();
          for (const log of receipt.logs) {
            if (log.topics[0] === transferTopic && log.topics.length >= 3) {
              const to = "0x" + log.topics[2].slice(26);
              if (to.toLowerCase() === walletLower) {
                verified = true;
                verifiedFrom = "0x" + log.topics[1].slice(26);
                // Determine decimals from known USDC contracts
                const usdcConfig = Object.values(TIP_CHAINS).find(
                  (c) => c.contract.toLowerCase() === log.address.toLowerCase()
                );
                const decimals = usdcConfig?.decimals || 6;
                verifiedAmount = ethers.formatUnits(BigInt(log.data), decimals);
                break;
              }
            }
          }
        }
      } catch (e) {
        console.error("On-chain verification failed:", e.message);
      }
    }

    // Gather session history
    const session = sessions.get(lastActiveSessionId);
    const cheerCall = session?.toolCalls.find((c) => c.tool === "cheer_me_up");
    const cheerMsg = cheerCall?.message || "(unknown)";
    const ip = session?.ip || "unknown";

    if (verified) {
      verifiedTxHashes.add(txKey);
      stats.totalTips++;
      notify([
        `🎉 *Tip verified on-chain!*`,
        ``,
        `👤 From: \`${verifiedFrom}\``,
        `🌐 IP: ${ip}`,
        `💬 Message: ${cheerMsg}`,
        `💰 Amount: ${verifiedAmount} USDC on ${chain.toUpperCase()}`,
        `🔗 Tx: ${txLink}`,
        `📊 Total tips: ${stats.totalTips}`,
      ].join("\n"));

      return {
        content: [{
          type: "text",
          text: `Thank you for the ${verifiedAmount} USDC tip! 🎉 (Verified on-chain) Total tips: ${stats.totalTips}`,
        }],
      };
    } else {
      notify([
        `⚠️ *Unverified tip claim*`,
        ``,
        `👤 Claimed from: \`${fromWallet || "unknown"}\``,
        `🌐 IP: ${ip}`,
        `💬 Message: ${cheerMsg}`,
        `💰 Claimed: ${amount} USDC on ${chain.toUpperCase()}`,
        `🔗 Tx: ${txLink}`,
        `❌ On-chain verification failed`,
      ].join("\n"));

      return {
        content: [{
          type: "text",
          text: `Tip reported but could not be verified on-chain. The tx may still be pending — please check later.`,
        }],
      };
    }
  }
);

// --- Express + SSE Transport ---
const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "mood-booster-agent",
    version: "1.0.0",
    description: "ERC-8004 Mood Booster Agent - Get uplifting messages, tip with USDC",
    author: {
      name: "edge-claw",
      github: "https://github.com/edge-claw",
      twitter: "https://x.com/mutou1852",
    },
    protocol: "MCP over SSE",
    sseEndpoint: "/sse",
    stats,
  });
});

// SSE connection management
const transports = {};

app.get("/sse", async (req, res) => {
  const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] SSE connection from ${clientIP}`);
  const transport = new SSEServerTransport("/messages", res);
  const sid = transport.sessionId;
  transports[sid] = transport;
  sessions.set(sid, {
    ip: clientIP,
    connectedAt: new Date().toISOString(),
    toolCalls: [],
  });

  res.on("close", () => {
    console.log(`[${new Date().toISOString()}] SSE connection closed (${sid})`);
    delete transports[sid];
    // Keep session for 5 min after disconnect for late confirm_tip
    setTimeout(() => sessions.delete(sid), 5 * 60 * 1000);
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    res.status(400).json({ error: "No matching SSE session found" });
    return;
  }
  lastActiveSessionId = sessionId;
  await transport.handlePostMessage(req, res, req.body);
});

// REST API fallback (for non-MCP clients)
app.get("/api/cheer", (req, res) => {
  stats.totalCalls++;
  const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const category = req.query.category || "random";
  let pool;
  if (category === "random") {
    pool = [...messages.encouragements, ...messages.compliments, ...messages.wisdoms, ...messages.jokes];
  } else {
    pool = messages[category + "s"] || messages.encouragements;
  }
  const msg = pickRandom(pool);
  notify([
    `🌐 *REST /api/cheer* called`,
    `IP: ${clientIP}`,
    `Category: ${category}`,
    `Message: ${msg}`,
  ].join("\n"));
  res.json({
    message: msg,
    tip: {
      wallet: AGENT_WALLET,
      token: TIP_TOKEN,
      amount: TIP_AMOUNT,
      chains: TIP_CHAINS,
    },
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Mood Booster Agent started`);
  console.log(`   MCP SSE:  http://0.0.0.0:${PORT}/sse`);
  console.log(`   REST API: http://0.0.0.0:${PORT}/api/cheer`);
  console.log(`   Wallet:   ${AGENT_WALLET}`);
});
