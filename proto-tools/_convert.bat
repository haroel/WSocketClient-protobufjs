@echo off
chcp 65001 >nul
setlocal

REM 切换到脚本所在目录
cd /d "%~dp0"

echo ========================================
echo Proto 转 TypeScript 工具
echo ========================================
echo.

REM 检查 Node.js 是否可用
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 node 命令，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 pbjs 是否可用
where pbjs >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 pbjs 命令，请先安装 protobufjs-cli
    echo 安装命令: npm install -g protobufjs-cli
    pause
    exit /b 1
)

echo 开始转换...
echo.

REM 调用 _convert.js
node _convert.js

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 转换完成!
    echo ========================================
) else (
    echo.
    echo [错误] 转换失败
)

echo.
pause

