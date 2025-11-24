#!/usr/bin/env node

/**
 * Proto 转 TypeScript 工具
 * 功能：
 * 1. 将 proto-tools 目录下所有 proto 文件转成 JSON 对象
 * 2. 解析 ProtoConfig.csv
 * 3. 生成 proto.ts 文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 工具版本号
const VERSION = 'v1.1';

// 获取脚本所在目录
const SCRIPT_DIR = __dirname;
const PROTO_DIR = SCRIPT_DIR;
const OUTPUT_TS = path.join(SCRIPT_DIR, 'proto.ts');
const TEMP_JSON = path.join(SCRIPT_DIR, 'temp_protos.json');
const CSV_FILE = path.join(SCRIPT_DIR, 'ProtoConfig.csv');

// 项目根目录
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

/**
 * 读取目录下所有 proto 文件
 */
function getProtoFiles(dir) {
    const files = fs.readdirSync(dir);
    return files
        .filter(file => file.endsWith('.proto'))
        .map(file => path.join(dir, file));
}

/**
 * 递归搜索目录下所有 proto.ts 文件
 */
function findProtoTsFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) {
        return fileList;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // 递归搜索子目录
            findProtoTsFiles(filePath, fileList);
        } else if (file === 'proto.ts') {
            // 找到 proto.ts 文件
            fileList.push(filePath);
        }
    }

    return fileList;
}

/**
 * 最小化 proto 文件内容（移除注释和多余空白）
 */
function minifyProtoContent(content) {
    // 移除单行注释 //
    content = content.replace(/\/\/.*$/gm, '');
    // 移除多行注释 /* */
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // 移除多余的空白行（保留一个换行）
    content = content.replace(/\n\s*\n+/g, '\n');
    // 移除行首尾空白
    content = content.split('\n').map(line => line.trim()).join('\n');
    // 移除首尾空白
    content = content.trim();
    return content;
}

/**
 * 读取所有 proto 文件并生成 proto_define 对象
 */
function loadProtoFiles(protoFiles) {
    if (protoFiles.length === 0) {
        throw new Error('未找到任何 proto 文件');
    }

    console.log(`[处理] 找到 ${protoFiles.length} 个 proto 文件:`);
    
    const protoDefine = {};
    let packageName = '';
    
    protoFiles.forEach(file => {
        const fileName = path.basename(file);
        console.log(`  - ${fileName}`);
        
        // 读取文件内容
        const content = fs.readFileSync(file, 'utf8');
        
        // 提取包名（取第一个文件的包名）
        if (!packageName) {
            const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
            if (packageMatch) {
                packageName = packageMatch[1];
            }
        }
        
        // 最小化内容
        const minified = minifyProtoContent(content);
        
        // 以文件名为 key 存储
        protoDefine[fileName] = minified;
    });

    console.log(`[成功] Proto 文件已加载，package: "${packageName}"`);
    
    return { protoDefine, packageName };
}

/**
 * 读取并解析 JSON 文件
 */
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`读取 JSON 文件失败: ${error.message}`);
    }
}

/**
 * 解析 CSV 文件
 * 格式：cmdMerge,request,response
 */
function parseCsvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`[警告] CSV 文件不存在: ${path.basename(filePath)}`);
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        console.log(`[警告] CSV 文件格式不正确或为空`);
        return [];
    }

    // 跳过标题行
    const dataLines = lines.slice(1);
    const configs = [];

    for (const line of dataLines) {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 3) {
            const cmdMerge = parseInt(parts[0], 10);
            const request = parts[1] || '';
            const response = parts[2] || '';
            if (!isNaN(cmdMerge)) {
                configs.push([cmdMerge, request, response]);
            }
        }
    }

    console.log(`[解析] CSV 文件: ${dataLines.length} 条配置`);
    return configs;
}

/**
 * 将 JSON 对象转换为 TypeScript 代码字符串
 */
function jsonToTsString(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    const nextIndent = indent + 1;
    const nextSpaces = '  '.repeat(nextIndent);

    if (obj === null) {
        return 'null';
    }

    if (typeof obj === 'string') {
        // 转义字符串中的特殊字符
        return JSON.stringify(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const items = obj.map(item => {
            const itemStr = jsonToTsString(item, nextIndent);
            return `${nextSpaces}${itemStr}`;
        });
        return `[\n${items.join(',\n')}\n${spaces}]`;
    }

    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(key => {
            const value = jsonToTsString(obj[key], nextIndent);
            const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
            return `${nextSpaces}${keyStr}: ${value}`;
        });
        return `{\n${items.join(',\n')}\n${spaces}}`;
    }

    return String(obj);
}

/**
 * 获取当前日期时间戳字符串
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 检查所有 proto 文件的包名是否一致
 */
