export default {
  // 填入你的OPENAI_API_KEY
  OPENAI_API_KEY: "",
  // 反向代理地址，简单说就是你的在国外服务器地址，如何获取看README
  // 可换成你自己的，白嫖代理地址 https://ai.devtool.tech/proxy/v1/chat/completions
  reverseProxyUrl: "https://api.openai.com",
  // 在群组中设置唤醒微信机器人的关键词
  groupKey: "",
  // 在私聊中设置唤醒微信机器人的关键词
  privateKey: "",
  // 设置唤醒微信机器人画图的关键词
  imageGenKeyRegex: "(作图)|(绘图)|(画图)[:：]",
  // 重置上下文的关键词，如可设置为reset
  resetKey: "reset",
  // 是否在群聊中带上提问的问题
  groupReplyMode: true,
  // 是否在私聊中带上提问的问题
  privateReplyMode: false,
  //设置用于chat的model, e.g., gpt-3.5-turbo
  chatModel: 'gpt-4-1106-preview',
};
