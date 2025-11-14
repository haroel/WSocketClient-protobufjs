# WSocketClient-protobufjs

一个基于 WebSocket 和 Protobuf 的适用于CocosCreator等JS运行环境的通信库，支持自动重连、心跳检测、消息序列化等功能。

## 功能特性

- ✅ WebSocket 连接管理，单例模式设计
- ✅ Protobuf 消息序列化/反序列化
- ✅ 自动断线重连
- ✅ 心跳检测与服务器时间同步
- ✅ 请求/响应模式（CS 模式）
- ✅ 服务器推送消息监听（通知模式）
- ✅ 协议超时检测
- ✅ 完整的 TypeScript 类型支持
- ✅ 支持CocosCreator2.x/3.x版本，理论上不限引擎类型
- ✅ 支持App、HTML5和小游戏渠道

## 目录结构

```
WSocketClient-protobufjs/
├── proto-tools/           # Protobuf 转换工具
│   ├── _convert.js        # 转换脚本
│   ├── _convert.bat       # Windows 批处理脚本
│   ├── _convert.sh        # Linux/Mac Shell 脚本
│   ├── *.proto            # Protobuf 定义文件（服务器方提供）
│   └── ProtoConfig.csv    # 协议配置表（服务器方提供）
├── assets/wsockets/       # 构建输出目录
│   ├── protobuf.min.js    # Protobuf 库文件（需导入为插件）
│   ├── WSocketClient.js   # 打包后的 JS 文件（需导入为插件）
│   ├── WSocketClient.d.ts # TypeScript 声明文件
│   └── proto.ts           # _convert工具生成的协议文件
├── cacert.pem             # 【可选】SSL/TLS 证书文件（Android wss 连接需要，CocosCreator 3.5+ 不需要）
└── package.json
```

> 注意：`protobuf.min.js`已包含`protobufjs`、`ByteBuffer`、`Long`，请勿再次安装集成。

## 安装

1. 解压框架包zip
2. 将其中的assets/wsockets和proto-tools拷贝到工程对应目录中
3. 安装依赖
```bash
npm install
```


## 使用 WSocketClient

### 基本使用

```typescript
// 1. 获取单例实例
const client = WSocketClient.getInstance();

// 2. 设置协议配置（必须在使用前调用）
import { proto_config } from './wsockets/proto';
client.setConfig(proto_config);

// 3. 连接服务器
client.connect("ws://localhost:8080/websocket", (success, client) => {
    if (success) {
        console.log("连接成功");
    } else {
        console.log("连接失败");
    }
});

// 4. 发送消息（请求/响应模式）
client.send("LoginReq", { accountId: "user123" }, (msgName, response) => {
    if (response.code === 0) {
        console.log("登录成功", response.data);
    } else {
        console.log("登录失败", response.code);
    }
});

// 5. 监听服务器推送消息
client.onNTF("UserMessage", (msgName, response) => {
    console.log("收到推送消息", response.data);
});

// 6. 关闭连接
client.close();
```

### 配置选项

