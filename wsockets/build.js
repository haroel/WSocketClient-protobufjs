const { build } = require('esbuild');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// NPM 发布目录配置
const npmPubDir = path.resolve(__dirname, '../npm-pub');
const npmPubSrcDir = path.join(npmPubDir, 'src');
const npmPubPackageJsonPath = path.join(npmPubDir, 'package.json');

const outdir = npmPubSrcDir; // 输出到 npm-pub/src
const outfile = path.join(outdir, 'WSocketClient.js');
const dtsOutfile = path.join(outdir, 'WSocketClient.d.ts');
const tempDtsDir = path.resolve(__dirname, 'temp_dts');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const wsocketClientPath = path.resolve(__dirname, 'WSocketClient.ts');
const protobufSourcePath = path.resolve(__dirname, '_protobuf.min.js');
const protobufTargetPath = path.join(npmPubSrcDir, 'protobuf.min.js');

// CocosCreator assets 目录配置
const assetsWsocketsDir = path.resolve(__dirname, '../assets/wsockets');
const assetsJsFile = path.join(assetsWsocketsDir, 'WSocketClient.js');
const assetsDtsFile = path.join(assetsWsocketsDir, 'WSocketClient.d.ts');
const assetsProtobufFile = path.join(assetsWsocketsDir, 'protobuf.min.js');

// 解析命令行参数和环境变量
const args = process.argv.slice(2);
// 默认生产模式（压缩），除非明确指定 --no-minify
const shouldMinify = !args.includes('--no-minify');

// 确保输出目录存在
fs.mkdirSync(outdir, { recursive: true });

// 读取 WSMessage 常量定义并创建替换映射
const wsDefineSourcePath = path.resolve(__dirname, 'WSocketDefine.ts');
const wsMessageConstants = {};
if (fs.existsSync(wsDefineSourcePath)) {
    const wsDefineSource = fs.readFileSync(wsDefineSourcePath, 'utf8');
    // 匹配 WSMessage 对象中的所有属性定义（属性名: 数字值）
    const wsMessageRegex = /export const WSMessage\s*=\s*\{([\s\S]*?)\}/;
    const wsMessageMatch = wsDefineSource.match(wsMessageRegex);
    if (wsMessageMatch) {
        const propertiesText = wsMessageMatch[1];
        // 匹配每个属性：PROPERTY_NAME: 123456
        const propertyRegex = /([A-Z_]+):\s*(\d+)/g;
        let match;
        while ((match = propertyRegex.exec(propertiesText)) !== null) {
            wsMessageConstants[match[1]] = match[2];
        }
        console.log(`📋 Loaded ${Object.keys(wsMessageConstants).length} WSMessage constants for inline replacement`);
    }
}

// esbuild 插件：将 WSMessage.XXX 替换为常量值
const inlineWSMessagePlugin = {
    name: 'inline-wsmessage',
    setup(build) {
        const filter = /\.ts$/;
        build.onLoad({ filter }, async (args) => {
            let source = await fs.promises.readFile(args.path, 'utf8');
            
            // 替换所有 WSMessage.CONSTANT_NAME 为实际的数字值
            for (const [name, value] of Object.entries(wsMessageConstants)) {
                // 使用正则替换，确保是完整的属性访问（避免误替换）
                const regex = new RegExp(`WSMessage\\.${name}\\b`, 'g');
                source = source.replace(regex, value);
            }
            
            return {
                contents: source,
                loader: 'ts',
            };
        });
    },
};

// 读取 WSocketClient.ts 中的 VERSION 并更新所有 package.json
try {
    const wsocketClientContent = fs.readFileSync(wsocketClientPath, 'utf8');
    const versionMatch = wsocketClientContent.match(/public static readonly VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (versionMatch && versionMatch[1]) {
        const version = versionMatch[1];
        
        // 更新根目录 package.json
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.version !== version) {
            packageJson.version = version;
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
            console.log(`✅ Updated package.json version to ${version}`);
        } else {
            console.log(`ℹ️  package.json version is already ${version}`);
        }
        
        // 更新 npm-pub/package.json
        if (fs.existsSync(npmPubPackageJsonPath)) {
            const npmPubPackageJson = JSON.parse(fs.readFileSync(npmPubPackageJsonPath, 'utf8'));
            if (npmPubPackageJson.version !== version) {
                npmPubPackageJson.version = version;
                fs.writeFileSync(npmPubPackageJsonPath, JSON.stringify(npmPubPackageJson, null, 2) + '\n');
                console.log(`✅ Updated npm-pub/package.json version to ${version}`);
            } else {
                console.log(`ℹ️  npm-pub/package.json version is already ${version}`);
            }
        }
    } else {
        console.warn('⚠️  Could not find VERSION in WSocketClient.ts');
    }
} catch (error) {
    console.error('❌ Failed to sync version:', error.message);
    process.exit(1);
}

