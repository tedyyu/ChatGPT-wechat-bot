import express, { Request, Response } from 'express';
import config from "./config.js";
import ChatGPT from "./chatgpt.js";

const app = express();
const port = config.backendPort;
const chatGPTClient: any = new ChatGPT();

// Use express.json() middleware to parse JSON payloads
app.use(express.json());

// Define the /api/chat route
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {content: content, contactId: contactId} = req.body;
    console.log(`/api/chat: user ${contactId}, prompt : ${content}`);
    const {data, tokens} = await chatGPTClient.getGPTTextReply(content, contactId);
    console.log(`  total_tokens: ${tokens}, response: ${data}`);
    res.send({'data': data, 'tokens': tokens});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
  }
});

// Define the /api/reset route
app.post('/api/reset', (req, res) => {
   chatGPTClient.resetChatContext();
   res.status(200).send();
});

// Define the /api/image route
app.post('/api/image', async (req, res) => {
  try {
    const {content: content, contactId: contactId} = req.body;
    console.log(`/api/image: user ${contactId}, prompt : ${content}`);
    const {data, tokens} = await chatGPTClient.getGPTImageReply(content, contactId);
    console.log(`  total_tokens: ${tokens}, response: ${data}`);
    res.send({'data': data, 'tokens': tokens}); //imageURL
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Define the /api/vision route
app.post('/api/vision', async (req, res) => {
  try {
    const {content: content, contactId: contactId, filePath: localImageFile } = req.body;
    console.log(`/api/vision: user ${contactId}, localImageFile: ${localImageFile}, prompt : ${content}`);
    const {data, tokens}  = await chatGPTClient.getGPTVisionReply(content, localImageFile);
    console.log(`  total_tokens: ${tokens}, response: ${data}`);
    res.send({'data': data, 'tokens': tokens});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Define the /api/audio route
app.post('/api/audio', async (req, res) => {
  try {
    const {content: content, contactId: contactId, filePath: localMp3File } = req.body;
    console.log(`/api/audio: user ${contactId}, localMp3File : ${localMp3File}`);
    const {data, tokens}  = await chatGPTClient.getGPTAudioReply(localMp3File);
    console.log(`  total_tokens: ${tokens}, response: ${data}`);
    res.send({'data': data, 'tokens': tokens});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
