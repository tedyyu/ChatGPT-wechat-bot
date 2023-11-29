import { WechatyBuilder } from "wechaty";
import { FileBox } from 'file-box';
import qrcodeTerminal from "qrcode-terminal";
import config from "./config.js";
import ChatGPT from "./chatgpt.js";
import { fetch } from 'fetch-undici';

let bot: any = {};
const startTime = new Date();
let filesPerUsers : any = {}; //a map to keep user id and their recent files

initProject();
async function onMessage(msg) {
  // 避免重复发送
  if (msg.date() < startTime) {
    return;
  }
  const contact = msg.talker();
  const receiver = msg.to();
  let content = msg.text().trim();
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

    const pattern = RegExp(`^@${receiver.name()}\\s+${config.groupKey}[\\s]*`);
    if (await msg.mentionSelf()) {
      if (pattern.test(content)) {
        const groupContent = content.replace(pattern, "");
        if(isText) {
          if(new RegExp(config.imageGenKeyRegex).test(content)) {
            replyImage(room, groupContent);
            console.log(
              `${new Date().toLocaleString()}: Group name: ${topic} talker: ${await contact.name()} (id: ${await contact.id}) sent text content: ${content}`
            );
          }
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
    if (isText || isAudio) {

      if(isAudio) {
        if(new RegExp(config.trialFeatureUserAllowedListRegex).test(alias)) {
          const fileBox = await msg.toFileBox();
          const fileName = `/tmp/${fileBox.name}`;
          await fileBox.toFile(fileName);
          console.log(`${new Date().toLocaleString()}: talker: ${alias} sent audio content saved locally at ${fileName}`);
          content = await replyToAudio(contact, fileName);
          console.log(`${new Date().toLocaleString()}: talker: ${alias} 's audio transcriptions: ${content}`);
        }
        else
          return;
      }

      console.log(`${new Date().toLocaleString()}: talker: ${alias} (id: ${await contact.id}) sent text content: ${content}`);
      if(new RegExp(config.imageGenKeyRegex).test(content)) {
        replyImage(contact, content);
      }
      else if (content.startsWith(config.privateKey) || config.privateKey === "") {
        let privateContent = content;
        if (config.privateKey === "") {
          privateContent = content.substring(config.privateKey.length).trim();
        }

        if (filesPerUsers[contact.id] && filesPerUsers[contact.id].length > 0) {
          replyToVision(contact, privateContent);
        }
        else
          replyMessage(contact, privateContent);
      }
      else {
        console.log(
          "${new Date().toLocaleString()}: Content is not within the scope of the customizition format"
        );
      }
    }
    else if(isImage && new RegExp(config.trialFeatureUserAllowedListRegex).test(alias)) {
      const fileBox = await msg.toFileBox();
      const fileName = `/tmp/${fileBox.name}`;
      await fileBox.toFile(fileName);
      console.log(`${new Date().toLocaleString()}: talker: ${alias} sent image content saved locally at ${fileName}`);
      if (!filesPerUsers[contact.id]) {
        // If the id does not exist in the map, create an empty array
        filesPerUsers[contact.id] = [];
      } else {
          // If the id exists, replace the array with a new array containing only fileName
          filesPerUsers[contact.id] = [fileName];
      }
      contact.say('已收到你的图片，请开始就图片提问，例如：这张图说的是什么？');
    }
}

async function replyMessage(contact, content) {
  const { id: contactId } = contact;
  try {
    if (
      content.trim().toLocaleLowerCase() ===
      config.resetKey.toLocaleLowerCase()
    ) {
      await callBackend('reset', content, contact.id, []);
      await contact.say("对话已被重置");
      if (filesPerUsers[contact.id]) {
        // If the id does exist in the map, create an empty array
        filesPerUsers[contact.id] = [];
      }
      return;
    }
    const message = await callBackend('chat', content, contact.id, []);

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
          '\n-----------\n出错了, 连接服务超时, 请稍后再试。'
      );
    }
  }
}

async function replyImage(contact, content) {
  const { id: contactId } = contact;
  try {

    const imageUrl = await callBackend('image', content, contact.id, []);
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

async function replyToVision(contact, content) {
  const { id: contactId } = contact;
  try {
    if (
      content.trim().toLocaleLowerCase() ===
      config.resetKey.toLocaleLowerCase()
    ) {
      await callBackend('reset', content, contact.id, []);
      await contact.say("对话已被重置");
      if (filesPerUsers[contact.id]) {
        // If the id does exist in the map, create an empty array
        filesPerUsers[contact.id] = [];
      }
      return;
    }

    const message = await callBackend('vision', content, contact.id, filesPerUsers[contact.id][0]);

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + "\n-----------\n" + message;
      await contact.say(result);
    } else {
      await contact.say(message);
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

async function replyToAudio(contact, localMp3File) {
  const { id: contactId } = contact;
  try {
    const transcriptions = await callBackend('audio', '', contact.id, [localMp3File]);
    return transcriptions;
  } catch (e: any) {
    console.error(e);
    throw e;
  }
}

// TypeScript function to send a POST request with JSON data
async function callBackend(command, content, contactId, localFiles) {
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
