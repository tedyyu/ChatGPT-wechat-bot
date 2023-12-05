import fs from 'fs';
import readline from 'readline';


export default class SensitiveHandler {
  private words: string[] = [];
  private initialized = false;

  private async init() {
    await this.loadFile('Keywords.txt');
    this.initialized = true;
    console.log('SensitiveHandler initialized.');
  }

  // This function reads the file and processes the lines.
  private async loadFile(filePath: string) {
    this.words = [];
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      this.words.push(line.trim()); // Add each line to the array
    }
  }

  async process(input: string): Promise<string> {
    if(!this.initialized) await this.init();

    // Iterate over the lines array and check for matches
    this.words.forEach((word, index) => {
      if(index==0) console.log(`first word is "${word}". includes:${input.includes(word)}`);
      if (input.includes(word)) {
        console.log(`Input matches sensitive "${word}" and will replace it with "**"`);
        input = input.replace(new RegExp(this.words[index], 'g'), '**'); // Replace occurrences of 'input' with '**'
      }
    });

    return input;
  }
}

let content = `在一个由钢铁和玻璃构成的世界里，天空被永久的灰色云层所笼罩。这是一个分裂的社会，贫富之间的鸿沟宽广而深邃，仿佛两个平行宇宙，在同一片土地上却永远不相交。

富人们生活在高耸的塔楼中，他们的窗户用厚重的帘幕遮挡，以免不慎瞥见下方的贫穷街区。他们的日子里充满了奢华的宴会、昂贵的服饰和无尽的娱乐。机器为他们工作，而他们则沉浸在自己创造的乌托邦中，忘记了外面世界的苦难。

与此同时，贫民窟里的人们挤在狭小、阴暗的房间里，他们的衣物薄如蝉翼，几乎抵御不了寒冷。他们的食物是稀少而单调的，每一口都必须精打细算。他们的孩子们眼中没有童真，只有早熟的严肃，因为他们知道，生活不会给予他们任何优待。

在这个世界里，金钱是唯一的语言，而大多数人连发声的权利都没有。贫富之间的对话变得荒谬而无意义，因为双方根本就不在同一个频率上。

然而，即使在这样的社会中，也有人敢于梦想。在贫民窟的角落里，有人在默默地画图、写字，记录着这个时代的不公。他们的声音虽小，但坚定而有力，像是远处雷声的预兆，预示着即将到来的风暴。

乔治·奥威尔如果在这个时代，他可能会写下这样的故事，提醒我们：当一个社会的贫富差距变得如此极端，人性的光辉也会随之黯淡。而改变，总是从认识这种不平等开始的。权利!`;

//testing
//console.log(`content includes: ${content.includes('权利')}`);
console.log(await new SensitiveHandler().process(content));
