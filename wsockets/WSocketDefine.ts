
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

/**
 * WebSocket 客户端错误码定义
 * 错误码范围说明：
 * - 100000-199999: 连接相关错误
 * - 200000-299999: 协议处理相关错误
 */
export const WSMessage = {
    /******************** 连接相关错误 (100000-199999) ********************/
    /**
     * 请先调用 setConfig 方法
     * 错误码: 100000
     * 触发场景: 在调用 connect() 方法之前未调用 setConfig() 设置协议配置
     * 解决方法: 确保在连接前先调用 client.setConfig(proto_config)
     */
    CALL_ERROR: 100000,

    /**
     * 当前正在连接 WebSocket，请勿重复连接
     * 错误码: 100001
     * 触发场景: 在连接状态为 CONNECTING 时，再次调用 connect() 方法
     * 解决方法: 等待当前连接完成后再尝试连接
     */
    CONNECTING_REPEAT_ERROR: 100001,

    /**
     * 连接超时
     * 错误码: 100002
     * 触发场景: 从开始连接到连接成功或失败的时间超过了 config.connectTimeout 设置的值
     * 解决方法: 检查网络连接，或增加 connectTimeout 的值
     */
    CONNECT_TIMEOUT: 100002,

    /**
     * 协议超时
     * 错误码: 100003
     * 触发场景: 发送请求后，在 config.protocolTimeout 时间内未收到服务器响应
     * 解决方法: 检查服务器是否正常响应，或增加 protocolTimeout 的值
     */
    PROTOCOL_TIMEOUT: 100003,

    /**
     * 心跳超时
     * 错误码: 100004
     * 触发场景: 发送心跳包后，在 config.heartbeatTimeout 时间内未收到心跳响应
     * 解决方法: 检查网络连接，服务器可能会主动断开连接
     */
    HEARTBEAT_TIMEOUT: 100004,

    /**
     * 心跳响应失败
     * 错误码: 100005
     * 触发场景: 收到心跳响应，但响应状态码不为 0（表示心跳失败）
     * 解决方法: 检查服务器心跳处理逻辑
     */
    HEARTBEAT_FAILED: 100005,
    /**
     *  当前正在连接，请等待连接完成
     * 错误码: 100006
     * 触发场景: 在连接状态为 CONNECTING 时，再次调用 send 方法
     * 解决方法: 等待当前连接完成后再尝试发送消息
     */
    CONNECTING_NOW: 100006,

    /******************** 协议处理相关错误 (200000-299999) ********************/

    /**
     * Protobuf 解析错误
     * 错误码: 200000
     * 触发场景: 在 setConfig() 时，protobuf 定义文件解析失败，无法找到对应的 package
     * 解决方法: 检查 proto_define 配置是否正确，确保 package 名称匹配
     */
    PROTO_PARSE_ERROR: 200000,

    /**
     * CSV 配置错误，cmdMerge 无法找到对应的配置
     * 错误码: 200001
     * 触发场景: 收到服务器消息时，根据 cmdMerge 无法在 proto_configs 中找到对应的协议配置
     * 解决方法: 检查 ProtoConfig.csv 配置，确保 cmdMerge 值已正确配置
     */
    CSV_ERROR: 200001,

    /**
     * CSV 配置错误，响应消息名称为空
     * 错误码: 200002
     * 触发场景: 收到服务器消息时，协议配置中缺少响应消息名称（response 字段为空）
     * 解决方法: 检查 ProtoConfig.csv 配置，确保每个 cmdMerge 都配置了对应的 response 消息名称
     */
    CSV_NO_RESPONSE: 200002,

    /**
     * 找不到 cmdMerge 配置
     * 错误码: 200003
     * 触发场景: 发送消息时，根据消息名称（msgName）无法在 proto_configs 中找到对应的 cmdMerge
     * 解决方法: 检查 ProtoConfig.csv 配置，确保该消息名称已正确配置 cmdMerge
     */
    CMDMERGE_NOT_FOUND: 200003,

    /**
     * 找不到 ExternalMessage 定义
     * 错误码: 200004
     * 触发场景: 编码消息时，在 protobuf 定义中找不到 ExternalMessage 类型
     * 解决方法: 检查 .proto 文件，确保定义了 ExternalMessage 消息类型
     */
    MESSAGE_NOT_FOUND: 200004,

    /**
     * 编码消息失败
     * 错误码: 200005
     * 触发场景: 将消息对象编码为 Protobuf 二进制数据时失败
     * 解决方法: 检查消息对象格式是否正确，是否符合 protobuf 定义
     */
    ENCODE_FAILED: 200005,

    /**
     * 解码消息失败
     * 错误码: 200006
     * 触发场景: 将 Protobuf 二进制数据解码为消息对象时失败
     * 解决方法: 检查接收到的数据格式是否正确，protobuf 定义是否匹配
     */
    DECODE_FAILED: 200006
}