```typescript
const client = WSocketClient.getInstance();

// 自定义配置
client.config = {
    /**
     * WebSocket 类构造函数，默认使用浏览器自带的 WebSocket
     * 可以替换为自定义的 WebSocket 实现（如 Node.js 的 ws 库）
     */
    WebSocket: WebSocket,
    
    /**
     * 连接重试次数
     * 当连接失败时，最多重试的次数
     * @default 3
     */
    connectRetry: 3,
    
    /**
     * 连接重连间隔（毫秒）
     * 每次重连之间的等待时间
     * @default 5000
     */
    connectInterval: 5000,
    
    /**
     * 连接超时时间（毫秒）
     * 从开始连接到连接成功或失败的最大等待时间
     * @default 10000
     */
    connectTimeout: 10000,
    
    /**
     * 协议超时时间（毫秒）
     * 发送请求后等待响应的最大时间，超过此时间将触发 onProtocolTimeout 回调
     * @default 10000
     */
    protocolTimeout: 10000,
    
    /**
     * 心跳超时时间（毫秒）
     * 心跳响应超时时间，超过此时间未收到心跳响应将断开连接
     * @default 15000
     */
    heartbeatTimeout: 15000,
    
    /**
     * 心跳间隔时间（毫秒）
     * 每隔多长时间发送一次心跳包
     * @default 5000
     */
    heartbeatInterval: 5000,
    
    /**
     * WS状态检测间隔时间（毫秒）
     * @default 1000
     */
    tickInterval: 1000,
    
    /**
     * 自动断线重连，默认开启
     * 当连接意外断开时，是否自动尝试重新连接
     * @default true
     */
    autoReconnect: true,
    
    /**
     * 【Android】wss连接pem证书，CocosCreator3.5+以上不再需要此参数
     * 参考 https://forum.cocos.org/t/topic/151320/4
     * 示例: "assets/cacert.pem" 或 "res/cacert.pem"
     */
    cacert: "",
    
    /**
     * 状态变化回调函数
     * @param state 新的连接状态（NONE、DISCONNECTED、CONNECTING、CONNECTTED）
     */
    onStateChange: (state) => {
        console.log("状态变化", state);
    },
    
    /**
     * 连接超时回调函数（主动断开连接）
     * 当连接超时时触发
     */
    onConnectTimeout: () => {
        console.log("连接超时");
    },
    
    /**
     * 自动重连开始回调函数
     * 当开始自动重连时触发
     */
    onAutoReconnectStart: () => {
        console.log("开始重连");
    },
    
    /**
     * 自动重连结束回调函数
     * @param success 重连是否成功
     */
    onAutoReconnectEnd: (success) => {
        console.log("重连结果", success);
    },
    
    /**
     * 协议超时回调函数（不会主动断开连接），每个协议只可能触发一次心跳超时回调
     * @param request 超时的请求对象，包含 seqId、time、msgName 等信息
     */
    onProtocolTimeout: (request) => {
        console.log("协议超时", request);
    },
    
    /**
     * 心跳超时回调函数（主动断开连接）
     * 当心跳响应超时时触发
     */
    onHeartbeatTimeout: () => {
        console.log("心跳超时");
    },
    
    /**
     * 心跳回调函数
     * 每次发送心跳包后触发
     */
    onHeartbeat: () => {
        console.log("心跳");
    },
    
    /**
     * WebSocket 连接打开回调函数
     * 当 WebSocket 连接成功建立时触发
     */
    onOpen: () => {
        console.log("连接已打开");
    },
    
    /**
     * WebSocket 连接关闭回调函数
     * 当 WebSocket 连接关闭时触发
     */
    onClose: () => {
        console.log("连接已关闭");
    },
    
    /**
     * WebSocket 错误回调函数
     * 当 WebSocket 发生错误时触发
     */
    onError: () => {
        console.log("连接错误");
    },
    
    /**
     * 消息接收回调函数
     * 当收到服务器消息时触发（在消息分发到具体回调之前触发，可以在这里对消息进行统一拦截处理）
     * @param msg 解码后的外部消息对象
     */
    onMessage: (msg) => {
        console.log("收到消息", msg);
    }
};
```

### API 参考

> 可通过`WSocketClient.d.ts`查看完整接口说明

#### 静态属性

- `WSocketClient.NONE` (0) - 初始状态
- `WSocketClient.DISCONNECTED` (1) - 断连状态
- `WSocketClient.CONNECTING` (2) - 正在连接状态
- `WSocketClient.CONNECTTED` (3) - 连接成功状态
- `WSocketClient.protobuf` - protobufjs 对象

#### 静态方法

- `WSocketClient.getInstance()` - 获取单例实例

#### 实例属性

- `config` - 配置对象

#### 实例方法

- `setConfig(proto_config)` - 设置协议配置
- `connect(serverURL, callback)` - 连接服务器
- `close(code?)` - 关闭连接
- `send(msgName, payload, callback)` - 发送消息
- `onNTF(msgName, callback, priority?)` - 监听推送消息
- `offNTF(msgName, callback?)` - 取消监听
- `reset()` - 重置所有状态
- `setState(val)` - 设置连接状态

#### Getter 属性

- `wsocket` - 获取 WebSocket 实例
- `url` - 获取当前连接的 URL
- `isConnected` - 是否已连接
- `isReconnecting` - 是否正在重连
- `state` - 当前连接状态
- `ping` - 服务器与客户端的时间差（毫秒）
- `serverTime` - 服务器当前时间（毫秒时间戳）

### 完整示例

