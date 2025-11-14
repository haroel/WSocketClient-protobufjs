import { _decorator, Component, Node } from 'cc';

import { proto_config } from './wsockets/proto';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    start() {
        const wsUrl = "ws://192.168.230.150:30000/websocket";
        console.log("请替换成实际可用服务器地址！！！");
        let wsocketClient = WSocketClient.getInstance();
        wsocketClient.setConfig(proto_config);
        wsocketClient.connect(wsUrl, (success, client) => {
            if (success) {
                console.log("连接成功");
                wsocketClient.send("LoginReq", { accountId: "accountId11111" }, (msgName: string, response: any) => {
                    console.log("登录响应", msgName, response);
                });
            } else {
                console.log("连接失败");
            }
        });
        
    }

    update(deltaTime: number) {
        
    }
}


