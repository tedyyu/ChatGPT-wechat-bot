import { WechatyBuilder } from "wechaty";
import { FileBox } from 'file-box';
import qrcodeTerminal from "qrcode-terminal";
import config from "./config.js";
import ChatGPT from "./chatgpt.js";
import { fetch } from 'fetch-undici';

let bot: any = {};
const startTime = new Date();

initProject();
async function onMessage(msg) {
  // 避免重复发送
  if (msg.date() < startTime) {
    return;
  }
  const contact = msg.talker();
  const receiver = msg.to();
  const content = msg.text().trim();
  const room = msg.room();
  const alias = (await contact.alias()) || (await contact.name());
  const isText = msg.type() === bot.Message.Type.Text;
  const isImage = msg.type() === bot.Message.Type.Image;
  const isAudio = msg.type() === bot.Message.Type.Audio;
  if (msg.self()) {
    return;
  }

  if (room) {
    const topic = await room.topic();
    console.log(
      `${new Date().toLocaleString()}: Group name: ${topic} talker: ${await contact.name()} content: ${content}`
    );

    const pattern = RegExp(`^@${receiver.name()}\\s+${config.groupKey}[\\s]*`);
    if (await msg.mentionSelf()) {
      if (pattern.test(content)) {
        const groupContent = content.replace(pattern, "");
        if(isText) {
          if(new RegExp(config.imageGenKeyRegex).test(content))
            replyImage(room, groupContent);
          else
            replyMessage(room, groupContent);
        }
        return;
      } else {
        console.log(
          "${new Date().toLocaleString()}: Content is not within the scope of the customizition format"
        );
      }
    }
  } else
    if (isText) {
      console.log(`${new Date().toLocaleString()}: talker: ${alias} (id: ${contact.id}) sent text content: ${content}`);
      if(new RegExp(config.imageGenKeyRegex).test(content)) {
        replyImage(contact, content);
      }
      else if (content.startsWith(config.privateKey) || config.privateKey === "") {
        let privateContent = content;
        if (config.privateKey === "") {
          privateContent = content.substring(config.privateKey.length).trim();
        }
        replyMessage(contact, privateContent);
      }
      else {
        console.log(
          "${new Date().toLocaleString()}: Content is not within the scope of the customizition format"
        );
      }
    }
    else if(isImage) {
      const fileBox = await msg.toFileBox();
      const fileName = `/tmp/${fileBox.name}`;
      await fileBox.toFile(fileName);
      console.log(`${new Date().toLocaleString()}: talker: ${alias} sent image content saved locally at ${fileName}`);
    }
    else if(isAudio) {
      const fileBox = await msg.toFileBox();
      const fileName = `/tmp/${fileBox.name}`;
      await fileBox.toFile(fileName);
      console.log(`${new Date().toLocaleString()}: talker: ${alias} sent audio content saved locally at ${fileName}`);
    }
}

async function replyMessage(contact, content) {
  const { id: contactId } = contact;
  try {
    if (
      content.trim().toLocaleLowerCase() ===
      config.resetKey.toLocaleLowerCase()
    ) {
      await callBackend('reset', content, contact.id);
      await contact.say("对话已被重置");
      return;
    }
    const message = await callBackend('chat', content, contact.id);

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + "\n-----------\n" + message;
      await contact.say(result);
      return;
    } else {
      await contact.say(message);
    }
  } catch (e: any) {
    console.error(e);
    if (e.message.includes("timed out")) {
      await contact.say(
        content +
          "\n-----------\nERROR: Please try again, ChatGPT timed out for waiting response."
      );
    }
  }
}

async function replyImage(contact, content) {
  const { id: contactId } = contact;
  try {

    const imageUrl = await callBackend('image', content, contact.id);
    const message = '让您久等了，图片已生成，正在传输。'

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + "\n-----------\n" + message;
      await contact.say(result);
    } else {
      await contact.say(message);
    }

    if (imageUrl) {
      const fileBox = FileBox.fromUrl(imageUrl)
      await contact.say(fileBox)
    }

  } catch (e: any) {
    console.error(e);
    if (e.message.includes("timed out")) {
      await contact.say(
        content +
          "\n-----------\n连接GPT超时错误, 请稍后重试"
      );
    }
  }
}

// TypeScript function to send a POST request with JSON data
async function callBackend(command, content, contactId) {
  try {
    // Send the POST request
    const response = await fetch(`http://localhost:${config.backendPort}/api/${command}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'content': content,
          'contactId': contactId
        }),
    });

    // Parse the JSON response
    const responseBody = await response.json() as any;

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP Status Code: ${response.status}, error message: ${responseBody.error}`);
    }

    if (responseBody.data) {
      return responseBody.data;
    } else {
      throw new Error(`No data found in the backend response`);
    }

  } catch (error) {
      console.error(`${new Date().toLocaleString()}: Error during backend api: ${error}`);
      throw error;
  }
}

function onScan(qrcode) {
  qrcodeTerminal.generate(qrcode, { small: true }); // 在console端显示二维码
  const qrcodeImageUrl = [
    "https://api.qrserver.com/v1/create-qr-code/?data=",
    encodeURIComponent(qrcode),
  ].join("");

  console.log(qrcodeImageUrl);
}

async function onLogin(user) {
  console.log(`${new Date().toLocaleString()}: ${user} has logged in`);
  const date = new Date();
  console.log(`${new Date().toLocaleString()}: Current time:${date}`);
}

function onLogout(user) {
  console.log(`${new Date().toLocaleString()}: ${user} has logged out`);
}

async function initProject() {
  try {
    bot = WechatyBuilder.build({
      name: "WechatEveryDay",
      puppet: "wechaty-puppet-wechat", // 如果有token，记得更换对应的puppet
      puppetOptions: {
        uos: true,
      },
    });

    bot
      .on("scan", onScan)
      .on("login", onLogin)
      .on("logout", onLogout)
      .on("message", onMessage);

    bot
      .start()
      .then(() => console.log(`${new Date().toLocaleString()}: Start to log in wechat...`))
      .catch((e) => console.error(e));
  } catch (error) {
    console.log("${new Date().toLocaleString()}: init error: ", error);
  }
}
