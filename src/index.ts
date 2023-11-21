import { WechatyBuilder } from "wechaty";
import { FileBox } from 'file-box';
import qrcodeTerminal from "qrcode-terminal";
import config from "./config.js";
import ChatGPT from "./chatgpt.js";

let bot: any = {};
const startTime = new Date();
let chatGPTClient: any = null;
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
  if (msg.self()) {
    return;
  }

  if (room && isText) {
    const topic = await room.topic();
    console.log(
      `${new Date().toLocaleString()}: Group name: ${topic} talker: ${await contact.name()} content: ${content}`
    );

    const pattern = RegExp(`^@${receiver.name()}\\s+${config.groupKey}[\\s]*`);
    if (await msg.mentionSelf()) {
      if (pattern.test(content)) {
        const groupContent = content.replace(pattern, "");
        chatGPTClient.replyMessage(room, groupContent);
        return;
      } else {
        console.log(
          "${new Date().toLocaleString()}: Content is not within the scope of the customizition format"
        );
      }
    }
  } else
    if (isText) {
      console.log(`${new Date().toLocaleString()}: talker: ${alias} sent text content: ${content}`);
      if(content == "test-image") {
        const fileBox = FileBox.fromUrl('https://wechaty.js.org/img/icon.png')
        await contact.say(fileBox)
      }
      else if (content.startsWith(config.privateKey) || config.privateKey === "") {
        let privateContent = content;
        if (config.privateKey === "") {
          privateContent = content.substring(config.privateKey.length).trim();
        }
        chatGPTClient.replyMessage(contact, privateContent);
      }
      else {
        console.log(
          "${new Date().toLocaleString()}: Content is not within the scope of the customizition format"
        );
      }
    }
    else if(isImage) {
      const fileBox = await msg.toFileBox();
      const fileName = `/tmp/${fileBox.name}.png`;
      await fileBox.toFile(fileName);
      console.log(`${new Date().toLocaleString()}: talker: ${alias} sent image content saved locally at ${fileName}`);
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
    chatGPTClient = new ChatGPT();
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
