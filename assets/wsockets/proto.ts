
/** 
 * 注意：该脚本由 proto-tools/convert 工具生成，请勿手动修改！
 * 生成时间: 2025-11-14 17:13:37 
 * 工具版本: v1.1 **/

const proto_define = {
  package: "game.protobuf",
  messages: [
    {
      name: "ExternalMessage",
      fields: [
        {
          rule: "optional",
          type: "int32",
          name: "cmdCode",
          id: 1
        },
        {
          rule: "optional",
          type: "int32",
          name: "protocolSwitch",
          id: 2
        },
        {
          rule: "optional",
          type: "int32",
          name: "cmdMerge",
          id: 3
        },
        {
          rule: "optional",
          type: "sint32",
          name: "responseStatus",
          id: 4
        },
        {
          rule: "optional",
          type: "string",
          name: "validMsg",
          id: 5
        },
        {
          rule: "optional",
          type: "bytes",
          name: "data",
          id: 6
        },
        {
          rule: "optional",
          type: "uint32",
          name: "seqId",
          id: 7
        }
      ]
    },
    {
      name: "PingReq",
      fields: [
        {
          rule: "optional",
          type: "int64",
          name: "clientTime",
          id: 1
        }
      ]
    },
    {
      name: "PingResp",
      fields: [
        {
          rule: "optional",
          type: "int64",
          name: "clientTime",
          id: 1
        },
        {
          rule: "optional",
          type: "int64",
          name: "serverTime",
          id: 2
        }
      ]
    },
    {
      name: "LoginReq",
      fields: [
        {
          rule: "optional",
          type: "string",
          name: "accountId",
          id: 1
        }
      ]
    },
    {
      name: "LoginResp",
      fields: [
        {
          rule: "optional",
          type: "int64",
          name: "userId",
          id: 1
        }
      ]
    },
    {
      name: "LoginErrData",
      fields: []
    }
  ],
  enums: [],
  options: {
    java_package: "com.game.protobuf",
    csharp_namespace: "GameFramework.Protobuf"
  }
};

const configs = [
  // cmdMerge: 命令合并值（业务路由）, request: 请求消息类型, response: 响应消息类型
    [1, "LoginReq", "LoginResp"]
];

const proto_configs = new Map();

for (let item of configs) {
  item[1] = String(item[1]).trim();
  item[2] = String(item[2]).trim();
  proto_configs.set(item[0], item);
}
export const proto_config = {
  protoName: "proto.json",
  proto_define: proto_define,
  proto_configs: proto_configs
}