function validatePackageNames(protoFiles) {
    const packageNames = new Set();
    
    protoFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const packageMatch = content.match(/package\s+([\w.]+)\s*;/);
        if (packageMatch) {
            packageNames.add(packageMatch[1]);
        }
    });
    
    if (packageNames.size > 1) {
        const packages = Array.from(packageNames).join(', ');
        throw new Error(`检测到多个不一致的包名 (Package Names): [${packages}]。\n请检查所有 .proto 文件的 package 声明是否一致。`);
    }
}


/**
 * 生成 proto.ts 文件
 */
function generateProtoTs(protoDefine, packageName, configs) {
    // 生成 proto_define 对象字符串
    const protoDefineStr = jsonToTsString(protoDefine);

    // 生成 configs 数组代码
    const configsStr = configs.map(config => {
        return `    [${config[0]}, ${JSON.stringify(config[1])}, ${JSON.stringify(config[2])}]`;
    }).join(',\n');

    // 获取生成时间戳
    const timestamp = getTimestamp();

    const tsContent = `
/** 
 * 注意：该脚本由 proto-tools/convert 工具生成，请勿手动修改！
 * 生成时间: ${timestamp} 
 * 工具版本: ${VERSION} 
 * proto_define 格式：{ "文件名.proto": "proto内容字符串" }
 **/

const proto_define = ${protoDefineStr};

const configs = [
  // cmdMerge: 命令合并值（业务路由）, request: 请求消息类型, response: 响应消息类型
${configsStr}
];

const proto_configs = new Map();

for (let item of configs) {
  item[1] = String(item[1]).trim();
  item[2] = String(item[2]).trim();
  proto_configs.set(item[0], item);
}
export const proto_config = {
  package: "${packageName}",
  proto_define: proto_define,
  proto_configs: proto_configs
}
`;

    return tsContent;
}

/**
 * 主函数
 */
function main() {
    try {
        console.log('========================================');
        console.log('Proto/CSV 转 TypeScript');
        console.log(`版本: ${VERSION}`);
        console.log('========================================\n');

        // 1. 获取所有 proto 文件
        const protoFiles = getProtoFiles(PROTO_DIR);
        if (protoFiles.length === 0) {
            throw new Error('proto-tools 目录下未找到任何 .proto 文件');
        }

        // 2. 验证包名一致性
        console.log('[检查] 验证 package 声明...');
        validatePackageNames(protoFiles);
        console.log('[成功] 所有 proto 文件的 package 声明一致\n');

        // 3. 加载并最小化 proto 文件
        const { protoDefine, packageName } = loadProtoFiles(protoFiles);
        console.log('');

        // 4. 解析 CSV
        console.log('[解析] ProtoConfig.csv...');
        const configs = parseCsvFile(CSV_FILE);
        console.log('');

        // 5. 生成 TypeScript 内容
        console.log('[生成] proto.ts 内容...');
        const tsContent = generateProtoTs(protoDefine, packageName, configs);
        console.log('[成功] TypeScript 内容已生成\n');

        // 7. 搜索目标文件并写入
        console.log('[写入] 正在搜索项目中的 proto.ts 文件...');
        const assetsDir = path.join(PROJECT_ROOT, 'assets');
        const targetFiles = findProtoTsFiles(assetsDir);

        if (targetFiles.length === 0) {
            console.log('[提示] 未在 assets 目录下找到 proto.ts 文件。将在当前目录生成。');
            fs.writeFileSync(OUTPUT_TS, tsContent, 'utf8');
            console.log(`[成功] proto.ts 已生成: ${path.basename(OUTPUT_TS)}\n`);
        } else {
            console.log(`[找到] 共找到 ${targetFiles.length} 个 proto.ts 文件，正在替换...`);
            for (const targetFile of targetFiles) {
                try {
                    fs.writeFileSync(targetFile, tsContent, 'utf8');
                    console.log(`  ✓ ${path.relative(PROJECT_ROOT, targetFile)}`);
                } catch (error) {
                    console.log(`  ✗ ${path.relative(PROJECT_ROOT, targetFile)} (失败: ${error.message})`);
                }
            }
            console.log('[成功] 所有找到的 proto.ts 文件已更新。\n');
        }

        // 6. 清理临时文件（如果存在旧的 JSON 文件）
        if (fs.existsSync(TEMP_JSON)) {
            fs.unlinkSync(TEMP_JSON);
            console.log('[清理] 旧的临时 JSON 文件已删除');
        }

        console.log('\n========================================');
        console.log('转换完成!');
        console.log('========================================');
        console.log('');
        console.log('📋 文件位置:');
        if (targetFiles.length > 0) {
            targetFiles.forEach(file => {
                console.log(`   - ${path.relative(PROJECT_ROOT, file)}`);
            });
        } else {
            console.log(`   - ${path.relative(PROJECT_ROOT, OUTPUT_TS)}`);
        }
        console.log('');

    } catch (error) {
        console.error(`\n[错误] ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { parseCsvFile, generateProtoTs };

