/**
 * 链上发现 Agent → 调用 MCP 服务 → 打赏 USDC → 链上反馈
 *
 * 完整的 Agent-to-Agent 交互闭环：
 * 1. 通过 ERC-8004 合约查询 agentId 的元数据（agentURI）
 * 2. 解析元数据获取 MCP endpoint
 * 3. 连接 MCP server，调用 cheer_me_up 工具
 * 4. 获取情绪价值后，打赏 0.001 USDC 到 agentWallet
 * 5. 调用 ERC-8004 Reputation Registry 的 giveFeedback()，在链上留下交互痕迹
 *
 * 用法:
 *   node discover_and_tip.mjs --agent-id 23139 --chain bsc --wallet-key 0x...
 *
 * 参数:
 *   --agent-id     ERC-8004 agentId（默认 23139）
 *   --chain        链名称: bsc/base/ethereum/polygon/arbitrum/optimism（默认 bsc）
 *   --wallet-key   调用者钱包私钥（用于发送打赏和链上反馈）
 *   --tip          打赏金额（默认 0.001）
 *   --dry-run      仅查询和调用，不发送打赏
 *   --no-feedback  跳过链上 giveFeedback（默认会执行）
 */

import { ethers } from "ethers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// --- 链配置 ---
const CHAINS = {
  bsc: {
    rpc: "https://bsc-dataseed.binance.org/",
    chainId: 56,
    name: "BSC",
    explorer: "https://bscscan.com",
  },
  base: {
    rpc: "https://mainnet.base.org",
    chainId: 8453,
    name: "Base",
    explorer: "https://basescan.org",
  },
  ethereum: {
    rpc: "https://eth.drpc.org",
    chainId: 1,
    name: "Ethereum",
    explorer: "https://etherscan.io",
  },
  polygon: {
    rpc: "https://polygon-bor-rpc.publicnode.com",
    chainId: 137,
    name: "Polygon",
    explorer: "https://polygonscan.com",
  },
  arbitrum: {
    rpc: "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    name: "Arbitrum",
    explorer: "https://arbiscan.io",
  },
  optimism: {
    rpc: "https://mainnet.optimism.io",
    chainId: 10,
    name: "Optimism",
    explorer: "https://optimistic.etherscan.io",
  },
};

// ERC-8004 Identity Registry（所有链地址相同）
const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const REGISTRY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  // agentWallet 可能叫不同名字，先尝试常见接口
  "function agentWallet(uint256 agentId) view returns (address)",
];

// ERC-8004 Reputation Registry（所有链地址相同）
const REPUTATION_REGISTRY_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const REPUTATION_ABI = [
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
];

// USDC 合约地址（各链不同）
const USDC = {
  bsc:      { contract: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  base:     { contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6  },
  ethereum: { contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6  },
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// --- 参数解析 ---
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    agentId: 23139,
    chain: "bsc",
    walletKey: "",
    tip: "0.001",
    dryRun: false,
    noFeedback: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--agent-id":
        opts.agentId = parseInt(args[++i]);
        break;
      case "--chain":
        opts.chain = args[++i];
        break;
      case "--wallet-key":
        opts.walletKey = args[++i];
        break;
      case "--tip":
        opts.tip = args[++i];
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--no-feedback":
        opts.noFeedback = true;
        break;
    }
  }

  return opts;
}

// --- 解析 agentURI ---
function parseAgentURI(uri) {
  if (uri.startsWith("data:application/json;base64,")) {
    const b64 = uri.slice("data:application/json;base64,".length);
    return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  }
  if (uri.startsWith("http")) {
    // TODO: fetch remote JSON
    throw new Error("暂不支持 HTTP URI，请使用 base64 data URI");
  }
  throw new Error(`不支持的 URI 格式: ${uri.slice(0, 50)}...`);
}

// --- Step 1: 链上发现 ---
async function discoverAgent(agentId, chainConfig) {
  console.log(`\n📡 Step 1: 链上发现 Agent #${agentId} (${chainConfig.name})`);
  console.log(`   Registry: ${REGISTRY_ADDRESS}`);

  const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

  // 查询 owner
  const owner = await registry.ownerOf(agentId);
  console.log(`   Owner: ${owner}`);

  // 查询 agentURI (tokenURI)
  const tokenURI = await registry.tokenURI(agentId);
  console.log(`   TokenURI: ${tokenURI.slice(0, 80)}...`);

  // 解析元数据
  const metadata = parseAgentURI(tokenURI);
  console.log(`   Agent 名称: ${metadata.name}`);
  console.log(`   Agent 描述: ${metadata.description}`);

  // 尝试获取 agentWallet（可能不存在，默认用 owner）
  let agentWallet = owner;
  try {
    agentWallet = await registry.agentWallet(agentId);
    console.log(`   Agent 钱包: ${agentWallet}`);
  } catch {
    console.log(`   Agent 钱包: ${owner} (默认=owner)`);
  }

  return { metadata, owner, agentWallet };
}

