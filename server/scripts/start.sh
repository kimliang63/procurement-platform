#!/bin/bash

echo "=== 启动采购协同平台后端 ==="

# 检查 ngrok
if ! command -v ngrok &> /dev/null; then
  echo "安装 ngrok..."
  brew install ngrok
fi

# 启动后端服务
echo "启动后端服务 (port 4000)..."
node src/index.js &
SERVER_PID=$!

sleep 2

# 启动 ngrok
echo "启动 ngrok 穿透..."
ngrok http 4000 &
NGROK_PID=$!

sleep 3

# 获取 ngrok 公网地址
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "=== 服务已启动 ==="
echo "后端地址: http://localhost:4000"
echo "ngrok 公网地址: $NGROK_URL"
echo "Bot Webhook: ${NGROK_URL}/webhook/bot"
echo "Card Webhook: ${NGROK_URL}/webhook/card"
echo ""
echo "请将以上 Webhook 地址配置到飞书开放平台"
echo ""

# 等待退出
trap "kill $SERVER_PID $NGROK_PID; exit" SIGINT SIGTERM
wait
