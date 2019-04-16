const fs = require('fs');
const puppeteer = require('puppeteer');
const program = require('commander');
const request = require('request-promise');
const jsonexport = require('jsonexport');

class Scrape {
    constructor(config) {
        this.browser = null;
        this.page = null;

        this.urls = config.urls;
        this.content = config.content;
        this.output = config.output;
        this.data = [];

        this.start();
    }

    async start() {
        await this.openBrowser();
        await this.process();
        await this.closeBrowser();
        await this.save();
    }

    async openBrowser() {
        this.browser = await puppeteer.launch({ headless: true });
        console.log('Open Browser');
        
        this.page = await this.browser.newPage();
        console.log('Create new page');
        
        await this.page.setViewport({ width: 1920, height: 926 });
        console.log('Set Viewport');
    }

    async closeBrowser() {
        await this.browser.close();
        console.log('Close Browser');
    }

    async process() {
        for (let i = 0; i < this.urls.length; i++) {
            const url = this.urls[i].url;
            const date = this.urls[i].date;

            const data = await this.scrape(url);
            data.date = date;

            this.data.push(data);
        }
        console.log('Processed Urls');
    }

    async scrape(url) {
        await this.page.goto(url);

        console.log(`Fetched: ${url}`);

        const scrapeData = await this.page.evaluate((content) => {
            const data = {};
            content.forEach((item) => {
                if (item.children) {
                    data[item.handle] = [];
                    const elem = document.querySelectorAll(item.node);
                    elem.forEach((listElem) => {
                        item.children.forEach((childItem) => {
                            const childElem = listElem.querySelector(childItem.node);
                            const value = childElem[childItem.action];
                            data[item.handle].push({ [childItem.handle]: value });
                        });
                    });
                } else {
                    const elem = document.querySelector(item.node);
                    if (elem) {
                        const value = elem[item.action];
                        data[item.handle] = value;
                    } else {
                        data[item.handle] = null;
                    }
                    
                }
            });
            return data;
        }, this.content);

        return scrapeData;
    }

    async save() {
        const saveMap = {
            post: this.saveToPost.bind(this),
            csv: this.saveToCsv.bind(this)
        };

        for (let i = 0; i < this.data.length; i++) {
            const element = this.data[i];

            await saveMap[this.output.action](element);
        }
    }

    async saveToPost(data) {
        console.log('Save to post');
        try {
            const response = await request.post({ url: this.output.url, headers: {'accept': 'application/json'}, form: data });
            console.log('saveToPost -> success', response)
        } catch (error) {
            console.log('saveToPost -> error', data.title);
        }
        
    }

    async saveToCsv(data) {
        console.log('Save to Csv', this.output.path);
        // const listing = data['blog-lising'];
        jsonexport(data, (err, csv) => {
            if (err) return console.log(err);
            fs.writeFile(this.output.path, csv, 'utf8', function (err) {
                if (err) {
                    console.log('Some error occured - file either not saved or corrupted file saved.');
                } else {
                    console.log('It\'s saved!');
                }
            });
        });
    }
}

program
    .version('0.0.1')
    .option('-c, --config', 'Path to config file')
    .action((configPath) => {
        const jsonRaw = fs.readFileSync(configPath);
        const config = JSON.parse(jsonRaw);

        new Scrape(config);
    });

program.parse(process.argv);