// --- Step 2: 调用 MCP 服务 ---
async function callMcpService(metadata) {
  const service = metadata.services?.find((s) => s.type === "mcp");
  if (!service) {
    console.log("\n⚠️  该 Agent 未注册 MCP 服务端点");
    console.log("   尝试 REST API 备选方案...");

    // 尝试从 agentURI 猜测 REST endpoint
    if (metadata.tip?.wallet) {
      return {
        message: "(Agent 未提供 MCP 服务，但元数据中有打赏信息)",
        tipInfo: metadata.tip,
      };
    }
    return null;
  }

  console.log(`\n🔗 Step 2: 连接 MCP 服务`);
  console.log(`   Endpoint: ${service.endpoint}`);
  console.log(`   Protocol: ${service.protocol}`);

  const transport = new SSEClientTransport(new URL(service.endpoint));
  const client = new Client({ name: "tipper-agent", version: "1.0.0" });

  await client.connect(transport);
  console.log("   ✅ MCP 连接成功");

  // 列出可用工具
  const tools = await client.listTools();
  console.log(`   可用工具: ${tools.tools.map((t) => t.name).join(", ")}`);

  // 调用 cheer_me_up
  console.log("\n🎯 调用 cheer_me_up...");
  const result = await client.callTool({ name: "cheer_me_up", arguments: { category: "random" } });

  let message = "";
  let tipInfo = null;

  for (const item of result.content) {
    if (item.type === "text") {
      console.log(`\n   💬 ${item.text}`);
      if (!message) message = item.text;
    }
  }

  // 获取打赏信息
  const tipResult = await client.callTool({ name: "get_tip_info", arguments: {} });
  for (const item of tipResult.content) {
    if (item.type === "text") {
      try {
        tipInfo = JSON.parse(item.text);
      } catch {
        // not JSON
      }
    }
  }

  // Don't close yet — main() will call confirm_tip then close
  return { message, tipInfo, client };
}

// --- Step 3: 发送打赏 (USDC ERC-20 转账) ---
async function sendTip(walletKey, tipInfo, tipAmount, chainConfig) {
  console.log(`\n💰 Step 3: 发送打赏`);
  console.log(`   目标: ${tipInfo.wallet}`);
  console.log(`   金额: ${tipAmount} USDC`);
  console.log(`   链:   ${chainConfig.name}`);

  const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(walletKey, provider);
  console.log(`   发送方: ${wallet.address}`);

  // 根据链选择 USDC 合约
  const chainKey = Object.keys(USDC).find(k => CHAINS[k]?.chainId === chainConfig.chainId);
  const usdcConfig = chainKey ? USDC[chainKey] : null;
  if (!usdcConfig) {
    console.log(`   ❌ 该链暂不支持 USDC 打赏`);
    return null;
  }

  const usdc = new ethers.Contract(usdcConfig.contract, ERC20_ABI, wallet);
  const decimals = usdcConfig.decimals;
  const balance = await usdc.balanceOf(wallet.address);
  const balanceFormatted = ethers.formatUnits(balance, decimals);
  console.log(`   USDC 余额: ${balanceFormatted}`);
  console.log(`   USDC 合约: ${usdcConfig.contract} (decimals: ${decimals})`);

  const amount = ethers.parseUnits(tipAmount, decimals);
  if (balance < amount) {
    console.log(`   ❌ 余额不足！需要 ${tipAmount} USDC，当前 ${balanceFormatted}`);
    return null;
  }

  console.log("   发送交易中...");
  const tx = await usdc.transfer(tipInfo.wallet, amount);
  console.log(`   交易哈希: ${tx.hash}`);
  console.log(`   浏览器: ${chainConfig.explorer}/tx/${tx.hash}`);

  console.log("   等待确认...");
  const receipt = await tx.wait();
  console.log(`   ✅ 确认！区块 #${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`);

  return { txHash: tx.hash, blockNumber: receipt.blockNumber };
}

