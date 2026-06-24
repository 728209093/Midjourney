#!/bin/bash
# 天晴了绘图 - 一键部署脚本
# 使用方式：在服务器上 /home/ubuntu/Midjourney 目录执行 bash deploy.sh

set -e

APP_NAME="midjourney"
APP_DIR="/home/ubuntu/Midjourney"
PORT=5000

echo "🚀 开始部署 ${APP_NAME}..."

# 拉取最新代码
echo "📥 拉取最新代码..."
cd "$APP_DIR"
git pull origin master

# 构建 Docker 镜像
echo "🔨 构建 Docker 镜像..."
docker build -t "$APP_NAME" .

# 停止并删除旧容器（如果存在）
echo "🔄 重启容器..."
docker stop "$APP_NAME" 2>/dev/null || true
docker rm "$APP_NAME" 2>/dev/null || true

# 启动新容器
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -e IMAGE_API_URL=https://dahlo.live \
  -e IMAGE_MODEL=gpt-image-2 \
  "$APP_NAME"

# 清理旧镜像
echo "🧹 清理无用镜像..."
docker image prune -f

# 检查状态
echo ""
echo "✅ 部署完成！"
echo "📦 容器状态："
docker ps --filter "name=$APP_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🌐 访问地址：https://draw.dahlo.live"
