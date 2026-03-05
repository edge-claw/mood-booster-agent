/**
 * 更新链上 agentURI
 *
 * 读取 metadata/mood_agent.json，base64 编码后调用
 * ERC-8004 合约的 setAgentURI(agentId, newURI)
 *
 * 用法:
 *   node update_uri.mjs --chain bsc
 *   node update_uri.mjs --chain base
 *   node update_uri.mjs --all
 *   node update_uri.mjs --dry-run   (仅生成 URI，不发交易)
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- 配置 ---
const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REGISTRY_ABI = [
  "function setAgentURI(uint256 agentId, string agentURI)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

const CHAINS = {
  bsc:      { rpc: "https://bsc-dataseed.binance.org/",  agentId: 23139 },
  base:     { rpc: "https://mainnet.base.org",            agentId: 24692 },
  ethereum: { rpc: "https://ethereum-rpc.publicnode.com",      agentId: 28289 },
  arbitrum: { rpc: "https://arb1.arbitrum.io/rpc",        agentId: 591   },
  optimism: { rpc: "https://mainnet.optimism.io",         agentId: 431   },
  polygon:  { rpc: "https://polygon-bor-rpc.publicnode.com",    agentId: 233   },
};

// 从 .env 读取私钥
function loadPrivateKey() {
  const envContent = readFileSync(join(__dirname, "..", ".env"), "utf-8");
  const match = envContent.match(/^PRIVATE_KEY=(.+)$/m);
  if (!match) throw new Error(".env 中未找到 PRIVATE_KEY");
  return match[1].trim();
}

// 生成 data URI
function buildAgentURI() {
  const metadata = JSON.parse(
    readFileSync(join(__dirname, "..", "metadata", "mood_agent.json"), "utf-8")
  );
  const jsonStr = JSON.stringify(metadata, null, 0);
  const b64 = Buffer.from(jsonStr).toString("base64");
  return { uri: `data:application/json;base64,${b64}`, metadata };
}

async function updateChain(chainName, chainConfig, privateKey, agentURI) {
  console.log(`\n🔄 更新 ${chainName.toUpperCase()} (agentId: ${chainConfig.agentId})`);

  const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

  const tx = await registry.setAgentURI(chainConfig.agentId, agentURI);
  console.log(`   交易: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`   ✅ 已确认，区块 #${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`);

  return tx.hash;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const chainArg = args.find((a) => a !== "--dry-run" && a !== "--all" && !a.startsWith("--"))
    || (args.includes("--chain") ? args[args.indexOf("--chain") + 1] : null);

  const { uri, metadata } = buildAgentURI();

  console.log("═══════════════════════════════════════════");
  console.log("  ERC-8004 agentURI 更新工具");
  console.log("═══════════════════════════════════════════");
  console.log(`\n📄 元数据:`);
  console.log(`   名称: ${metadata.name}`);
  console.log(`   服务: ${metadata.services?.length || 0} 个`);
  if (metadata.services?.[0]) {
    console.log(`   端点: ${metadata.services[0].endpoint}`);
  }
  console.log(`\n📦 Data URI (${uri.length} bytes):`);
  console.log(`   ${uri.slice(0, 80)}...`);

  if (dryRun) {
    console.log("\n🏁 Dry-run 模式，不发送交易");
    console.log(`\n完整 URI:\n${uri}`);
    return;
  }

  const privateKey = loadPrivateKey();
  const targets = all ? Object.keys(CHAINS) : chainArg ? [chainArg] : ["bsc"];

  for (const chain of targets) {
    if (!CHAINS[chain]) {
      console.log(`\n⚠️  跳过未知链: ${chain}`);
      continue;
    }
    try {
      await updateChain(chain, CHAINS[chain], privateKey, uri);
    } catch (err) {
      console.log(`   ❌ ${chain} 失败: ${err.message}`);
    }
  }

  console.log("\n🎉 完成！");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
