import * as cc from 'cc';
const { ccclass, property } = cc._decorator;
import { proto_config } from './wsockets/proto';
import { DEBUG } from 'cc/env';

// 声明全局 WSocketClient（来自插件）

const sendPromise = function(msgName: string, opts: any){
    let wsocketClient = WSocketClient.getInstance();
    return new Promise((resolve,reject)=>{
        wsocketClient.send(msgName, opts, (msgName: string, response: any) => {
            resolve(response);
        });
    })
}

@ccclass('Main')
export class Main extends cc.Component {

    @property(cc.Node)
    scrollView: cc.Node = null;

    @property(cc.Node)
    lineLog: cc.Node = null;

    start() {
        /** 测试服 */
        const wsUrl = "ws://124.221.100.246:8081/websocket";
        let wsocketClient = WSocketClient.getInstance();
        // 打印WSocketClient库版本
        this.addLog("WSocketClient Version :" + WSocketClient.VERSION);
        // 打印Protobufjs版本
        this.addLog("Protobufjs Version :" + WSocketClient.protobuf.VERSION);

        wsocketClient.setProtoConfig(proto_config);
        // 设置调试模式 , 根据Cocos设置是否开启调试模式
        wsocketClient.config.debugMode = DEBUG;
        wsocketClient.config.connectInterval = 2000;
        let self = this;

        wsocketClient.config.onStateChange = (info: any) => {
            self.addLog("onStateChange 连接状态 :" + JSON.stringify(info));
        };
        wsocketClient.config.onHeartbeat = (heartbeat: any) => {
            // self.addLog("onHeartbeat 心跳 :" + JSON.stringify(heartbeat.data));
        };
        wsocketClient.config.onAutoReconnectStart = (autoReconnectStart: any) => {
            self.addLog("onAutoReconnectStart 自动重连开始 :" + autoReconnectStart);
        };
        wsocketClient.config.onProtocolTimeout = (protocolTimeout: any) => {
            self.addLog("onProtocolTimeout 协议超时 :" + protocolTimeout);
        };

        wsocketClient.config.onConnected = function (type) {
            self.addLog("onConnected 连接成功 " + type);
        }
        wsocketClient.config.onDisconnect = (type, autoRetryConnect, reason) => {
            switch (type) {
                case 1:
                    this.addLog("onDisconnect 连接超时（已按config配置做了重连处理）, reason " + reason);
                    break;
                case 2:
                    this.addLog("onDisconnect 断线重连状态重连超时, reason " + reason);
                    break;
                case 3:
                    this.addLog("onDisconnect 心跳超时, reason " + reason);
                    break;
                case 10:
                    this.addLog("onDisconnect 断线重连失败, reason " + reason);
                    break;
                case 11:
                    this.addLog("onDisconnect 手动关闭连接, reason " + reason);
                    break;
                case 12:
                    this.addLog("onDisconnect onerror, reason " + reason);
                    break;
                case 13:
                    this.addLog("onDisconnect onclose, reason " + reason);
                    break;
                default:
                    this.addLog("onDisconnect 断开连接原因说明" + reason);
                    break;
            }
            if (!autoRetryConnect){
                this.addLog("请弹窗让用户来选择是否再次重连 !!", true);
            }
        }
        this.addLog("- 开始连接服务器 :" + wsUrl);
        wsocketClient.connect(wsUrl, (success, client) => {
            if (success) {
                this.addLog("连接成功,发送登录请求");
                this.sendReqs()
            } else {
                this.addLog("ws 连接失败");
            }
        });
    }

    private async sendReqs(){
        {
            let res = await sendPromise("LoginReq", {openId: "123445566"});
            console.log(res);
            this.addLog(" - LoginResp :" + JSON.stringify(res));
        }
        let basicData = {
            nick: "hehao1",
            icon: "1",
            extra: "test",
        }
        let roomId = "73000012";
        {
            let res = await sendPromise("CreateRoomReq", {basicData: basicData});
            this.addLog(" - CreateRoomResp :" + JSON.stringify(res));
            roomId = (res as any).data["roomId"];
        }
        {
            let res = await sendPromise("EnterRoomReq", {roomId:roomId, basicData: basicData});
            console.log(res);
            this.addLog(" - EnterRoomResp :");
        }
        {
            let res = await sendPromise("QueryRoomReq", {roomId:roomId, reconnect: false});
            console.log(res);
            this.addLog(" - QueryRoomResp :" );
        }

    }

    private addLog(log: string, showError:boolean = false) {
        const logItem = cc.instantiate(this.lineLog);
        // 获取当前时间（时分秒）
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        logItem.getComponent(cc.Label).string = `[${hours}:${minutes}:${seconds}] ${log}`;
        let scrollView = this.scrollView.getComponent(cc.ScrollView);
        logItem.active = true;
        logItem.setPosition(-scrollView.getComponent(cc.UITransform).contentSize.width / 2 + 10, 0);
        if (showError){
            logItem.getComponent(cc.Label).color = cc.Color.RED;
        }
        scrollView.content.addChild(logItem);
        scrollView.scrollToBottom(0.2);
    }
}
