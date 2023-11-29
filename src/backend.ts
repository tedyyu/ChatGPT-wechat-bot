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
    const message = await chatGPTClient.getGPTTextReply(content, contactId);
    console.log(`  response: ${message}`);
    res.send({'data': message});
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
    const imageUrl = await chatGPTClient.getGPTImageReply(content, contactId);
    console.log(`  response: ${imageUrl}`);
    res.send({'data': imageUrl});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Define the /api/vision route
app.post('/api/vision', async (req, res) => {
  try {
    const {content: content, contactId: contactId, filePath: localImageFile } = req.body;
    console.log(`/api/vision: user ${contactId}, localImageFile: ${localImageFile}, prompt : ${content}`);
    const result = await chatGPTClient.getGPTVisionReply(content, contactId);
    console.log(`  response: ${result}`);
    res.send({'data': result});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Define the /api/audio route
app.post('/api/audio', async (req, res) => {
  try {
    const {content: content, contactId: contactId, filePath: localMp3File } = req.body;
    console.log(`/api/audio: user ${contactId}, localMp3File : ${localMp3File}`);
    const transcriptions = await chatGPTClient.getGPTAudioReply(localMp3File);
    console.log(`  response: ${transcriptions}`);
    res.send({'data': transcriptions});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
