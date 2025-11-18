import * as cc from 'cc';
const { ccclass, property } = cc._decorator;

import { proto_config } from './wsockets/proto';
import { DEBUG } from 'cc/env';


@ccclass('Main')
export class Main extends cc.Component {

    @property(cc.Node)
    scrollView: cc.Node = null;

    @property(cc.Node)
    lineLog: cc.Node = null;

    start() {
        /** 测试服 */
        const wsUrl = "ws://192.168.230.150:30000/websocket";
        let wsocketClient = WSocketClient.getInstance();
        // 打印WSocketClient库版本
        this.addLog("WSocketClient Version :" + WSocketClient.VERSION);
        // 打印Protobufjs版本
        this.addLog("Protobufjs Version :" + WSocketClient.protobuf.VERSION);

        wsocketClient.setProtoConfig(proto_config);
        // 设置调试模式 , 根据Cocos设置是否开启调试模式
        wsocketClient.config.debugMode = !DEBUG;
        wsocketClient.config.connectInterval = 2000;
        wsocketClient.config.onStateChange = (info: any) => {
            this.addLog("onStateChange 连接状态 :" + JSON.stringify(info));
        };
        wsocketClient.config.onMessage = (msg: any) => {
            this.addLog("onMessage 收到消息 :" + msg);
        };

        wsocketClient.config.onError = (error: any) => {
            this.addLog("onError 错误 :" + error);
        };
        wsocketClient.config.onHeartbeat = (heartbeat: any) => {
            this.addLog("onHeartbeat 心跳 :" + JSON.stringify(heartbeat.data));
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
        this.addLog("- 开始连接服务器 :" + wsUrl);
        wsocketClient.connect(wsUrl, (success, client) => {
            if (success) {
                this.addLog("连接成功,发送登录请求");
                wsocketClient.send("LoginReq", { accountId: "accountId11111" }, (msgName: string, response: any) => {
                    this.addLog(" - 登录结果 :" + JSON.stringify(response));
                });
            } else {
                this.addLog("ws 连接失败");
            }
        });
    }

    private addLog(log: string) {
        const logItem = cc.instantiate(this.lineLog);
        // 获取当前时间（时分秒）
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        logItem.getComponent(cc.Label).string = `[${hours}:${minutes}:${seconds}] ${log}`;
        let scrollView = this.scrollView.getComponent(cc.ScrollView);
        logItem.active = true;
        logItem.setPosition(-scrollView.getComponent(cc.UITransform).contentSize.width/2 + 10, 0);
        scrollView.content.addChild(logItem);
        scrollView.scrollToBottom(0.2);
    }
}
