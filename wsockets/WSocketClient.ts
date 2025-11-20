import { WSocket } from "./WSocket";
import { WSocketProtoBuf } from "./WSocketProtoBuf";
import { __global, WSMessage } from "./WSocketDefine";

let trace = function (...args) {
    console.log("WSocketClient", ...args);
}

/**
 * 生成回调函数
 * @param tag 回调函数的标签，用于日志输出时标识回调来源
 * @returns 返回一个回调函数，该函数会将标签和所有参数输出到控制台
 */
function generateCallback(tag) {
    return function (...args: any[]) {
        console.log(tag, ...arguments);
    }
}

const __ping_msg = ['', 'PingReq', 'PingResp'];
/**
 * WebSocket 客户端类（单例模式）
 * 提供 WebSocket 连接管理、消息收发、心跳检测、自动重连等功能
 * 使用 protobuf 进行消息序列化和反序列化
 */
export class WSocketClient {

    /** WSocketClient 版本 */
    public static readonly VERSION = '1.4.6';

    /******************** 状态定义 ********************/
    /**
     * 初始状态
     */
    public static readonly NONE = 0;
    /**
     * 断连状态
     */
    public static readonly DISCONNECTED = 1;
    /**
     * 正在连接状态
     */
    public static readonly CONNECTING = 2;
    /**
     * 连接成功状态
     */
    public static readonly CONNECTTED = 3;

    /**
     * protobufjs 原始对象
     * 用于 protobuf 消息的序列化和反序列化
     */
    public static protobuf: any = __global.protobuf;

    /**
     * 客户端配置对象
     */
    public config = {
        /**
         * 调试模式
         * 是否开启调试模式，开启后会输出调试日志
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
         * @default 5000
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
         * @default 500
         */
        tickInterval: 500,
        /**
         * 自动断线重连，默认开启
         * 当连接意外断开时，是否自动尝试重新连接
         * @default true
         */
        autoReconnect: true,

        /**
         * 【Android】wss连接pem证书，CocosCreator3.5+以上不再需要此参数
         * 参考 https://forum.cocos.org/t/topic/151320/4
         */
        cacert: "",

        /**
         * 连接成功回调
         * @param type 连接成功类型
         *         - 1：正常连接成功
         *         - 2：断线重连成功
         */
        onConnected: function (type: number) { },
        /**
         * 连接断开回调
         * @param type 断开连接类型
         *         - 1：连接超时
         *         - 2：断线重连状态重连超时
         *         - 3：心跳超时
         *         - 10：断线重连状态错误或断开
         *         - 11：手动关闭
         *         - 12：onerror
         *         - 13：onclose
         * @param autoRetryConnect 是否会自动重试连接，true表示内部将自动去重连，false表示不会重连需要客户端弹窗提示
         * @param reason           断开连接原因说明
         */
        onDisconnect: function (type: number, autoRetryConnect: boolean, reason: any) { },

        /**
         * 【非必要】自动重连开始回调函数
         * 当开始自动重连时触发
         * 无参数
         */
        onAutoReconnectStart: generateCallback("onAutoReconnectStart"),
        /**
         * 【非必要】协议超时回调函数（不会主动断开连接）,每个协议只可能触发一次心跳超时回调
         * @param request 超时的请求对象，包含以下属性：
         *   - seqId: 序列号（number）
         *   - time: 发送时间戳（number）
         *   - msgName: 消息名称（string）
         *   - timeout: 是否已超时（boolean）
         *   - callback: 原始回调函数
         */
        onProtocolTimeout: generateCallback("onProtocolTimeout"),
        /**
         * 【非必要】心跳回调函数
         * 每次发送心跳包后触发
         * @param response 心跳响应对象，包含 code（状态码）、data（响应数据）等字段
         */
        onHeartbeat: generateCallback("onHeartbeat"),
        /**
         * 【非必要】状态变化回调函数
         * @param state 新的连接状态（NONE、DISCONNECTED、CONNECTING、CONNECTTED）
         */
        onStateChange: generateCallback("onStateChange"),
    }

    private static _instance: WSocketClient = null;
    /**
     * 获取 WSocketClient 单例实例
     * @returns WSocketClient 的单例实例
     */
    public static getInstance() {
        if (!WSocketClient._instance) {
            trace("v", WSocketClient.VERSION);
            WSocketClient.protobuf = __global.protobuf;
            WSocketClient._instance = new WSocketClient();
        }
        return WSocketClient._instance;
    }