```typescript
import { proto_config } from './wsockets/proto';

// 获取客户端实例
const client = WSocketClient.getInstance();

// 配置回调
client.config.onStateChange = (state) => {
    console.log("连接状态:", state);
};

client.config.onMessage = (msg) => {
    console.log("收到消息:", msg);
};

// 设置协议配置
client.setConfig(proto_config);

// 连接服务器
client.connect("ws://localhost:8080/websocket", (success, client) => {
    if (success) {
        console.log("连接成功");
        
        // 发送登录请求
        client.send("LoginReq", { accountId: "user123" }, (msgName, response) => {
            if (response.code === 0) {
                console.log("登录成功", response.data);
                
                // 监听推送消息
                client.onNTF("UserMessage", (msgName, response) => {
                    console.log("收到用户消息", response.data);
                });
            }
        });
    }
});

// 获取服务器时间
const serverTime = client.serverTime;
console.log("服务器时间:", new Date(serverTime));
```

## Proto 转换工具使用

### 工具说明

`proto-tools/_convert` 是一个将 Protobuf 文件（`.proto`）和协议CSV配置自动转换为 TypeScript 协议文件（`proto.ts`）的工具。

### 使用方法

#### Windows

双击运行 `proto-tools/_convert.bat`，或在命令行中执行：

```bash
cd proto-tools
_convert.bat
```

#### Linux/Mac

```bash
cd proto-tools
chmod +x _convert.sh
./_convert.sh
```

#### 直接使用 Node.js

```bash
cd proto-tools
node _convert.js
```

### 工具功能

1. **扫描 proto 文件**：自动扫描 `proto-tools` 目录下所有 `.proto` 文件
2. **转换为 JSON**：使用 `pbjs` 将 proto 文件转换为 JSON 格式
3. **解析 CSV 配置**：读取 `ProtoConfig.csv` 文件，解析协议路由配置
4. **生成 proto.ts**：生成 TypeScript 协议文件
5. **自动部署**：如果 `assets` 目录下存在 `proto.ts` 文件，会自动替换

### ProtoConfig.csv 格式

CSV 文件格式如下：

```csv
cmdMerge,request,response
1,LoginReq,LoginResp
2,GetUserInfoReq,GetUserInfoResp
```

- **cmdMerge**: 命令合并值（业务路由 ID）
- **request**: 请求消息类型名称
- **response**: 响应消息类型名称

### 工作流程

1. 在 `proto-tools` 目录下放置 `.proto` 文件
2. 编辑 `ProtoConfig.csv`，配置协议路由
3. 运行转换工具
4. 工具会自动生成 `proto.ts` 文件
5. 如果 `assets` 目录下存在 `proto.ts`，会自动替换

### 示例

假设有以下文件：

**proto-tools/Game.proto**
```protobuf
syntax = "proto3";
package game.protobuf;

message LoginReq {
    string accountId = 1;
}

message LoginResp {
    int64 userId = 1;
}
```

**proto-tools/ProtoConfig.csv**
```csv
cmdMerge,request,response
1,LoginReq,LoginResp
```

运行转换工具后，会生成 `assets/wsockets/proto.ts` 文件，包含：

```typescript
export const proto_config = {
    protoName: "proto.json",
    package: "game.protobuf",
    proto_define: { /* ... */ },
    proto_configs: new Map([
        [1, [1, "LoginReq", "LoginResp"]]
    ])
}
```

## 开发

1. 修改`.proto`或.csv配置，必须重新运行一遍`_convert.bat`重新生成`proto.ts`
2. `proto.ts`只能用工具生成，请勿手动修改，如遇到bug或有定制需求可联系我们
3. CocosCreator编辑器中，将`protobuf.min.js`和`WSocketClient.js`设成`导入为插件`并选择支持平台，最后勾选☑️
4. 日志过滤请用标识 `WSocket`



## 注意事项

1. **必须先调用 `setConfig`**：在调用 `connect` 之前，必须先调用 `setConfig` 设置协议配置
2. **协议配置**：确保 `proto.ts` 文件中的协议配置与服务器端一致
3. **消息名称**：发送消息时，`msgName` 必须在 `proto_config` 中已配置
4. **自动重连**：默认开启自动重连，可通过 `config.autoReconnect` 关闭
5. **心跳机制**：连接成功后会自动发送心跳包，用于同步服务器时间
6. **SSL/TLS 证书（Android）**：如果使用 wss 连接且 CocosCreator 版本低于 3.5，需要在 `config.cacert` 中指定证书文件路径（如 `"assets/cacert.pem"`）。CocosCreator 3.5+ 版本不再需要此参数

## 许可证

MIT License

## 更新日志

### v1.1
- 优化构建脚本
- 改进类型声明文件生成
- 完善文档注释

