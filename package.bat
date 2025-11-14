@echo off
chcp 65001 >nul
setlocal

REM 切换到脚本所在目录
cd /d "%~dp0"

echo ========================================
echo 打包项目文件
echo ========================================
echo.

REM 设置输出文件名（包含时间戳）
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set datetime=%datetime:~0,8%-%datetime:~8,6%
set zipfile=WSocketClient-protobufjs-%datetime%.zip

echo 正在压缩文件...
echo.

REM 使用 PowerShell 压缩文件
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$files = @('assets', 'proto-tools', 'settings', 'package.json', 'README.md', 'tsconfig.json');" ^
    "$zipPath = '%zipfile%';" ^
    "if (Test-Path $zipPath) { Remove-Item $zipPath -Force };" ^
    "$files | ForEach-Object { if (Test-Path $_) { Write-Host \"  添加: $_\" } else { Write-Warning \"  警告: $_ 不存在\" } };" ^
    "Compress-Archive -Path $files -DestinationPath $zipPath -Force;" ^
    "if (Test-Path $zipPath) { Write-Host \"`n✅ 打包完成: $zipPath\" } else { Write-Error \"❌ 打包失败\" }"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 打包成功!
    echo ========================================
    echo.
    echo 文件位置: %cd%\%zipfile%
) else (
    echo.
    echo ========================================
    echo 打包失败!
    echo ========================================
)

echo.
pause

