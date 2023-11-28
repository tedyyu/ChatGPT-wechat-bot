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
    const { content, contactId } = req.body;
    console.log(`/api/chat: user ${contactId}, prompt : ${content}`);
    const message = await chatGPTClient.getGPTTextReply(content, contactId);
    res.send({'data:': message});
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
    const { content, contactId } = req.body;
    console.log(`/api/image: user ${contactId}, prompt : ${content}`);
    const imageUrl = await chatGPTClient.getGPTImageReply(content, contactId);
    res.send({'data:': imageUrl});
  } catch (e: any) {
    console.error(e);
    res.status(400).send({'error': e.message});
}});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
