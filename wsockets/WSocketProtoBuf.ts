import { WSMessage } from "./WSocketDefine";

let trace = function (...args) {
    console.log("WSocketProtoBuf", ...args);
}
let traceError = function (...args) {
    console.error("WSocketProtoBuf", ...args);
}


const isMap = function(protobuf, val){
    return val instanceof protobuf.Map;
}

const isLong = function(protobuf, val){
    return protobuf.Long.isLong(val);
}

/**
 * 是否应该递归
 * @param obj 
 * @returns 
 */
function shouldRecurse(obj: any){



    return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

function longToNumber(obj: any, protobuf: any, visited: Set<any> = new Set()) {
    if (obj === null || obj === undefined) return;
    
    // 防止循环引用导致死循环
    if (visited.has(obj)) return;
    
    // 跳过不应该递归的对象
    if (!shouldRecurse(obj)) return;
    
    visited.add(obj);
    
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (isLong( protobuf,obj[i])) {
                obj[i] = obj[i].toNumber();
            } else if (shouldRecurse(obj[i])) {
                if (isMap(protobuf, obj[i])) {
                    obj[i].forEach((value: any, key: any) => {
                        if (isLong(protobuf, value)) {
                            value = value.toNumber();
                        } else if (shouldRecurse(value)) {
                            longToNumber(value, protobuf, visited);
                        }
                    });
                } else {
                    longToNumber(obj[i], protobuf, visited);
                }
            }
        }
    } else if (obj instanceof protobuf.Map){
        return obj;
    }
    else if (typeof obj === "object") {
        for (const key of Object.keys(obj)) {
            if (protobuf.Long.isLong(obj[key])) {
                obj[key] = obj[key].toNumber();
            } else if (shouldRecurse(obj[key])) {
                longToNumber(obj[key], protobuf, visited);
            }
        }
    }
}

function isPing(msgName: string) {
    return msgName === "PingReq" || msgName === "PingResp";
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

    constructor(protobuf: any) {
        this.protobuf = protobuf;
        this.Builder = new this.protobuf.Builder();
    }

    public setConfig(protoName: string, config: {
        package?: string,
        proto_define: any,
        proto_configs: Map<number, any>
    }) {
        this.protoPackage = config.package || "";
        this.protoPackage = "GameFramework.Protobuf"
        this.proto_define = config.proto_define;
        this.proto_configs = config.proto_configs;
        
        // 新格式：proto_define 是 { "文件名.proto": "proto内容字符串" }
        if (typeof this.proto_define === 'object' && !this.proto_define.package) {
            // 遍历所有 proto 文件字符串，使用 loadProto 加载
            for (const [filename, protoString] of Object.entries(this.proto_define)) {
                if (typeof protoString === 'string') {
                    trace(`Loading proto: ${filename}`);
                    this.protobuf.loadProto(protoString as string, this.Builder, filename);
                }
            }
        } else {
            // 旧格式（兼容）：proto_define 是 loadJson 格式的对象
            this.protoPackage = this.proto_define.package;
            this.protobuf.loadJson(this.proto_define, this.Builder, protoName);
        }
        
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
    public getCMDMerge(requestMsgName: string) {
        for (let [k, v] of this.proto_configs.entries()) {
            if (v[1] === requestMsgName) {
                return k;
            }
        }
        return 0;
    }
    public getMessage(msgName: string) {
        const packageObj = this.Builder.build(this.protoPackage);
        if (packageObj) {
            let Message = packageObj[msgName];
            if (Message) {
                return Message;
            } else {
                traceError(` - Proto Error: ${msgName} 404`);
            }
        } else {
            traceError(` - Proto Error: ${this.protoPackage} 404`);
        }
        return null;
    }
    /**
     * 将对象转成Protobuf对应的Message
     * @param msgName  proto.main.MessageName
     * @param obj 
     */
    private encodeObjectToMessage(msgName: string, obj: Object) {
        const Message = this.getMessage(msgName);
        if (Message) {
            return new Message(obj);
        }
        return null;
    }

    /**
    * 将请求协议参数转成ArrayBuffer
    * @param msgName 
    * @param playload 
    * @returns 
    */
    public encodeRequest(msgName: string, seqID: number, playload: object) {
        try {
            // 检查 Builder.build 返回值
            const ExternalMessage = this.getMessage("ExternalMessage");
            if (!ExternalMessage) {
                return null;
            }
            const cmdCode = isPing(msgName) ? 0 : 1;
            const cmdMerge = this.getCMDMerge(msgName);

            // 检查 cmdMerge 是否有效
            if (cmdMerge === 0 && !isPing(msgName)) {
                traceError(` - Error: ${WSMessage.CMDMERGE_NOT_FOUND} msgName: ${msgName}`);
            }
            // 检查 encodeObjectToMessage 返回值
            const message = this.encodeObjectToMessage(msgName, playload);
            if (!message) {
                traceError(` - Error: ${WSMessage.ENCODE_FAILED} msgName: ${msgName}`);
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
            traceError(` - Error: ${WSMessage.ENCODE_FAILED} msgName: ${error.toString()}`);
            throw error; // 重新抛出错误，让调用者知道具体失败原因
        }
    }

    public decodeResponse(buffer: ArrayBuffer, aes: boolean = true) {
        try {
            if (aes && buffer.byteLength > 0 && this.encryptUtils) {
                buffer = this.encryptUtils.AESDecData(buffer);
            }
            return this.decodeData("ExternalMessage", buffer);
        } catch (error) {
            traceError(` - Error: ${WSMessage.DECODE_FAILED} error: ${error.toString()}`, error);
            return null;
        }
    }

    public decodeData(respMsgName: string, buffer: ArrayBuffer) {
        const Message = this.getMessage(respMsgName);
        if (Message) {
            let dataResponse = Message.decode(buffer);
            // 递归循环遍历dataResponse的值， 判断值是否是long，然后调用toNumber();
            longToNumber(dataResponse, this.protobuf);
            return dataResponse;
        }
        return null;
    }
    public isLong(val){
        return this.protobuf.Long.isLong(val);
    }
}