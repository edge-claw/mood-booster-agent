/**
 * 快速测试 MCP SSE 连接
 * 直接连接 MCP server，不走链上发现
 *
 * 用法: node test_mcp.mjs [endpoint]
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const endpoint = process.argv[2] || "http://100.90.249.117:3004/sse";

console.log(`\n🔗 连接 MCP Server: ${endpoint}\n`);

try {
  const transport = new SSEClientTransport(new URL(endpoint));
  const client = new Client({ name: "test-client", version: "1.0.0" });

  await client.connect(transport);
  console.log("✅ 连接成功！\n");

  // 列出工具
  const { tools } = await client.listTools();
  console.log(`📋 可用工具 (${tools.length}):`);
  for (const t of tools) {
    console.log(`   - ${t.name}: ${t.description}`);
  }

  // 调用 cheer_me_up
  console.log("\n🎯 调用 cheer_me_up...");
  const result = await client.callTool({ name: "cheer_me_up", arguments: { category: "random" } });
  for (const item of result.content) {
    if (item.type === "text") console.log(`\n   ${item.text}`);
  }

  // 调用 get_tip_info
  console.log("\n💰 调用 get_tip_info...");
  const tipResult = await client.callTool({ name: "get_tip_info", arguments: {} });
  for (const item of tipResult.content) {
    if (item.type === "text") console.log(`   ${item.text}`);
  }

  // 调用 get_stats
  console.log("\n📊 调用 get_stats...");
  const statsResult = await client.callTool({ name: "get_stats", arguments: {} });
  for (const item of statsResult.content) {
    if (item.type === "text") console.log(`   ${item.text}`);
  }

  await client.close();
  console.log("\n✅ 测试完成！MCP 通信正常。");
} catch (err) {
  console.error(`\n❌ 错误: ${err.message}`);
  if (err.cause) console.error(`   原因: ${err.cause.message || err.cause}`);
  process.exit(1);
}
