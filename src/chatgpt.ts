import { ChatGPTClient } from "@waylaidwanderer/chatgpt-api";
import config from "./config.js";

//For Image Generation
import { FileBox } from 'file-box';
import { fetch } from 'fetch-undici';
import { ProxyAgent } from 'undici';

const clientOptions = {
  // (Optional) Support for a reverse proxy for the completions endpoint (private API server).
  // Warning: This will expose your `openaiApiKey` to a third party. Consider the risks before using this.
  // reverseProxyUrl: "",
  // (Optional) Parameters as described in https://platform.openai.com/docs/api-reference/completions
  modelOptions: {
    // You can override the model name and any other parameters here, like so:
    //model: "gpt-3.5-turbo",
    model: "gpt-4-1106-preview",
    // I'm overriding the temperature to 0 here for demonstration purposes, but you shouldn't need to override this
    // for normal usage.
    temperature: 0,
    // Set max_tokens here to override the default max_tokens of 1000 for the completion.
    // max_tokens: 1000,
  },
  // (Optional) Davinci models have a max context length of 4097 tokens, but you may need to change this for other models.
  // maxContextTokens: 4097,
  // (Optional) You might want to lower this to save money if using a paid model like `text-davinci-003`.
  // Earlier messages will be dropped until the prompt is within the limit.
  // maxPromptTokens: 3097,
  // (Optional) Set custom instructions instead of "You are ChatGPT...".
  // promptPrefix: 'You are Bob, a cowboy in Western times...',
  // (Optional) Set a custom name for the user
  // userLabel: 'User',
  // (Optional) Set a custom name for ChatGPT
  // chatGptLabel: 'ChatGPT',
  // (Optional) Set to true to enable `console.debug()` logging
  debug: false,
};

const cacheOptions = {
  // Options for the Keyv cache, see https://www.npmjs.com/package/keyv
  // This is used for storing conversations, and supports additional drivers (conversations are stored in memory by default)
  // For example, to use a JSON file (`npm i keyv-file`) as a database:
  // store: new KeyvFile({ filename: 'cache.json' }),
};

export default class ChatGPT {
  private chatGPT: any;
  private chatOption: any;
  constructor() {
    this.chatGPT = new ChatGPTClient(
      config.OPENAI_API_KEY,
      {
        ...clientOptions,
        reverseProxyUrl: `${config.reverseProxyUrl}/v1/chat/completions`,
      },
      cacheOptions
    );
    this.chatOption = {};
    // this.test();
  }
  async test() {
    const response = await this.chatGPT.sendMessage("hello");
    console.log(`${new Date().toLocaleString()}: response test: `, response);
  }
  async getChatGPTTextReply(content, contactId) {
    const data = await this.chatGPT.sendMessage(
      content,
      this.chatOption[contactId]
    );
    const { response, conversationId, messageId } = data;
    this.chatOption = {
      [contactId]: {
        conversationId,
        parentMessageId: messageId,
      },
    };
    console.log(`${new Date().toLocaleString()}: response: `, response);
    // response is a markdown-formatted string
    return response;
  }

  // TypeScript function to send a POST request with JSON data
async getChatGPTImageReply(content) {
  try {
    const data = {
      'model': 'dall-e-3',
      'prompt': `${content}`,
      "n": 1,
      "size": "1024x1024"
    };
    // Convert the JavaScript object to a JSON string
    const jsonData = JSON.stringify(data);
    console.log(`${config.reverseProxyUrl}/v1/images/generations`)
    console.log(`${jsonData}`)

    // Send the POST request
    const response = await fetch(`${config.reverseProxyUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.OPENAI_API_KEY}`
        },
        body: jsonData,
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`${new Date().toLocaleString()}: HTTP Status Code: ${response.status}`);
    }
    // Parse the JSON response
    const responseBody = await response.json() as any;
    // Access the 'url' value inside the 'data' array
    if (responseBody.data && responseBody.data.length > 0) {
      console.log(`${new Date().toLocaleString()}: image URL: ${responseBody.data[0].url}`);
      return responseBody.data[0].url;
    } else {
      throw new Error(`${new Date().toLocaleString()}: No data found in the response`);
    }

  } catch (error) {
      console.error(`${new Date().toLocaleString()}: Error during image generation api: ${error}`);
  }
}

  async replyMessage(contact, content) {
    const { id: contactId } = contact;
    try {
      if (
        content.trim().toLocaleLowerCase() ===
        config.resetKey.toLocaleLowerCase()
      ) {
        this.chatOption = {
          ...this.chatOption,
          [contactId]: {},
        };
        await contact.say("对话已被重置");
        return;
      }
      const message = await this.getChatGPTTextReply(content, contactId);

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

  async replyImage(contact, content) {
    const { id: contactId } = contact;
    try {

      const imageUrl = await this.getChatGPTImageReply(content);
      const message = '让您久等了，图片已生成。'

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
            "\n-----------\nERROR: Please try again, ChatGPT timed out for waiting response."
        );
      }
    }
  }
}