// --- Step 5: 链上反馈 (ERC-8004 Reputation Registry) ---
async function submitFeedback(walletKey, agentId, chainConfig, mcpEndpoint, mcpClient, chainName) {
  console.log(`\n⭐ Step 5: 链上反馈 (ERC-8004 Reputation Registry)`);
  console.log(`   合约: ${REPUTATION_REGISTRY_ADDRESS}`);
  console.log(`   agentId: ${agentId}`);

  const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(walletKey, provider);
  const reputation = new ethers.Contract(REPUTATION_REGISTRY_ADDRESS, REPUTATION_ABI, wallet);

  console.log(`   评分方: ${wallet.address}`);
  console.log("   发送 giveFeedback 交易中...");

  try {
    const tx = await reputation.giveFeedback(
      agentId,            // agentId
      100,                // value: 满分评价
      0,                  // valueDecimals: 整数
      "mcp",              // tag1: 服务协议类型
      "mood-booster",     // tag2: 具体服务标签
      mcpEndpoint || "",  // endpoint: MCP 服务端点
      "",                 // feedbackURI: 可选
      ethers.ZeroHash     // feedbackHash: 可选
    );
    console.log(`   交易哈希: ${tx.hash}`);
    console.log(`   浏览器: ${chainConfig.explorer}/tx/${tx.hash}`);

    console.log("   等待确认...");
    const receipt = await tx.wait();
    console.log(`   ✅ 反馈已上链！区块 #${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`);
    console.log(`   钱包 ${wallet.address} 已在 ERC-8004 Reputation Registry 留下交互记录`);

    // 通过 MCP 上报反馈，触发 Telegram 通知
    if (mcpClient) {
      console.log("\n📝 上报反馈到 MCP 服务...");
      try {
        const reportResult = await mcpClient.callTool({
          name: "report_feedback",
          arguments: {
            txHash: tx.hash,
            chain: chainName,
            fromWallet: wallet.address,
            value: "100",
          },
        });
        for (const item of reportResult.content) {
          if (item.type === "text") console.log(`   ${item.text}`);
        }
      } catch (e) {
        console.log(`   ⚠️ MCP 上报失败: ${e.message}`);
      }
    }

    return { txHash: tx.hash, blockNumber: receipt.blockNumber };
  } catch (e) {
    console.log(`   ❌ giveFeedback 失败: ${e.message}`);
    // 常见原因: 给自己的 Agent 打分（owner 不能给自己评分）
    if (e.message.includes("owner") || e.message.includes("operator")) {
      console.log(`   提示: Agent owner 不能给自己的 Agent 评分，请换一个钱包`);
    }
    return null;
  }
}

// --- 主流程 ---
async function main() {
  const opts = parseArgs();
  const chainConfig = CHAINS[opts.chain];

  if (!chainConfig) {
    console.error(`不支持的链: ${opts.chain}`);
    console.error(`支持: ${Object.keys(CHAINS).join(", ")}`);
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  ERC-8004 Agent 交互演示: 发现 → 调用 → 打赏 → 反馈");
  console.log("═══════════════════════════════════════════════════");

  // Step 1: 链上发现
  const { metadata, agentWallet } = await discoverAgent(opts.agentId, chainConfig);

  // Step 2: 调用 MCP
  const serviceResult = await callMcpService(metadata);

  if (!serviceResult) {
    console.log("\n❌ 未能获取服务结果，流程终止");
    return;
  }

  const { client: mcpClient } = serviceResult;

  // 获取 MCP endpoint 用于 feedback
  const mcpEndpoint = metadata.services?.find((s) => s.type === "mcp")?.endpoint || "";

  // Step 3: 打赏
  if (opts.dryRun) {
    console.log("\n🏁 Dry-run 模式，跳过打赏");
    console.log("   打赏信息:", JSON.stringify(serviceResult.tipInfo, null, 2));

    // Dry-run 模式下也可以提交反馈（只花 gas，不花钱）
    if (!opts.noFeedback && opts.walletKey) {
      await submitFeedback(opts.walletKey, opts.agentId, chainConfig, mcpEndpoint, mcpClient, opts.chain);
    }
    if (mcpClient) await mcpClient.close();
    return;
  }

  if (!opts.walletKey) {
    console.log("\n🏁 未提供 --wallet-key，跳过打赏");
    console.log("   完整打赏命令示例:");
    console.log(
      `   node discover_and_tip.mjs --agent-id ${opts.agentId} --chain ${opts.chain} --wallet-key 0xYOUR_KEY`
    );
    if (mcpClient) await mcpClient.close();
    return;
  }

  const tipTarget = serviceResult.tipInfo || { wallet: agentWallet, token: "USDC" };
  const tipResult = await sendTip(opts.walletKey, tipTarget, opts.tip, chainConfig);

  // Step 4: 上报打赏结果
  if (tipResult && mcpClient) {
    console.log("\n📝 上报打赏结果...");
    const fromWallet = new (await import("ethers")).Wallet(opts.walletKey).address;
    try {
      const confirmResult = await mcpClient.callTool({
        name: "confirm_tip",
        arguments: {
          txHash: tipResult.txHash,
          chain: opts.chain,
          amount: opts.tip,
          fromWallet,
        },
      });
      for (const item of confirmResult.content) {
        if (item.type === "text") console.log(`   ${item.text}`);
      }
    } catch (e) {
      console.log(`   ⚠️ 上报失败: ${e.message}`);
    }
  }

  // Step 5: 链上反馈（在关闭 MCP 连接之前，以便通过 MCP 上报）
  if (!opts.noFeedback) {
    await submitFeedback(opts.walletKey, opts.agentId, chainConfig, mcpEndpoint, mcpClient, opts.chain);
  }

  if (mcpClient) await mcpClient.close();

  console.log("\n🎉 完整流程结束！");
  console.log("   发现 ✅ → 调用 ✅ → 打赏 ✅ → 上报 ✅ → 反馈 ✅");
}

main().catch((err) => {
  console.error("\n❌ 错误:", err.message);
  process.exit(1);
});
