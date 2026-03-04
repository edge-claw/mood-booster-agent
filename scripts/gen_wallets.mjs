/**
 * 生成测试钱包
 *
 * 用法: node gen_wallets.mjs [数量]
 *
 * 生成指定数量的 EVM 钱包，输出地址和私钥。
 * 结果同时追加到 ../.env 文件中。
 */

import { Wallet } from "ethers";
import { appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const count = parseInt(process.argv[2]) || 3;

console.log(`\n🔑 生成 ${count} 个测试钱包\n`);
console.log("⚠️  仅用于测试，切勿存放大额资产！\n");

const envPath = join(__dirname, "..", ".env");
const lines = ["\n# --- 测试钱包 (自动生成) ---"];

for (let i = 0; i < count; i++) {
  const wallet = Wallet.createRandom();
  const label = `WALLET_${i + 1}`;

  console.log(`${label}:`);
  console.log(`  地址: ${wallet.address}`);
  console.log(`  私钥: ${wallet.privateKey}`);
  console.log();

  lines.push(`${label}_ADDRESS=${wallet.address}`);
  lines.push(`${label}_KEY=${wallet.privateKey}`);
}

appendFileSync(envPath, lines.join("\n") + "\n");
console.log(`✅ 已追加到 ${envPath}`);
console.log("\n下一步: 给这些钱包转入少量 BNB (gas) + USDT (打赏)");