    /**
     * Protobuf 辅助对象
     * 用于处理 protobuf 消息的编码和解码
     */
    public protobufUtil: WSocketProtoBuf = null;
    /**
     * 获取 WebSocket 实例
     * @returns 当前使用的 WebSocket 实例，如果未连接则返回 null
     */
    public get wsocket() {
        return this._wsocket;
    }
    /**
     * 获取当前连接的 WebSocket 地址
     * @returns 当前连接的 WebSocket URL，如果未连接则返回空字符串
     */
    public get url() {
        return this._wsocket ? this._wsocket.url : "";
    }
    /**
     * 获取是否已连接
     * @returns 如果当前状态为 CONNECTTED 则返回 true，否则返回 false
     */
    public get isConnected() {
        return this._state === WSocketClient.CONNECTTED;
    }
    /**
     * 获取是否正在重连
     * @returns 如果正在自动重连则返回 true，否则返回 false
     */
    public get isReconnecting() {
        return this._isInReconnect;
    }

    private _wsocket: WSocket = null;
    private _listeners: Map<number, any> = new Map();
    private _on_listeners: Map<string, Array<any>> = new Map();

    private _connectCallback: (success: boolean, client: WSocketClient) => void = null;
    private _invokeConnect(result: boolean) {
        let callback = this._connectCallback;
        this._connectCallback = null;
        callback && callback(result, this);
    }

    private _ticker = null;

    private _state = WSocketClient.NONE;
    /**
     * 获取当前连接状态
     * @returns 当前连接状态值（NONE=0, DISCONNECTED=1, CONNECTING=2, CONNECTTED=3）
     */
    public get state() {
        return this._state;
    }


    private _ping = 0;
    /**
     * 获取服务器与客户端的时间差（毫秒）
     * 通过心跳包计算得出，值为 serverTime - clientTime
     * @returns 时间差（毫秒），正数表示服务器时间比客户端快
     */
    public get ping() {
        return this._ping;
    };
    /**
     * 获取服务器当前时间（毫秒时间戳）
     * 基于客户端时间和时间差计算得出
     * @returns 服务器当前时间的毫秒时间戳
     */
    public get serverTime() {
        return Date.now() + this._ping;
    };
    private _lastHeartbeatTime: number = 0;
    private _lastHeartbeatResponseTime: number = 0;
    private _connectTime = 0;

    private _seqid = 1;

    private _isProtoLoaded = false;

    private _isInReconnect = false;

    /**
     * 重置所有状态和数据
     * 关闭连接、清空所有回调、停止定时器、重置所有内部状态
     * 调用后需要重新调用 setConfig 和 connect 才能使用
     */
    public reset() {
        this._connectCallback = null;
        this._listeners.clear();
        this._on_listeners.clear();
        this.close();
        this._stopTicker();
        this.protobufUtil = null;
        this._wsocket = null;
        this._state = WSocketClient.NONE;
        this._lastHeartbeatTime = 0;
        this._connectTime = 0;
        this._isInReconnect = false;
        this._isProtoLoaded = false;
    }

