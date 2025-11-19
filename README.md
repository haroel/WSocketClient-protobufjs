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
client.setProtoConfig(proto_config);

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
     * 调试模式
     * 是否开启调试模式，开启后会输出详细的调试日志
     * @default false
     */
    debugMode: false,
    
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
     * @default 3000
     */
    connectInterval: 3000,
    
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
    
    /******************** 必要回调 ********************/
    
    /**
     * 连接成功回调（必须实现）
     * @param type 连接成功类型
     *         - 1：正常连接成功
     *         - 2：断线重连成功
     */
    onConnected: (type) => {
        console.log("连接成功", type === 1 ? "正常连接" : "断线重连");
    },
    
    /**
     * 连接断开回调（必须实现）
     * @param type 断开连接类型
     *         - 1：连接超时
     *         - 2：断线重连状态重连超时
     *         - 3：心跳超时
     *         - 10：断线重连状态错误或断开
     *         - 11：手动关闭
     *         - 12：onerror
     *         - 13：onclose
     * @param reason 断开连接原因说明
     */
    onDisconnect: (type, reason) => {
        console.log("连接断开", type, reason);
    },
    
    /******************** 可选回调（非必要） ********************/
    
    /**
     * 【非必要】状态变化回调函数
     * @param state 状态变化对象 { from: 旧状态, to: 新状态 }
     */
    onStateChange: (state) => {
        console.log("状态变化", state);
    },
    
    /**
     * 【非必要】自动重连开始回调函数
     * 当开始自动重连时触发，无参数
     */
    onAutoReconnectStart: () => {
        console.log("开始自动重连");
    },
    
    /**
     * 【非必要】协议超时回调函数
     * 不会主动断开连接，每个协议只可能触发一次
     * @param request 超时的请求对象，包含以下属性：
     *   - seqId: 序列号（number）
     *   - time: 发送时间戳（number）
     *   - msgName: 消息名称（string）
     *   - timeout: 是否已超时（boolean）
     *   - callback: 原始回调函数
     */
    onProtocolTimeout: (request) => {
        console.log("协议超时", request);
    },
    
    /**
     * 【非必要】心跳回调函数
     * 每次发送心跳包后触发
     * @param response 心跳响应对象，包含 code（状态码）、data（响应数据）等字段
     */
    onHeartbeat: (response) => {
        console.log("心跳", response);
    }
};
```

### API 参考

> 可通过`WSocketClient.d.ts`查看完整接口说明

#### 静态属性

- `WSocketClient.VERSION` - 版本号，当前版本为 "1.3"
- `WSocketClient.NONE` (0) - 初始状态
- `WSocketClient.DISCONNECTED` (1) - 断连状态
- `WSocketClient.CONNECTING` (2) - 正在连接状态
- `WSocketClient.CONNECTTED` (3) - 连接成功状态
- `WSocketClient.protobuf` - protobufjs 原始对象，用于 protobuf 消息的序列化和反序列化

#### 静态方法

- `WSocketClient.getInstance()` - 获取单例实例

#### 实例属性

- `config` - 配置对象

#### 实例方法

- `setProtoConfig(proto_config)` - 设置协议配置（必须在调用 connect 之前调用）
  - `proto_config.protoName` - 协议名称，通常为 "proto.json"
  - `proto_config.proto_define` - protobuf 定义对象，包含消息和枚举定义
  - `proto_config.proto_configs` - 协议配置映射表，Map 类型，key 为 cmdMerge，value 为 [cmdMerge, request, response] 数组
- `connect(serverURL, callback)` - 连接 WebSocket 服务器
  - `serverURL` - WebSocket 服务器地址，格式如 "ws://localhost:8080" 或 "wss://example.com"
  - `callback(success, client)` - 连接结果回调函数
- `close(code?)` - 关闭 WebSocket 连接
  - `code` - WebSocket 关闭代码，默认为 -1。标准关闭代码：1000=正常关闭，1001=端点离开，1006=异常关闭
- `send(msgName, payload, callback)` - 发送消息到服务器（只有在连接成功时才能发送）
  - `msgName` - 消息名称，必须在 proto_config 中已配置
  - `payload` - 消息负载对象，需要符合对应消息类型的 protobuf 定义
  - `callback(msgName, response)` - 响应回调函数，当收到服务器响应时调用
  - 返回：如果发送成功，返回请求对象（包含 seqId、time、msgName、timeout、callback），否则返回 null
- `onNTF(msgName, callback, priority?)` - 监听服务器推送消息（通知消息）
  - `msgName` - 消息名称，服务器推送的消息类型
  - `callback(msgName, response)` - 回调函数，当收到对应消息时调用
  - `priority` - 优先级，默认 0，数值越大优先级越高，相同优先级的按注册顺序执行
- `offNTF(msgName, callback?)` - 取消监听协议返回消息（包括推送和普通CS模式）
  - `msgName` - 消息名称，要取消监听的消息类型
  - `callback` - 可选，要移除的特定回调函数。如果不传此参数，则删除该消息名称下的所有回调函数
- `reset()` - 重置所有状态和数据（关闭连接、清空所有回调、停止定时器、重置所有内部状态）
- `setState(val)` - 设置连接状态（状态变化时会触发相应的回调函数和内部逻辑）

#### Getter 属性

- `wsocket` - 获取 WebSocket 实例，如果未连接则返回 null
- `url` - 获取当前连接的 WebSocket URL，如果未连接则返回空字符串
- `isConnected` - 获取是否已连接，如果当前状态为 CONNECTTED 则返回 true，否则返回 false
- `isReconnecting` - 获取是否正在重连，如果正在自动重连则返回 true，否则返回 false
- `state` - 获取当前连接状态，返回状态值（NONE=0, DISCONNECTED=1, CONNECTING=2, CONNECTTED=3）
- `ping` - 获取服务器与客户端的时间差（毫秒），通过心跳包计算得出，值为 serverTime - clientTime，正数表示服务器时间比客户端快
- `serverTime` - 获取服务器当前时间（毫秒时间戳），基于客户端时间和时间差计算得出

#### 其他属性

- `protobufUtil` - Protobuf 辅助对象，用于处理 protobuf 消息的编码和解码

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



## 错误码说明

WSocketClient 定义了完整的错误码体系，可通过 `WSMessage` 对象访问：

### 连接相关错误 (100000-199999)

- `WSMessage.CALL_ERROR` (100000) - 请先调用 setProtoConfig 方法
  - 触发场景：在调用 connect() 方法之前未调用 setProtoConfig() 设置协议配置
  - 解决方法：确保在连接前先调用 `client.setProtoConfig(proto_config)`

- `WSMessage.CONNECTING_REPEAT_ERROR` (100001) - 当前正在连接 WebSocket，请勿重复连接
  - 触发场景：在连接状态为 CONNECTING 时，再次调用 connect() 方法
  - 解决方法：等待当前连接完成后再尝试连接

- `WSMessage.CONNECT_TIMEOUT` (100002) - 连接超时
  - 触发场景：从开始连接到连接成功或失败的时间超过了 config.connectTimeout 设置的值
  - 解决方法：检查网络连接，或增加 connectTimeout 的值

- `WSMessage.PROTOCOL_TIMEOUT` (100003) - 协议超时
  - 触发场景：发送请求后，在 config.protocolTimeout 时间内未收到服务器响应
  - 解决方法：检查服务器是否正常响应，或增加 protocolTimeout 的值

- `WSMessage.HEARTBEAT_TIMEOUT` (100004) - 心跳超时
  - 触发场景：发送心跳包后，在 config.heartbeatTimeout 时间内未收到心跳响应
  - 解决方法：检查网络连接，服务器可能会主动断开连接

- `WSMessage.HEARTBEAT_FAILED` (100005) - 心跳响应失败
  - 触发场景：收到心跳响应，但响应状态码不为 0（表示心跳失败）
  - 解决方法：检查服务器心跳处理逻辑

- `WSMessage.CONNECTING_NOW` (100006) - 当前正在连接，请等待连接完成
  - 触发场景：在连接状态为 CONNECTING 时，再次调用 send 方法
  - 解决方法：等待当前连接完成后再尝试发送消息

### 协议处理相关错误 (200000-299999)

- `WSMessage.PROTO_PARSE_ERROR` (200000) - Protobuf 解析错误
  - 触发场景：在 setProtoConfig() 时，protobuf 定义文件解析失败，无法找到对应的 package
  - 解决方法：检查 proto_define 配置是否正确，确保 package 名称匹配

- `WSMessage.CSV_ERROR` (200001) - CSV 配置错误，cmdMerge 无法找到对应的配置
  - 触发场景：收到服务器消息时，根据 cmdMerge 无法在 proto_configs 中找到对应的协议配置
  - 解决方法：检查 ProtoConfig.csv 配置，确保 cmdMerge 值已正确配置

- `WSMessage.CSV_NO_RESPONSE` (200002) - CSV 配置错误，响应消息名称为空
  - 触发场景：收到服务器消息时，协议配置中缺少响应消息名称（response 字段为空）
  - 解决方法：检查 ProtoConfig.csv 配置，确保每个 cmdMerge 都配置了对应的 response 消息名称

- `WSMessage.CMDMERGE_NOT_FOUND` (200003) - 找不到 cmdMerge 配置
  - 触发场景：发送消息时，根据消息名称（msgName）无法在 proto_configs 中找到对应的 cmdMerge
  - 解决方法：检查 ProtoConfig.csv 配置，确保该消息名称已正确配置 cmdMerge

- `WSMessage.MESSAGE_NOT_FOUND` (200004) - 找不到 ExternalMessage 定义
  - 触发场景：编码消息时，在 protobuf 定义中找不到 ExternalMessage 类型
  - 解决方法：检查 .proto 文件，确保定义了 ExternalMessage 消息类型

- `WSMessage.NO_HANDLER` (200005) - 没有处理函数和监听器，这表明该数据可以被客户端忽略
  - 触发场景：收到服务器消息时，没有注册对应的处理函数或监听器
  - 解决方法：检查是否已正确注册消息处理函数或监听器，或者该消息可以被忽略

- `WSMessage.ENCODE_FAILED` (200010) - 编码消息失败
  - 触发场景：将消息对象编码为 Protobuf 二进制数据时失败
  - 解决方法：检查消息对象格式是否正确，是否符合 protobuf 定义

- `WSMessage.DECODE_FAILED` (200011) - 解码消息失败
  - 触发场景：将 Protobuf 二进制数据解码为消息对象时失败
  - 解决方法：检查接收到的数据格式是否正确，protobuf 定义是否匹配

## 注意事项

1. **必须先调用 `setProtoConfig`**：在调用 `connect` 之前，必须先调用 `setProtoConfig` 设置协议配置
2. **协议配置**：确保 `proto.ts` 文件中的协议配置与服务器端一致
3. **消息名称**：发送消息时，`msgName` 必须在 `proto_config` 中已配置
4. **自动重连**：默认开启自动重连，可通过 `config.autoReconnect` 关闭
5. **心跳机制**：连接成功后会自动发送心跳包，用于同步服务器时间
6. **SSL/TLS 证书（Android）**：如果使用 wss 连接且 CocosCreator 版本低于 3.5，需要在 `config.cacert` 中指定证书文件路径（如 `"assets/cacert.pem"`）。CocosCreator 3.5+ 版本不再需要此参数
7. **错误处理**：建议在回调函数中检查 `response.code` 来判断请求是否成功，并参考错误码说明进行问题排查

## 许可证

MIT License

## 更新日志

### v1.3
- 添加 `debugMode` 配置项，支持调试模式输出详细日志
- 更新错误码定义：添加 `NO_HANDLER` (200005)，修正 `ENCODE_FAILED` (200010) 和 `DECODE_FAILED` (200011) 的错误码
- 完善 `send` 方法返回值说明，包含 `timeout` 属性
- 优化类型声明文件，确保与实现代码保持一致

### v1.2
- 更新 API 方法名：`setConfig` 更名为 `setProtoConfig`，更清晰地表达方法用途
- 完善错误码定义和文档说明
- 优化类型声明文件，增加详细的 JSDoc 注释
- 改进 API 文档，补充参数说明和返回值说明

### v1.1
- 优化构建脚本
- 改进类型声明文件生成
- 完善文档注释

