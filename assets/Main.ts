import * as cc from 'cc';

import { proto_config } from './wsockets/proto';
const { ccclass, property } = cc._decorator;

@ccclass('Main')
export class Main extends cc.Component {

    @property(cc.Node)
    scrollView: cc.Node = null;

    @property(cc.Node)
    lineLog: cc.Node = null;

    start() {
        const wsUrl = "ws://192.168.230.150:30000/websocket";
        let wsocketClient = WSocketClient.getInstance();
        this.addLog("WSocketClient version :" + WSocketClient.VERSION);
        this.addLog("Protobufjs version :" + WSocketClient.protobuf.VERSION);

        wsocketClient.setProtoConfig(proto_config);
        wsocketClient.config.connectInterval = 2000;
        wsocketClient.config.onStateChange = (state: number) => {
            this.addLog("onStateChange 连接状态 :" + state);
        };
        wsocketClient.config.onMessage = (msg: any) => {
            this.addLog("onMessage 收到消息 :" + msg);
        };

        wsocketClient.config.onError = (error: any) => {
            this.addLog("onError 错误 :" + error);
        };
        wsocketClient.config.onHeartbeat = (heartbeat: any) => {
            this.addLog("onHeartbeat 心跳 :" + heartbeat);
        };
        wsocketClient.config.onHeartbeatTimeout = (heartbeatTimeout: any) => {
            this.addLog("onHeartbeatTimeout 心跳超时 :" + heartbeatTimeout);
        };
        wsocketClient.config.onOpen = (open: any) => {
            this.addLog("onOpen 连接打开 :" + open);
        };
        wsocketClient.config.onClose = (close: any) => {
            this.addLog("onClose 连接关闭 " + close);
        };
        wsocketClient.config.onAutoReconnectStart = (autoReconnectStart: any) => {
            this.addLog("onAutoReconnectStart 自动重连开始 :" + autoReconnectStart);
        };
        wsocketClient.config.onAutoReconnectEnd = (autoReconnectEnd: any) => {
            this.addLog("onAutoReconnectEnd 自动重连结束 :" + autoReconnectEnd);
        };
        wsocketClient.config.onProtocolTimeout = (protocolTimeout: any) => {
            this.addLog("onProtocolTimeout 协议超时 :" + protocolTimeout);
        };
        wsocketClient.config.onConnectTimeout = (connectTimeout: any) => {
            this.addLog("onConnectTimeout 连接超时 :" + connectTimeout);
        };
        wsocketClient.config.onHeartbeatTimeout = (heartbeatTimeout: any) => {
            this.addLog("onHeartbeatTimeout 心跳响应超时 :" + heartbeatTimeout);
        };
        this.addLog("连接服务器 :" + wsUrl);
        wsocketClient.connect(wsUrl, (success, client) => {
            if (success) {
                this.addLog("连接成功");
                wsocketClient.send("LoginReq", { accountId: "accountId11111" }, (msgName: string, response: any) => {
                    this.addLog("登录响应 :" + msgName + " " + response);
                });
            } else {
                this.addLog("连接失败");
            }
        });
    }

    private addLog(log: string) {
        const logItem = cc.instantiate(this.lineLog);
        logItem.active = true;
        logItem.getComponent(cc.Label).string = log;
        this.scrollView.getComponent(cc.ScrollView).content.addChild(logItem);
    }
}
