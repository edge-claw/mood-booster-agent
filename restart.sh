#!/bin/bash
# 重启 MCP server
source ~/.nvm/nvm.sh
pkill -f 'node.*index.mjs' 2>/dev/null
sleep 1
cd ~/cc/erc8004/server
nohup node index.mjs > mood-agent.log 2>&1 &
sleep 2
cat mood-agent.log
