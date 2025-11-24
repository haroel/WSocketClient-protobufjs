
/** 
 * 注意：该脚本由 proto-tools/convert 工具生成，请勿手动修改！
 * 生成时间: 2025-11-24 12:05:17 
 * 工具版本: v1.1 
 * proto_define 格式：{ "文件名.proto": "proto内容字符串" }
 **/

const proto_define = {
  "Base.proto": "syntax = \"proto3\";\npackage GameFramework.Protobuf;\noption java_package = \"com.game.protobuf\";\noption csharp_namespace = \"GameFramework.Protobuf\";\nmessage ExternalMessage {\nint32 cmdCode = 1;\nint32 protocolSwitch = 2;\nint32 cmdMerge = 3;\nsint32 responseStatus = 4;\nstring validMsg = 5;\nbytes data = 6;\nuint32 seqId = 7;\n}\nmessage PingReq {\nint64 clientTime = 1;\n}\nmessage PingResp {\nint64 clientTime = 1;\nint64 serverTime = 2;\n}",
  "Game.proto": "syntax = \"proto3\";\npackage GameFramework.Protobuf;\noption java_package = \"com.game.protobuf\";\noption csharp_namespace = \"GameFramework.Protobuf\";\nmessage LoginReq {\nstring accountId = 1;\n}\nmessage LoginResp {\nint64 userId = 1;\n}\nmessage LoginErrData {\n}"
};

const configs = [
  // cmdMerge: 命令合并值（业务路由）, request: 请求消息类型, response: 响应消息类型
    [65537, "LoginReq", "LoginResp"],
    [131073, "CreateRoomReq", "CreateRoomResp"],
    [131074, "EnterRoomReq", "EnterRoomResp"],
    [196609, "QueryRoomReq", "QueryRoomResp"],
    [196610, "StartGameReq", "StartGameResp"],
    [196611, "SelectPoisonReq", "SelectPoisonResp"],
    [196612, "SelectPunishReq", "SelectPunishResp"],
    [196613, "StartRoundReq", "StartRoundResp"],
    [196614, "UseItemReq", "UseItemResp"],
    [196615, "SelectWordReq", "SelectWordResp"],
    [196616, "PlayAgainReq", "PlayAgainResp"],
    [196617, "LeaveRoomReq", "LeaveRoomResp"],
    [196707, "", "RoomAddPlayerNtf"],
    [196706, "", "PlayerOnlineUpdateNtf"],
    [196705, "", "PlayerPunishEffectNtf"],
    [196704, "", "PlayerHostingTimesNtf"],
    [196703, "", "RoomStateUpdateNtf"],
    [196702, "", "GameStateUpdateNtf"],
    [196701, "", "PlayerUseItemNtf"],
    [196700, "", "PlayerSelectWordNtf"],
    [196699, "", "PlayerLeaveNtf"],
    [196698, "", "RoomReleaseNtf"],
    [196697, "", "ApplyPlayAgainNtf"],
    [196696, "", "GameSettleNtf"]
];

const proto_configs = new Map();

for (let item of configs) {
  item[1] = String(item[1]).trim();
  item[2] = String(item[2]).trim();
  proto_configs.set(item[0], item);
}
export const proto_config = {
  package: "GameFramework.Protobuf",
  proto_define: proto_define,
  proto_configs: proto_configs
}