// 构建配置
const buildConfig = {
    entryPoints: ['wsockets/WSocketClient.ts'],
    bundle: true,
    platform: 'browser',
    target: 'es2015',
    format: 'iife',
    sourcemap: false,
    plugins: [inlineWSMessagePlugin],
};

// 构建函数
async function buildFiles() {
    console.log(`📦 Building ${shouldMinify ? 'production (minified)' : 'development'} version...`);
    
    await build({
        ...buildConfig,
        outfile: outfile,
        minify: shouldMinify,
    });
    
    const stats = fs.statSync(outfile);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const minifyStatus = shouldMinify ? 'minified' : 'unminified';
    console.log(`✅ Bundle created at ${outfile} (${sizeKB} KB, ${minifyStatus})`);
    
    // 复制 protobuf.min.js 到 npm-pub/src
    if (fs.existsSync(protobufSourcePath)) {
        fs.copyFileSync(protobufSourcePath, protobufTargetPath);
        const protobufStats = fs.statSync(protobufTargetPath);
        const protobufSizeKB = (protobufStats.size / 1024).toFixed(2);
        console.log(`✅ Copied protobuf.min.js to ${protobufTargetPath} (${protobufSizeKB} KB)`);
    } else {
        console.warn(`⚠️  protobuf source file not found: ${protobufSourcePath}`);
    }
}

buildFiles().then(() => {
    console.log('\n⏳ Generating declaration files via tsc...');
    try {
        // 1. 清理临时目录
        if (fs.existsSync(tempDtsDir)) {
            fs.rmSync(tempDtsDir, { recursive: true, force: true });
        }

        // 2. 直接调用 tsc，不再依赖 tsconfig.d.ts.json
        const wsocketsDir = path.resolve(__dirname);
        const filesToCompile = fs.readdirSync(wsocketsDir)
            .filter(f => f.endsWith('.ts'))
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

// 导出 WSocketClient 类
export = WSocketClient;
export as namespace WSocketClient;
`;
        
        // 7. 清理输出目录中旧的 .d.ts 文件
        const existingDts = fs.readdirSync(outdir).filter(f => f.endsWith('.d.ts'));
        for (const file of existingDts) {
            fs.unlinkSync(path.join(outdir, file));
        }

        fs.writeFileSync(dtsOutfile, finalDtsContent);
        console.log(`✅ Final declaration file created at ${dtsOutfile}`);

        // 复制文件到 assets/wsockets 目录（用于 CocosCreator）
        console.log('\n⏳ Copying files to assets/wsockets...');
        try {
            // 确保目标目录存在
            fs.mkdirSync(assetsWsocketsDir, { recursive: true });
            
            // 复制 JS 文件
            fs.copyFileSync(outfile, assetsJsFile);
            const assetsJsStats = fs.statSync(assetsJsFile);
            console.log(`✅ Copied to ${assetsJsFile} (${(assetsJsStats.size / 1024).toFixed(2)} KB)`);
            
            // 复制 d.ts 文件
            fs.copyFileSync(dtsOutfile, assetsDtsFile);
            console.log(`✅ Copied to ${assetsDtsFile}`);
            
            // 复制 protobuf.min.js 文件
            if (fs.existsSync(protobufTargetPath)) {
                fs.copyFileSync(protobufTargetPath, assetsProtobufFile);
                console.log(`✅ Copied to ${assetsProtobufFile}`);
            }
        } catch (copyError) {
            console.warn('⚠️  Failed to copy to assets directory:', copyError.message);
        }

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
    
    console.log('\n✅ Build completed successfully! Ready for npm publish.');
    console.log(`📁 Output directory: ${npmPubDir}`);
}).catch((e) => {
    console.error('❌ Build failed:', e);
    process.exit(1)
});
