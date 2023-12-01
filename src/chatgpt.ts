import { ChatGPTClient } from "chatgpt-api";
import config from "./config.js";

//For Image Generation
import { fetch } from 'fetch-undici';

//For Vision
import fs from 'fs';

//For Audio
import {default as nfetch} from 'node-fetch';
import FormData from 'form-data';

const clientOptions = {
  // (Optional) Support for a reverse proxy for the completions endpoint (private API server).
  // Warning: This will expose your `openaiApiKey` to a third party. Consider the risks before using this.
  // reverseProxyUrl: "",
  // (Optional) Parameters as described in https://platform.openai.com/docs/api-reference/completions
  modelOptions: {
    // You can override the model name and any other parameters here, like so:
    model: config.chatModel ?? "gpt-4-1106-preview",
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

  async getGPTTextReply(content, contactId) {
    //check temperature in the content first
    const regex = /temperature=(\d\.\d)/;
    const match = regex.exec(content);
    let temperature = 0.0;

    if (match && match[1]) {
      temperature = parseFloat(match[1]); // Convert the captured group to a float.
    }

    let options = this.chatOption[contactId] ?? {};
    if(temperature > 0) {
      console.log(`${new Date().toLocaleString()}: user customized temperature: ${temperature}`);
      options.modelOptions = {'temperature': temperature};
    }

    const data = await this.chatGPT.sendMessage(
      content,
      options
    );
    const { response, conversationId, messageId, usage } = data;
    this.chatOption = {
      [contactId]: {
        conversationId,
        parentMessageId: messageId,
      },
    };
    return {
      'data': response,
      'tokens': usage.total_tokens,
    };
  }

  // TypeScript function to send a POST request with JSON data
  async getGPTImageReply(content) {
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
        return {
          'data': responseBody.data[0].url,
          'tokens': responseBody.usage.total_tokens,
        };
      } else {
        throw new Error(`${new Date().toLocaleString()}: No data found in the image api response`);
      }

    } catch (error) {
        console.error(`${new Date().toLocaleString()}: Error during image generation api: ${error}`);
    }
  }

  async getGPTVisionReply(content, localImageFile) {
    try {
      const base64Image: string = this.encodeImage(localImageFile);

      const data = {
        "model": "gpt-4-vision-preview",
        "messages": [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": `${content}`
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": `data:image/jpeg;base64,${base64Image}`,
                }
              }
            ]
          }
        ],
        "max_tokens": 2400
      };

      console.log(`${config.reverseProxyUrl}/v1/chat/completions`)
      const jsonData = JSON.stringify(data);
      //console.log(`${jsonData}`)

      // Send the POST request
      const response = await fetch(`${config.reverseProxyUrl}/v1/chat/completions`, {
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
      console.log(JSON.stringify(responseBody));
      // Access the 'url' value inside the 'data' array
      if (responseBody.choices && responseBody.choices.length > 0) {
        return {
          'data': responseBody.choices[0].message?.content,
          'tokens': responseBody.usage.total_tokens,
        };
      } else {
        throw new Error(`${new Date().toLocaleString()}: No data found in the vision api response`);
      }

    } catch (error) {
        console.error(`${new Date().toLocaleString()}: Error during vision api: ${error}`);
    }
  }

  async getGPTAudioReply(localMp3File) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(localMp3File));
      form.append('model', 'whisper-1');

      console.log(`${config.reverseProxyUrl}/v1/audio/transcriptions`)

      // Make the request
      const response = await nfetch(`${config.reverseProxyUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.OPENAI_API_KEY}`
            // Content-Type header is set automatically
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseBody: any = await response.json();
      console.log(JSON.stringify(responseBody));
      return {
        'data': responseBody.text,
        'tokens': 1,
      };
    } catch (error) {
        console.error(`${new Date().toLocaleString()}: Error during audio/transcriptions api: ${error}`);
    }
  }

  // Function to encode the image
  encodeImage(imagePath: string): string {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error(`${new Date().toLocaleString()}: Error open image file and convert its content to base64: ${error}`);
      throw error;
    }
  }

  resetChatContext(contactId) {
    this.chatOption = {
      ...this.chatOption,
      [contactId]: {},
    };
  }
}
