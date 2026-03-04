#!/bin/bash
# 部署情绪价值 Agent 到 AWS
# 用法: ./deploy.sh

set -e

REMOTE="aws"
REMOTE_DIR="~/cc/erc8004/server"
LOCAL_DIR="$(dirname "$0")/server"

echo "📦 部署 Mood Booster Agent 到 AWS..."

# 同步文件
echo "1. 同步文件到 $REMOTE:$REMOTE_DIR"
rsync -avz --delete "$LOCAL_DIR/" "$REMOTE:$REMOTE_DIR/"

# 安装依赖并启动
echo "2. 安装依赖并启动服务"
ssh "$REMOTE" "source ~/.nvm/nvm.sh && cd $REMOTE_DIR && npm install && echo '依赖安装完成'"

# 停止旧进程
ssh "$REMOTE" "pkill -f 'node.*index.mjs.*3004' 2>/dev/null || true"

# 启动（nohup 后台运行）
ssh "$REMOTE" "source ~/.nvm/nvm.sh && cd $REMOTE_DIR && nohup node index.mjs > mood-agent.log 2>&1 &"

sleep 2

# 验证
echo "3. 验证服务状态"
if ssh "$REMOTE" "curl -s http://localhost:3004/ | head -1" | grep -q "mood-booster"; then
  echo "✅ 服务已启动！"
  echo "   MCP SSE: http://100.90.249.117:3004/sse"
  echo "   REST:    http://100.90.249.117:3004/api/cheer"
  echo "   日志:    ssh aws 'tail -f ~/cc/erc8004/server/mood-agent.log'"
else
  echo "❌ 启动失败，检查日志:"
  ssh "$REMOTE" "cat $REMOTE_DIR/mood-agent.log"
fi
