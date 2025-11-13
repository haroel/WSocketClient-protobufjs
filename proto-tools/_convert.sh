#!/bin/bash

# Proto 转 TypeScript 工具 (Shell 版本)

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "========================================"
echo "Proto 转 TypeScript 工具"
echo "========================================"
echo ""

# 检查 Node.js 是否可用
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 node 命令，请先安装 Node.js"
    exit 1
fi

# 检查 pbjs 是否可用
if ! command -v pbjs &> /dev/null; then
    echo "[错误] 未找到 pbjs 命令，请先安装 protobufjs-cli"
    echo "安装命令: npm install -g protobufjs-cli"
    exit 1
fi

echo "开始转换..."
echo ""

# 调用 _convert.js
node _convert.js

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "转换完成!"
    echo "========================================"
else
    echo ""
    echo "[错误] 转换失败"
    exit 1
fi

echo ""