    /**
     * 设置协议配置（proto.ts中配置的proto_config）
     * 必须在调用 connect 之前调用此方法
     * @param proto_config 协议配置对象
     * @param proto_config.protoName 协议名称，通常为 "proto.json"
     * @param proto_config.proto_define protobuf 定义对象，包含消息和枚举定义
     * @param proto_config.proto_configs 协议配置映射表，Map 类型，key 为 cmdMerge，value 为 [cmdMerge, request, response] 数组
     */
    public setProtoConfig(proto_config: {
        protoName: string,
        proto_define: any,
        proto_configs: any
    }) {
        this.protobufUtil = new WSocketProtoBuf(WSocketClient.protobuf);
        this.protobufUtil.setConfig(proto_config.protoName, proto_config);
        this._isProtoLoaded = true;
    }
    /**
     * 设置连接状态
     * 状态变化时会触发相应的回调函数和内部逻辑
     * @param val 新的状态值（NONE、DISCONNECTED、CONNECTING、CONNECTTED）
     */
    public setState(val: number) {
        if (this._state === val) {
            return;
        };
        let info = {
            from: this._state,
            to: val
        }
        this._state = val;
        switch (val) {
            case WSocketClient.DISCONNECTED: {
                this._listeners.clear();
                this._stopTicker();
                this._invokeConnect(false);
                break;
            }
            case WSocketClient.CONNECTING: {
                this._connectTime = Date.now();
                this._startTicker();
                break;
            }
            case WSocketClient.CONNECTTED: {
                this._seqid = 1;
                this.config.onConnected(this.isReconnecting ? 2 : 1);
                this._invokeConnect(true);
                this._lastHeartbeatResponseTime = Date.now();
                // 连接后立即发送心跳包获取服务器时间
                this._sendHeartbeat();
                break;
            }
        }
        this.config.debugMode && trace(`State: ${JSON.stringify(info)}`);
        this.config.onStateChange(info);
    }
    /**
     * 连接 WebSocket 服务器
     * 请确保在调用此方法之前已经调用了 setConfig
     * @param serverURL WebSocket 服务器地址，格式如 "ws://localhost:8080" 或 "wss://example.com"
     * @param callback 连接结果回调函数
     * @param callback.success 连接是否成功
     * @param callback.client WSocketClient 实例
     */
    public connect(serverURL: string, callback: (success: boolean, client: WSocketClient) => void) {
        if (!this._isProtoLoaded) {
            trace(`Error: ${WSMessage.CALL_ERROR}`);
            return callback && callback(false, this);
        }
        let url_ = this.url;
        if (url_ && url_ !== serverURL) {
            trace(`Error: ${url_} != ${serverURL}`);
            this._invokeConnect(false);
            this.close();
        } else {
            if (this._state == WSocketClient.CONNECTTED) {
                return callback && callback(true, this);
            } else if (this._state == WSocketClient.CONNECTING) {
                trace(`Error: ${WSMessage.CONNECTING_REPEAT_ERROR}`);
                return callback && callback(false, this);
            }
        }
        this._connectCallback = callback;
        this.setState(WSocketClient.CONNECTING);
        if (!this._wsocket) {
            this._wsocket = new WSocket(serverURL, {
                retry: this.config.connectRetry,
                interval: this.config.connectInterval,
                cacert: this.config.cacert
            });
            this._wsocket.on(this._wsHandler.bind(this))
        } else {
            this._wsocket.opts.interval = this.config.connectInterval;
            this._wsocket.opts.retry = this.config.connectRetry;
            this._wsocket.opts.cacert = this.config.cacert;
            this._wsocket.connect(serverURL);
        }
    }

    private _disconnect() {
        if (this._wsocket) {
            this._wsocket.close();
        }
        this._listeners.clear();
        this._stopTicker();
        this.setState(WSocketClient.DISCONNECTED);
    }
    /**
     * 关闭 WebSocket 连接
     * @param code WebSocket 关闭代码，默认为 -1。标准关闭代码：1000=正常关闭，1001=端点离开，1006=异常关闭
     */
    public close() {
        if (this.state !== WSocketClient.DISCONNECTED) {
            this._disconnect();
            this.config.onDisconnect(11, false, "close");
        }
    }
    /**
     * 发送消息到服务器
     * 只有在连接成功（CONNECTTED 状态）时才能发送消息
     * @param msgName 消息名称，必须在 proto_config 中已配置
     * @param playload 消息负载对象，需要符合对应消息类型的 protobuf 定义
     * @param callback 响应回调函数，当收到服务器响应时调用
     * @param callback.msgName 请求的消息名称
     * @param callback.response 响应对象，包含 code（响应状态码）、data（响应数据）、msgName（响应消息名称）
     * @returns 如果发送成功，返回请求对象（包含 seqId、time、msgName、callback），否则返回 null
     */
    public send(msgName: string, playload: object, callback: (msgName: string, response: any) => void) {
        switch (this._state) {
            case WSocketClient.CONNECTTED: {
                const seqID = this._seqid++;
                // 发送消息
                let requestBuffer = this.protobufUtil.encodeRequest(msgName, seqID, playload);
                if (requestBuffer) {
                    this.config.debugMode && trace("send : ", msgName, seqID);
                    this._wsocket.send(requestBuffer);
                    let request = {
                        seqId: seqID,
                        time: Date.now(),
                        msgName: msgName,
                        /**
                         * 是否已发送心跳超时
                         */
                        timeout: false,
                        callback: callback
                    };
                    this._listeners.set(seqID, request);
                    return request;
                }
            }
            case WSocketClient.CONNECTING: {
                // 当前正在连接
                trace(`Error: ${WSMessage.CONNECTING_NOW}`);
                break;
            }
            default: {
            }
        }
        callback(null, null);
        return null;
    }

