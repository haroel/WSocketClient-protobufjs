import { _decorator, Component, Node } from 'cc';

import { proto_config } from './wsockets/proto';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    start() {
        let wsocketClient = WSocketClient.getInstance();
        wsocketClient.setConfig(proto_config);
        wsocketClient.connect("ws://192.168.230.150:30000/websocket", (success, client) => {
            if (success) {
                console.log("连接成功");
                wsocketClient.send("LoginReq", { accountId: "hehao1113" }, (msgName: string, response: any) => {
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


