import { WechatyBuilder } from "wechaty";
import { FileBox } from 'file-box';
import qrcodeTerminal from "qrcode-terminal";
import config from "./config.js";
import ChatGPT from "./chatgpt.js";
import { fetch } from 'fetch-undici';
import fs from 'fs';
import simpleNodeLogger from 'simple-node-logger';

let bot: any = {};
const startTime = new Date();
let filesPerUsers : any = {}; //a map to keep user id and their recent files

// create a file only file logger for token usage
let opts = {
  logFilePath: config.tokenUsageLogFile,
  timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS'
}
const usageLog = simpleNodeLogger.createSimpleFileLogger(opts);
usageLog.setLevel('info');

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
  const isAlowedTrialUser = new RegExp(config.trialFeatureUserAllowedListRegex).test(alias);
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
            replyImage(alias, room, groupContent);
            console.log(
              `${new Date().toLocaleString()}: Group name: ${topic} talker: ${await contact.name()} (id: ${await contact.id}) sent text content: ${content}`
            );
            return;
          }
          else
            replyMessage(alias, room, groupContent);
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

      if (isText &&
        content.trim().toLocaleLowerCase() ===
        config.resetKey.toLocaleLowerCase()
      ) {
        await callBackend('reset', content, contact.id, []);
        await contact.say("上下文记忆已重置，可以开始全新的对话");
        if (filesPerUsers[contact.id]) {
          // If the id does exist in the map, create an empty array
          filesPerUsers[contact.id] = [];
        }
        return;
      }

      if(isAudio) {
        if(isAlowedTrialUser) {
          const fileBox = await msg.toFileBox();
          const fileName = `/tmp/${fileBox.name}`;
          await fileBox.toFile(fileName);
          console.log(`${new Date().toLocaleString()}: talker: ${alias} sent audio content saved locally at ${fileName}`);
          content = await replyToAudio(alias, contact, fileName);
          console.log(`${new Date().toLocaleString()}: talker: ${alias} 's audio transcriptions: ${content}`);
        }
        else
          return;
      }

      console.log(`${new Date().toLocaleString()}: talker: ${alias} (id: ${await contact.id}) sent text content: ${content}`);

      if(new RegExp(config.imageGenKeyRegex).test(content)) {
        return replyImage(alias, contact, content);
      }
      else if (content.startsWith(config.privateKey) || config.privateKey === "") {
        let privateContent = content;
        if (config.privateKey === "") {
          privateContent = content.substring(config.privateKey.length).trim();
        }

        if (isAlowedTrialUser &&
            filesPerUsers[contact.id] && filesPerUsers[contact.id].length > 0) {
          replyToVision(alias, contact, privateContent);
        }
        else
          replyMessage(alias, contact, privateContent);
      }
      else {
        console.log(
          "${new Date().toLocaleString()}: Content is not within the scope of the customizition format"
        );
      }
    }
    else if(isImage && isAlowedTrialUser) {
      const fileBox = await msg.toFileBox();
      const fileName = `/tmp/${fileBox.name}`;
      await fileBox.toFile(fileName);
      console.log(`${new Date().toLocaleString()}: talker: ${alias} sent image content saved locally at ${fileName}`);
      // if (!filesPerUsers[contact.id]) {
      //   // If the id does not exist in the map, create an empty array
      //   filesPerUsers[contact.id] = [];
      // }

      filesPerUsers[contact.id] = [fileName];
      await contact.say('已收到你的图片，请开始就图片提问，例如：这张图说的是什么？');
    }
}

async function replyMessage(alias, contact, content) {
  const { id: contactId } = contact;
  const isAlowedTrialUser = new RegExp(config.trialFeatureUserAllowedListRegex).test(alias);

  try {
    const templatedContent = `分类用户需求，根据如下规则返回结果。 如果是生成图片，返回image，如果是理解或解释图片里的信息，分类为vision，否则直接回答用户提问，回答时不要加上分类过程，直接输出你对用户的回答内容。这是用户输入： ${content}`;
    const {'data': message, 'tokens':tokens} = await callBackend('chat', templatedContent, contact.id, []);
    usageLog.info('chat,', alias, ',', tokens);

    if(message == 'image') {
      return replyImage(alias, contact, content);
    }
    else if(message == 'vision' && isAlowedTrialUser) {
      return replyToVision(alias, contact, content);
    }

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + "\n-----------\n" + message;
      await contact.say(result, contact);
      return;
    } else {
      await contact.say(message);
    }
  } catch (e: any) {
    if (e.message.includes("timed out")) {
      await contact.say(
        content +
          '\n-----------\n连接GPT超时错误, 请稍后重试。'
      );
    }
  }
}

async function replyImage(alias, contact, content) {
  const { id: contactId } = contact;
  try {

    const {'data':imageUrl, 'tokens':tokens} = await callBackend('image', content, contact.id, []);
    usageLog.info('image,', alias, ',', tokens);
    const message = '让您久等了，图片已生成，正在传输。'

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + "\n-----------\n" + message;
      await contact.say(result, contact);
    } else {
      await contact.say(message);
    }

    if (imageUrl) {
      const fileBox = FileBox.fromUrl(imageUrl)
      await contact.say(fileBox)
    }

  } catch (e: any) {
    if (e.message.includes("timed out")) {
      await contact.say(
        content +
          "\n-----------\n连接GPT超时错误, 请稍后重试"
      );
    }
  }
}

async function replyToVision(alias, contact, content) {
  const { id: contactId } = contact;
  try {
    let exists = false;
    if(filesPerUsers[contact.id] && filesPerUsers[contact.id].length > 0) {
      exists = fs.existsSync(filesPerUsers[contact.id][0]);
    }
    if(!exists) {
      await contact.say('你希望我来解释图像里的问题对吗？但我并没有收到你的图片，请先发图再提问。');
    }

    const {'data':message, 'tokens':tokens} = await callBackend('vision', content, contact.id, filesPerUsers[contact.id]);
    usageLog.info('vision,', alias, ',', tokens);

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + "\n-----------\n" + message;
      await contact.say(result + "\n-----------\n" + "如果对图像提问完成，需要单独发送一个reset来进入其他对话模式", contact);
    } else {
      await contact.say(message + "\n-----------\n" + "如果对图像提问完成，需要单独发送一个reset来进入其他对话模式");
    }

  } catch (e: any) {
    if (e.message.includes("timed out")) {
      await contact.say(
        content +
          "\n-----------\n连接GPT超时错误, 请稍后重试。"
      );
    }
  }
}

async function replyToAudio(alias, contact, localMp3File) {
  const { id: contactId } = contact;
  try {
    const {'data':transcriptions, 'tokens': tokens} = await callBackend('audio', '', contact.id, [localMp3File]);
    usageLog.info('audio,', alias, ',', tokens);
    return transcriptions;
  } catch (e: any) {
    console.error(e);
  }
}

// TypeScript function to send a POST request with JSON data
async function callBackend(command, content, contactId, localFiles) {
  try {
    let data = {
      'content': content,
      'contactId': contactId
    };
    if(localFiles.length > 0) {
      data['filePath'] = localFiles[0];
    }
    // Send the POST request
    const response = await fetch(`http://localhost:${config.backendPort}/api/${command}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
    });

    // Parse the JSON response
    const responseBody = await response.json() as any;

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP Status Code: ${response.status}, error message: ${responseBody.error}`);
    }

    return responseBody;

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