    /**
     * 监听服务器推送消息（通知消息）
     * - 可以为同一个消息名称注册多个回调函数，按优先级排序执行
     * - 除了NTF推送，该接口可以监听服务器的任意消息数据，包括CS模式请求返回
     * @param msgName 消息名称，服务器推送的消息类型
     * @param callback 回调函数，当收到对应消息时调用
     * @param callback.msgName 消息名称
     * @param callback.response 响应对象，包含 code（响应状态码）、data（响应数据）、msgName（消息名称）
     * @param priority 优先级，默认 0，数值越大优先级越高，相同优先级的按注册顺序执行
     */
    public onNTF(msgName: string, callback: (msgName: string, response: any) => void, priority = 0) {
        let arr = this._on_listeners.get(msgName);
        if (!arr) {
            this._on_listeners.set(msgName, [{
                priority: priority,
                callback: callback
            }]);
        } else {
            arr.push({
                priority: priority,
                callback: callback
            });
            arr.sort((a, b) => {
                return b.priority - a.priority;
            });
        }
    }
    /**
     * 取消监听协议返回消息（包括推送和普通CS模式）
     * @param msgName 消息名称，要取消监听的消息类型
     * @param callback 可选，要移除的特定回调函数。如果不传此参数，则删除该消息名称下的所有回调函数
     */
    public offNTF(msgName: string, callback?: (msgName: string, playload: any) => void) {
        let arr = this._on_listeners.get(msgName);
        if (arr) {
            if (callback && typeof callback === "function") {
                for (let i = 0; i < arr.length; i++) {
                    if (arr[i].callback === callback) {
                        arr.splice(i, 1);
                        if (arr.length === 0) {
                            this._on_listeners.delete(msgName);
                        }
                    }
                }
            } else {
                arr.length = 0;
                this._on_listeners.delete(msgName);
            }
        }
    }

