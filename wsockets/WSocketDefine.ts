
/**
 * 全局对象(兼容小游戏渠道、Web、App)
 */
export const __global =
    typeof GameGlobal !== "undefined"
        ? GameGlobal
        : typeof globalThis !== "undefined"
            ? globalThis
            : typeof window !== "undefined"
                ? window
                : typeof global !== "undefined"
                    ? global
                    : Object.create(null);

export const WSMessage = {

    // 请先调用setConfig方法
    CALL_SET_CONFIG_FIRST: 100000,

    // 当前正在连接ws，请勿重复!
    CONNECTING_REPEAT_ERROR: 100001,

    // 连接超时
    CONNECT_TIMEOUT: 100002,
    // 协议超时
    PROTOCOL_TIMEOUT: 100003,

    // 心跳超时
    HEARTBEAT_TIMEOUT: 100004,

    // 心跳响应失败
    HEARTBEAT_FAILED: 100005,

    // proto错误
    PROTO_PARSE_ERROR: 200000,
    // CSV错误，cmdMerge无法找到对应的配置
    CSV_ERROR: 200001,
    CSV_NO_RESPONSE: 200002,

    CMDMERGE_NOT_FOUND: 200003,
    EXTERNAL_MESSAGE_NOT_FOUND: 200004,

    // 编码消息失败
    ENCODE_MESSAGE_FAILED: 200005,
    // 解码消息失败
    DECODE_MESSAGE_FAILED: 200006,
    // Builder.build 返回 null
    BUILDER_BUILD_FAILED: 200007,
}
