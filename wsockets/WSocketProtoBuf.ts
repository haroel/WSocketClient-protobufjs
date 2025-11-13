import { WSMessage } from "./WSocketDefine";

let trace = function (...args) {
    console.log("WSocketProtoBuf", ...args);
}
let traceError = function (...args) {
    console.error("WSocketProtoBuf", ...args);
}

function recursivelyConvertLongs(obj: any, protobufLong: any) {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (obj[i] instanceof protobufLong) {
                obj[i] = obj[i].toNumber();
            } else if (typeof obj[i] === "object" && obj[i] !== null) {
                recursivelyConvertLongs(obj[i], protobufLong);
            }
        }
    } else if (typeof obj === "object") {
        for (const key of Object.keys(obj)) {
            if (obj[key] instanceof protobufLong) {
                obj[key] = obj[key].toNumber();
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
                recursivelyConvertLongs(obj[key], protobufLong);
            }
        }
    }
}

export class WSocketProtoBuf {

    public protobuf: { ByteBuffer: any, Long: any, Util: any, Builder: any, loadJson: any, loadProto: any } = null;

    private protoPackage = "";

    private Builder = null;
    /**
     * 加密模块
     */
    private encryptUtils = null;

    private proto_define: any = null;
    private proto_configs: Map<number, any> = null;

    constructor(protoPackage: string, protobuf: any) {
        this.protoPackage = protoPackage;
        this.protobuf = protobuf;
        this.Builder = new this.protobuf.Builder();
    }

    public setConfig(protoName: string, config: {
        proto_define: any,
        proto_configs: Map<number, any>
    }) {
        this.proto_define = config.proto_define;
        this.proto_configs = config.proto_configs;
        // 加载 JSON
        let result = this.protobuf.loadJson(this.proto_define, this.Builder, protoName);
        // 验证 build 是否能找到 package
        let root = this.Builder.build(); // 获取根对象        
        let packageBuild = this.Builder.build(this.protoPackage);
        if (!packageBuild) {
            trace(` - Error: ${WSMessage.PROTO_PARSE_ERROR} protoName: ${protoName} protoPackage: ${this.protoPackage}`);
        }
    }
    /**
     * 
     * @param msgName 
     * @returns 
     */
    public getProtoConfig(cmdMerge: number) {
        return this.proto_configs.get(cmdMerge);
    }
    public getMessageCMDMerge(requestMsgName: string) {
        for (let [k, v] of this.proto_configs.entries()) {
            if (v[1] === requestMsgName) {
                return k;
            }
        }
        return 0;
    }
    /**
     * 将对象转成Protobuf对应的Message
     * @param msgName  proto.main.MessageName
     * @param obj 
     */
    private encodeObjectToMessage(msgName: string, obj: Object) {
        try {
            const packageObj = this.Builder.build(this.protoPackage);
            if (!packageObj) {
                traceError(` - Error: ${WSMessage.BUILDER_BUILD_FAILED} protoPackage: ${this.protoPackage}`);
                return null;
            }

            let Message = packageObj[msgName];
            if (!Message) {
                traceError(` - Error: ${WSMessage.DECODE_MESSAGE_FAILED} msgName: ${msgName}`);
                return null;
            }
            return new Message(obj);
        } catch (error) {
            traceError(` - Error: ${WSMessage.ENCODE_MESSAGE_FAILED} error: ${error.toString()}`);
        }
        return null;
    }

    /**
    * 将请求协议参数转成ArrayBuffer
    * @param msgName 
    * @param playload 
    * @returns 
    */
    public encodeExternalMessage(msgName: string, seqID: number, playload: object) {
        try {
            // 检查 Builder.build 返回值
            const Tmp = this.Builder.build(this.protoPackage);
            let ExternalMessage = Tmp["ExternalMessage"];
            if (!ExternalMessage) {
                traceError(` - Error: ${WSMessage.EXTERNAL_MESSAGE_NOT_FOUND} protoPackage: ${this.protoPackage}`);
            }

            const cmdCode = (msgName === "PingReq" || msgName === "PingResp") ? 0 : 1;
            const cmdMerge = this.getMessageCMDMerge(msgName);

            // 检查 cmdMerge 是否有效
            if (cmdMerge === 0 && msgName !== "PingReq" && msgName !== "PingResp") {
                traceError(` - Error: ${WSMessage.CMDMERGE_NOT_FOUND} msgName: ${msgName}`);
            }
            // 检查 encodeObjectToMessage 返回值
            const message = this.encodeObjectToMessage(msgName, playload);
            if (!message) {
                traceError(` - Error: ${WSMessage.ENCODE_MESSAGE_FAILED} msgName: ${msgName}`);
            }
            let obj = {
                cmdCode: cmdCode,
                protocolSwitch: 0,
                cmdMerge: cmdMerge,
                responseStatus: 0,
                validMsg: "",
                data: message.encode().toBuffer(),
                seqId: seqID
            };
            let protocolMsg = new ExternalMessage(obj);
            let buffer = protocolMsg.encode().toBuffer();

            // 修复返回值逻辑
            if (this.encryptUtils && (buffer.byteLength > 0 || buffer.length > 0)) {
                return this.encryptUtils.AESEncData(buffer);
            }

            // 如果没有加密工具，返回原始 buffer
            return buffer;

        } catch (error) {
            traceError(` - Error: ${WSMessage.ENCODE_MESSAGE_FAILED} msgName: ${error.toString()}`);
            throw error; // 重新抛出错误，让调用者知道具体失败原因
        }
    }

    public decodeExternalMessage(buffer: ArrayBuffer, aes: boolean = true) {
        try {
            if (aes && buffer.byteLength > 0 && this.encryptUtils) {
                buffer = this.encryptUtils.AESDecData(buffer);
            }
            return this.decodeData("ExternalMessage", buffer);
        } catch (error) {
            traceError(` - Error: ${WSMessage.DECODE_MESSAGE_FAILED} error: ${error.toString()}`, error);
            return null;
        }
    }

    public decodeData(respMsgName: string, buffer: ArrayBuffer) {
        try {
            const packageObj = this.Builder.build(this.protoPackage);
            if (!packageObj) {
                traceError(` - Error: ${WSMessage.BUILDER_BUILD_FAILED} protoPackage: ${this.protoPackage}`);
            }

            let dataMessage = packageObj[respMsgName];
            if (!dataMessage) {
                traceError(` - Error: ${WSMessage.DECODE_MESSAGE_FAILED} msgName: ${respMsgName}`);
            }
            let dataResponse = dataMessage.decode(buffer);
            // 递归循环遍历dataResponse的值， 判断值是否是long，然后调用toNumber();
            recursivelyConvertLongs(dataResponse, this.protobuf.Long);
            return dataResponse;
        } catch (error) {
            traceError(` - Error: ${WSMessage.DECODE_MESSAGE_FAILED} error: ${error.toString()}`, error);
            return null;
        }
    }
}