    /**
     * 处理接收到的数据
     * @param data 接收到的数据
     */
    private _data(data: any) {
        let external_ = this.protobufUtil.decodeResponse(data);
        if (external_) {
            let item = null;
            if (external_.cmdCode === 0) {
                // 心跳响应
                item = __ping_msg;
            } else {
                const cmdMerge = external_.cmdMerge;
                item = this.protobufUtil.getProtoConfig(cmdMerge);
                if (!item) {
                    trace(` -Error: ${WSMessage.CSV_ERROR}, cmdMerge: ${cmdMerge}`);
                }
            }
            const requestMsgName = item[1];
            const responseMsgName = item[2];
            const seqId = external_.seqId;
            this.config.debugMode && trace("receive : ", responseMsgName, seqId);
            if (!responseMsgName) {
                trace(` - Error: ${WSMessage.CSV_NO_RESPONSE} ${responseMsgName} - ${seqId}`);
            }
            let hasCallback = this._listeners.has(seqId) || this._on_listeners.has(responseMsgName);
            if (!hasCallback) {
                if (this.config.debugMode) {
                    // 【提升性能考虑】没有处理函数和监听器，这表明该数据可以被客户端忽略
                    trace(`${WSMessage.NO_HANDLER} ${responseMsgName} - ${seqId}`);
                }
                return;
            }
            const response = {
                code: external_.responseStatus,
                data: this.protobufUtil.decodeData(responseMsgName, external_.data),
                msgName: responseMsgName
            }
            let request = this._listeners.get(seqId);
            if (request) {
                this._listeners.delete(seqId);
                request.callback(requestMsgName, response);
                request.callback = null;
            }
            let arr = this._on_listeners.get(responseMsgName);
            if (arr) {
                let arr_ = arr.slice();
                for (let item of arr_) {
                    item.callback(responseMsgName, response);
                }
            }
        }
    }
    private _needReconnect(state: number, isReconnecting: boolean) {
        return state === WSocketClient.CONNECTTED && this.config.autoReconnect && !isReconnecting;
    }
    private _reconnect() {
        // autoReconnect模式，满足条件则自动重连
        // 从连接变成close状态，则开启断线重连
        this._isInReconnect = true;
        trace("onAutoReconnectStart")
        this.config.onAutoReconnectStart();
        // 重新连接
        this.connect(this.url, (success: boolean, client: WSocketClient) => {
            trace("autoReconnect " + success);
            this._isInReconnect = false;
        });
    }
    private _wsHandler(event: string, data: any) {
        let last = this._state;
        let isReconnecting = this.isReconnecting;
        switch (event) {
            case "onmessage": {
                this._data(data);
                break;
            }
            case "onclose":
            case "onerror": {
                let needReconnect = this._needReconnect(last, isReconnecting);
                this._disconnect();
                let val = (event === "onclose") ? 13 : 12;
                this.config.onDisconnect(isReconnecting ? 10 : val, needReconnect, data);
                needReconnect && this._reconnect();
                break;
            }
            case "onopen": {
                this.setState(WSocketClient.CONNECTTED);
                break;
            }
            default:
                break;
        }
    }
    private _startTicker() {
        if (this._ticker) {
            return;
        }
        this._ticker = setInterval(this._tick.bind(this), this.config.tickInterval);
    }
    /**
     * WS状态检测
     */
    private _tick() {
        const nt = Date.now();
        const protocolTimeout = this.config.protocolTimeout;
        if (protocolTimeout > 0 && this._listeners.size > 0) {
            for (let item of this._listeners.values()) {
                if (!item.timeout && (nt - item.time) > protocolTimeout) {
                    item.timeout = true;
                    trace(` - Error: ${WSMessage.PROTOCOL_TIMEOUT} : ${item.msgName} seqId: ${item.seqId}`);
                    this.config.onProtocolTimeout && this.config.onProtocolTimeout(item);
                }
            }
        }
        let state = this._state;
        let isReconnecting = this.isReconnecting;
        switch (state) {
            case WSocketClient.CONNECTING: {
                if ((nt - this._connectTime) > this.config.connectTimeout) {
                    // 连接超时
                    trace(` - Error: ${WSMessage.CONNECT_TIMEOUT}`);
                    this._disconnect();
                    this.config.onDisconnect(isReconnecting ? 2 : 1, false, "reconnectTimeout");
                }
                break;
            }
            case WSocketClient.CONNECTTED: {
                if ((nt - this._lastHeartbeatResponseTime) > this.config.heartbeatTimeout) {
                    // 心跳响应超时
                    trace(` - Error: ${WSMessage.HEARTBEAT_TIMEOUT}`);
                    let needReconnect = this._needReconnect(state, isReconnecting);
                    this._disconnect();
                    this.config.onDisconnect(3, needReconnect, "heartbeatTimeout");
                    needReconnect && this._reconnect();
                } else if ((nt - this._lastHeartbeatTime) > this.config.heartbeatInterval) {
                    // 心跳间隔，发送一个心跳
                    this._sendHeartbeat();
                }
                break;
            }
        }
    }
    /**
     * 停止ticker检测
     */
    private _stopTicker() {
        if (this._ticker) {
            clearInterval(this._ticker);
            this._ticker = null;
        }
    }
    /**
     * 发送心跳包
     */
    private _sendHeartbeat() {
        this._lastHeartbeatTime = Date.now();
        this.send(__ping_msg[1], { clientTime: Date.now() }, (msgName: string, response: any) => {
            if (response.code === 0) {
                this._lastHeartbeatResponseTime = Date.now();
                if (response.serverTime) {
                    // trace(" serverTime : ", response.serverTime);
                    this._ping = response.serverTime - Date.now();
                } else {
                    this.config.debugMode && trace(` Heartbeat ${JSON.stringify(response)}`);
                }
            } else {
                trace(` - Error: ${WSMessage.HEARTBEAT_FAILED} heartbeatFailed: ${response}`);
            }
            this.config.onHeartbeat && this.config.onHeartbeat(response);
        });
    }
}
__global.WSocketClient = WSocketClient;
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = WSocketClient;
}