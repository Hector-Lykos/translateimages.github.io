const {URL} = require('url');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fetch = require('node-fetch');
const {SocksProxyAgent} = require('socks-proxy-agent');
const _ = require('lodash');
const fs = require('fs');
const fsPromises = fs.promises;
const index = require('./index');
const results = require('./results');
const translate = require('./translate');
const feedback = require('./feedback');
const html = require('./html');
const throttle = require('./throttle');

const staticPath = './static';
const htmlPath = './html';
const maxFileSize = (10 << 20);

const limits = {
  fields: index.fieldCount - 1,
  files: 1,
  fileSize: maxFileSize,
  fieldSize: Math.ceil(maxFileSize*(8/6))
};
const storage = multer.memoryStorage();
const upload = multer({storage, limits});

const app = express();
const port = +(process.argv[2] || 3000);

const cookieSecret = fs.readFileSync('../keys/cookie-secret.txt', {encoding: 'utf8'}).trim();
app.use(cookieParser(cookieSecret));

app.set('trust proxy', 'loopback');

const torAgent = new SocksProxyAgent('socks://127.0.0.1:9050');

function parseQuery(keys, query) {
  const output = {};
  keys.forEach(k => {
    if ((k in query) && (typeof query[k] === 'string')) {
      output[k] = query[k];
    }
  });
  return output;
}

function credentials(req) {
  if (typeof(req.signedCookies.login) !== 'object') return;
  const name = req.signedCookies.login.name;
  if (typeof(name) !== 'string') return;
  return {name, ip: req.ip};
}

function getUser(req) {
  return credentials(req) || {ip: req.ip};
}

app.get('/', (req, res, next) => (async () => {
  const options = parseQuery(index.fillableFields, req.query);
  options.user = getUser(req);
  const {html} = await index.index(options);
  res.send(html);
})().catch(next));

app.get('/results', (req, res) => {
  res.send(results.blankHTML());
});

app.post('/results', upload.single('image'), (req, res, next) => (async () => {
  const issue = throttle.overCost('cloud', getUser(req));
  if (issue) return res.status(429).send(issue);
  let imageData;
  if (req.file) {
    imageData = req.file.buffer;
  } else if (req.body.imageB64) {
    imageData = Buffer.from(req.body.imageB64.replace(/^.*,/, ''), 'base64');
  } else if (req.body.imageURL) {
    const {imageURL} = req.body;
    if (/^https?:/i.test(imageURL)) {
      let imageURL2;
      try {
        imageURL2 = new URL(imageURL);
      } catch(err) {
        return res.status(400).send(`Invalid URL: ${_.escape(imageURL)}`);
      }
      try {
        const fetchOptions = {size: maxFileSize};
        if (/^https?:\/\/[^\/]+\.onion\//i.test(imageURL)) {
          fetchOptions.agent = torAgent;
        }
        const resURL = await fetch(imageURL2, fetchOptions);
        if (resURL.ok) {
          imageData = await resURL.buffer();
        } else {
          return res.status(404).send(
            `${+resURL.status} ${_.escape(resURL.statusText)} from ${_.escape(imageURL)}`
          );
        }
      } catch(err) {
        if (err instanceof fetch.FetchError) {
          if (err.type === 'max-size') {
            return res.status(413).send('Error: File too large');
          } else {
            return res.status(404).send(`Error: ${_.escape(err.message)}`);
          }
        }
        throw err;
      }
    } else if (/^data:[^,]*;base64,/i.test(imageURL)) {
      imageData = Buffer.from(decodeURIComponent(imageURL.replace(/^.*,/, '')), 'base64');
    } else {
      return res.status(400).send(`Unsupported URL type: ${_.escape(imageURL)}`);
    }
  } else {
    return res.status(400).send('Error: No image posted.');
  }
  if (imageData.length === 0) {
    return res.status(400).send('Error: File is empty.');
  }
  const {srcLang, destLang} = req.body;
  const languages = await translate.getLanguages();
  if (srcLang !== 'auto' && !languages.has(srcLang)) {
    return res.status(400).send(`Unsupported source language: ${_.escape(srcLang)}`);
  }
  if (!languages.has(destLang)) {
    return res.status(400).send(`Unsupported destination language: ${_.escape(destLang)}`);
  }
  const {html} = await results.results({imageData, srcLang, destLang, languages, user: getUser(req)});
  res.send(html);
})().catch(next));

app.get(['/tools', '/privacy'], (req, res, next) => (async () => {
  const template = await fsPromises.readFile(`${htmlPath}${req.path}`, {encoding: 'utf-8'});
  const templateHTML = _.template(html.trim(template))({
    navbar: html.navbar,
    host: `${req.protocol}://${req.hostname}/`
  });
  res.send(templateHTML);
})().catch(next));

app.get('/feedback', (req, res) => {
  const feedbackHTML = feedback.feedback(getUser(req));
  res.send(feedbackHTML);
});

app.post('/feedbackposted', express.urlencoded({extended: false}), (req, res, next) => (async () => {
  const issue = throttle.overCost('feedback', getUser(req));
  if (issue) return res.status(429).send(issue);
  const {message} = req.body;
  if (typeof message !== 'string') return res.status(400).send('Invalid form data.');
  if (message.length > feedback.maxLength) return res.status(413).send('Error: Message too long.');
  const responseHTML = await feedback.submit({message}, getUser(req));
  res.send(responseHTML);
})().catch(next));

app.use(express.static(staticPath));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE' || (err.code === 'LIMIT_FIELD_VALUE' && err.field === 'imageB64')) {
      res.status(413).send('Error: File too large');
    } else {
      const code = (err.code === 'LIMIT_FIELD_VALUE') ? 413 : 400;
      res.status(code).send(`Error: ${_.escape(err.message)}`);
    }
  } else {
    next(err);
  }
});

const server = app.listen(port, 'localhost', (err) => {
  if (err) {
    return console.error(err);
  }
  console.log(`listening on port ${port}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
