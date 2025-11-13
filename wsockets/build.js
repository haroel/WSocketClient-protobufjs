const { build } = require('esbuild');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const outdir = path.resolve(__dirname, '../assets/wsockets');
const outfile = path.join(outdir, 'WSocketClient.js');
const dtsOutfile = path.join(outdir, 'WSocketClient.d.ts');
const tempDtsDir = path.resolve(__dirname, 'temp_dts');

// 确保输出目录存在
fs.mkdirSync(outdir, { recursive: true });

build({
    entryPoints: ['wsockets/WSocketClient.ts'],
    bundle: true,
    outfile: outfile,
    platform: 'browser',
    target: 'es2015',
    minify: true,
}).then(() => {
    console.log(`✅ Bundle created at ${outfile}`);
    console.log('⏳ Generating declaration files via tsc...');
    try {
        // 1. 清理临时目录
        if (fs.existsSync(tempDtsDir)) {
            fs.rmSync(tempDtsDir, { recursive: true, force: true });
        }

        // 2. 直接调用 tsc，不再依赖 tsconfig.d.ts.json
        const wsocketsDir = path.resolve(__dirname);
        const filesToCompile = fs.readdirSync(wsocketsDir)
            .filter(f => f.endsWith('.ts') || f.endsWith('.d.ts'))
            .map(f => path.join('wsockets', f));
        
        const tscCommand = `npx tsc ${filesToCompile.join(' ')} --declaration --emitDeclarationOnly --outDir ${tempDtsDir} --target es2015 --lib es2015,dom --strict false --moduleResolution node --skipLibCheck`;
        execSync(tscCommand);
        console.log(`✅ Raw declaration files created in ${tempDtsDir}`);

        console.log('⏳ Optimizing and consolidating declaration file...');
        
        // 3. 定义 TypeScript 内置类型集合，用于过滤
        const builtinTypes = new Set(['undefined', 'null', 'void', 'never', 'unknown', 'any', 'boolean', 'number', 'string', 'object', 'symbol', 'bigint']);
        
        // 找到所有声明的类型
        const declarations = new Set();
        const dtsFiles = fs.readdirSync(tempDtsDir).filter(f => f.endsWith('.d.ts'));

        for (const file of dtsFiles) {
            const content = fs.readFileSync(path.join(tempDtsDir, file), 'utf8');
            const declarationRegex = /export declare (?:class|interface|const|enum|type)\s+(\w+)/g;
            let match;
            while ((match = declarationRegex.exec(content)) !== null) {
                const typeName = match[1];
                // 过滤掉内置类型
                if (!builtinTypes.has(typeName)) {
                    declarations.add(typeName);
                }
            }
        }

        // 4. 读取 WSocketClient.d.ts 的内容并进行清理
        let clientDtsContent = fs.readFileSync(path.join(tempDtsDir, 'WSocketClient.d.ts'), 'utf8');
        clientDtsContent = clientDtsContent.replace(/^import[\s\S]*?from\s*['"].*?['"];\n/gm, '');

        const clientRegex = /(export declare class WSocketClient\s*\{[\s\S]*?\n\})/;
        const clientMatch = clientDtsContent.match(clientRegex);
        if (!clientMatch) {
            throw new Error("Could not find 'export declare class WSocketClient' in the generated d.ts file.");
        }
        let clientDeclaration = clientMatch[0].replace('export declare', 'declare');
        clientDeclaration = clientDeclaration.replace(/^\s*private\s+[\s\S]*?;\n/gm, '');

        // 强制将内部依赖替换为 any，使用更精确的匹配避免误替换 WSocketClient
        clientDeclaration = clientDeclaration.replace(/: WSocketProtoBuf\b/g, ': any');
        clientDeclaration = clientDeclaration.replace(/: WSocket\b(?![C])/g, ': any');

        // 4.1. 从源文件读取并提取 WSMessage 错误码定义
        let wsMessageDeclaration = '';
        const wsDefineSourcePath = path.resolve(__dirname, 'WSocketDefine.ts');
        if (fs.existsSync(wsDefineSourcePath)) {
            let wsDefineSource = fs.readFileSync(wsDefineSourcePath, 'utf8');
            
            // 提取 WSMessage 的完整定义，包括前面的注释和整个对象
            // 匹配从 "WebSocket 客户端错误码定义" 注释开始到 WSMessage 对象结束的完整内容
            const wsMessageRegex = /\/\*\*[\s\S]*?WebSocket 客户端错误码定义[\s\S]*?\*\/\s*export const WSMessage\s*=\s*\{[\s\S]*?\n\}/;
            const wsMessageMatch = wsDefineSource.match(wsMessageRegex);
            if (wsMessageMatch) {
                // 将 export const 改为 declare const，并处理对象语法
                wsMessageDeclaration = wsMessageMatch[0]
                    .replace(/export const WSMessage\s*=\s*\{/, 'declare const WSMessage: {')
                    // 将对象属性从 , 改为 ;（匹配属性名: 数字, 的模式）
                    .replace(/([A-Z_]+):\s*(\d+),/g, '$1: $2;')
                    // 确保结尾是 };
                    .replace(/\n\s*\}$/, '\n};');
            }
        }

        // 5. 为其他类型创建 'any' 存根
        // 过滤掉 WSocketClient、WSMessage 和所有 TypeScript 内置类型
        const stubs = [];
        for (const name of declarations) {
            if (name !== 'WSocketClient' && name !== 'WSMessage' && !builtinTypes.has(name)) {
                stubs.push(`declare type ${name} = any;`);
            }
        }
        
        // 6. 组合最终的 d.ts 内容
        // 移除 __global 的完整定义（如果存在），只保留存根
        let finalContent = '';
        if (wsMessageDeclaration) {
            finalContent += wsMessageDeclaration + '\n';
        }
        finalContent += clientDeclaration;
        
        // 移除可能存在的 __global 完整定义（export const __global = ...）
        finalContent = finalContent.replace(/\/\*\*[\s\S]*?全局对象[\s\S]*?\*\/\s*export const __global[\s\S]*?Object\.create\(null\);/g, '');
        
        const finalDtsContent = `/**
 * Auto-generated by build.js
 * Contains a simplified global declaration for WSocketClient.
 * All internal dependencies are replaced with 'any'.
 */

${stubs.join('\n')}

${finalContent}
`;
        
        // 7. 清理 assets 目录中旧的 .d.ts 文件
        const existingDts = fs.readdirSync(outdir).filter(f => f.endsWith('.d.ts'));
        for (const file of existingDts) {
            fs.unlinkSync(path.join(outdir, file));
        }

        fs.writeFileSync(dtsOutfile, finalDtsContent);
        console.log(`✅ Final declaration file created at ${dtsOutfile}`);

    } catch (error) {
        const errorMessage = error.stdout ? error.stdout.toString() : error.message;
        console.error('❌ Failed to generate or optimize declaration file:', errorMessage);
        process.exit(1);
    } finally {
        // 8. 清理临时目录
        if (fs.existsSync(tempDtsDir)) {
            fs.rmSync(tempDtsDir, { recursive: true, force: true });
            console.log('✅ Temporary files cleaned up.');
        }
    }
}).catch((e) => {
    console.error('❌ Build failed:', e);
    process.exit(1)
});
