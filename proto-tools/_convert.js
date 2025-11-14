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
 * 调用 pbjs 将 proto 文件转换为 JSON
 */
function convertProtoToJson(protoFiles, outputFile) {
    if (protoFiles.length === 0) {
        throw new Error('未找到任何 proto 文件');
    }

    console.log(`[处理] 找到 ${protoFiles.length} 个 proto 文件:`);
    protoFiles.forEach(file => {
        console.log(`  - ${path.basename(file)}`);
    });

    // 构建 pbjs 命令
    const protoFilesStr = protoFiles.map(f => `"${f}"`).join(' ');
    const command = `pbjs -t json ${protoFilesStr} -o "${outputFile}"`;

    console.log(`[转换] 正在转换为 JSON...`);
    try {
        execSync(command, { stdio: 'inherit', cwd: SCRIPT_DIR });
        console.log(`[成功] JSON 文件已生成: ${path.basename(outputFile)}`);
    } catch (error) {
        throw new Error(`pbjs 转换失败: ${error.message}`);
    }
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
 * 将 pbjs 生成的反射格式 JSON 转换为旧版 loadJson 兼容的定义格式。
 * @param {object} reflectionJson The JSON output from `pbjs -t json`.
 * @returns {{definition: object, packageName: string}} The definition JSON and package name.
 */
function convertReflectionToDefinition(reflectionJson) {
    let packageName = '';
    let mainNamespace = null;

    // 递归查找包含消息/枚举定义的第一个命名空间
    function findMainNamespace(node, currentPath) {
        if (mainNamespace) return; // 找到后停止

        const children = node.nested || {};
        const hasDefinitions = Object.values(children).some(child => child && (child.fields || child.values));

        if (hasDefinitions) {
            packageName = currentPath.join('.');
            mainNamespace = node;
        } else {
            for (const key in children) {
                if (children[key] && children[key].nested) {
                    findMainNamespace(children[key], [...currentPath, key]);
                }
            }
        }
    }

    findMainNamespace(reflectionJson, []);

    if (!mainNamespace) {
        throw new Error("在反射JSON中找不到包含消息/枚举定义的命名空间。");
    }

    const definition = {
        package: packageName,
        messages: [],
        enums: [],
        options: mainNamespace.options || {},
    };

    const items = mainNamespace.nested || {};

    for (const name in items) {
        const item = items[name];
        if (!item) continue;

        if (item.fields) { // Message
            const fields = Object.entries(item.fields).map(([fieldName, fieldData]) => {
                const field = {
                    rule: fieldData.rule || (fieldData.repeated ? 'repeated' : 'optional'),
                    type: fieldData.type,
                    name: fieldName,
                    id: fieldData.id
                };
                if (fieldData.options) field.options = fieldData.options;
                return field;
            });
            definition.messages.push({ name: name, fields: fields });
        } else if (item.values) { // Enum
            definition.enums.push({
                name: name,
                values: Object.entries(item.values).map(([valueName, id]) => ({ name: valueName, id: id }))
            });
        }
    }
    return { definition, packageName };
}


/**
 * 生成 proto.ts 文件
 */
function generateProtoTs(definitionJson, packageName, configs) {
    const protoDefineStr = jsonToTsString(definitionJson);

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
 * 工具版本: ${VERSION} **/

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
  protoName: "proto.json",
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

        // 2. 转换为 JSON
        convertProtoToJson(protoFiles, TEMP_JSON);
        console.log('');

        // 3. 读取 JSON
        console.log('[读取] JSON 文件...');
        const reflectionJson = readJsonFile(TEMP_JSON);
        console.log('[成功] JSON 文件读取完成\n');

        // 4. 将反射格式转换为定义格式
        console.log('[转换] 正在转换 JSON 格式以兼容 loadJson...');
        const { definition, packageName } = convertReflectionToDefinition(reflectionJson);
        console.log(`[成功] JSON 格式已转换, package: "${packageName}"\n`);

        // 5. 解析 CSV
        console.log('[解析] ProtoConfig.csv...');
        const configs = parseCsvFile(CSV_FILE);
        console.log('');

        // 6. 生成 TypeScript 内容
        console.log('[生成] proto.ts 内容...');
        const tsContent = generateProtoTs(definition, packageName, configs);
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

        // 8. 清理临时文件
        if (fs.existsSync(TEMP_JSON)) {
            fs.unlinkSync(TEMP_JSON);
            console.log('[清理] 临时文件已删除');
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

