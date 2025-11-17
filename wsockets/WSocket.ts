/*
 * @Author: hehao
 * @Email: hehao@wedobest.com.cn
 * @Description:  websocket封装类，只处理WS相关连接和函数转发 
 */

let trace = function (...args) {
    console.log("WSocket", ...args);
}
let traceError = function (...args) {
    console.error("WSocket", ...args);
}

export type WebSocketInterface = {
    binaryType: string,
    url: string,
    onopen: Function,
    onmessage: Function,
    onclose: Function,
    onerror: Function,
    send: Function,
    close: Function
}

let _ws_uuid = 1;

/**
 * 通用ws类定义
 */
export class WSocket {

    public static class = WebSocket;

    public url: string = "";

    public ws: WebSocketInterface = null;

    private _callback: (event: string, data: any) => void = null;

    public opts = {
        retry: 1,
        interval: 1000,
        cacert: ""
    }

    private _reconnectTimer = null;

    constructor(serverURL: string, opts:(typeof this.opts)) {
        this.url = serverURL;
        this.opts = opts;
        this.connect(serverURL);
    }

    destroy() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        this._callback = null;
        this.close();
    }
    /**
     * 
     * @param serverURL 
     */
    public connect(serverURL: string) {
        if (serverURL) {
            this.url = serverURL;
        }
        if (this.ws) {
            let ws = this.ws;
            this.ws = null;
            ws.close();
        }
        trace(`connect ${this.url}`);
        // let AdapterWebSocket = wshandlerHelper.getWebSocketClass();
        let AdapterWebSocket: any = WSocket.class;
        let ws : WebSocketInterface = null;
        if(this.opts.cacert) {
           //android平台，低版本引擎ws需要加入CA证书才能使用wss
            ws = new AdapterWebSocket(this.url, [], this.opts.cacert);
            trace("cacert", this.opts.cacert);
        } else {
            ws = new AdapterWebSocket(this.url);
        }
        ws.binaryType = "arraybuffer";
        ws.onopen = (event) => {
            this.onopen(ws, event)
        }
        ws.onmessage = (event) => {
            this.onmessage(ws, event)
        }
        ws.onclose = (event) => {
            this.onclose(ws, event)
        }
        ws.onerror = (event) => {
            this.onerror(ws, event)
        }
        ws["uuid"] = _ws_uuid++ // 唯一标识该连接
        this.ws = ws;
        // this._wsUUID = ws["uuid"];
    }

    private _reconnect() {
        if (this.opts.retry > 0) {
            trace("reconnect ", this.opts.retry, this.opts.interval);
            this.opts.retry--;
            this._reconnectTimer = setTimeout(() => {
                clearTimeout(this._reconnectTimer);
                this._reconnectTimer = null;
                this.connect(this.url);
            }, this.opts.interval);
        }
    }
    public send(arrayBuffer: ArrayBuffer) {
        if (arrayBuffer.byteLength < 1) {
            traceError('Buffer.size  == 0')
        }
        if (this.ws) {
            this.ws.send(arrayBuffer);
        } else {
            traceError("ws null!")
        }
    }

    /**
     * 主动关闭，该操作不会触发on event
     */
    public close() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        // trace(" 主动关闭 WS close ，该操作不会触发on event ")
        let ws = this.ws;
        this.ws = null;
        ws && ws.close();
    }
    /**
     * 监听ws事件回调
     * @param eventcallback 
     */
    public on(eventcallback: (event: "onmessage" | "onopen" | "onclose" | "onerror", data: any) => void) {
        this._callback = eventcallback;
    }

    private onopen(ws: WebSocketInterface, event) {
        trace(`${this.url} onopen ${ws["uuid"]} `)
        if (this.ws && ws["uuid"] === this.ws["uuid"]) {
            this.opts.retry = 0;
            this._callback("onopen", event)
        }
    }

    private onerror(ws: WebSocketInterface, event) {
        traceError(` ${this.url} onerror`, event)
        if (this.ws && ws["uuid"] === this.ws["uuid"]) {
            if (this.opts.retry > 0) {
                return this._reconnect();
            }
            this._callback("onerror", event)
        }
    }
    private onclose(ws: WebSocketInterface, event) {
        trace(`${this.url} onclose   `, event)
        if (this.ws && ws["uuid"] === this.ws["uuid"]) {
            if (this.opts.retry > 0) {
                return this._reconnect();
            }
            this._callback("onclose", event)
        }
    }
    private onmessage(ws: WebSocketInterface, event) {
        if (this.ws && ws["uuid"] === this.ws["uuid"]) {
            this._callback("onmessage", event.data)
        }
    }
}