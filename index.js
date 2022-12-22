const html = require('./html');
const translate = require('./translate');
const throttle = require('./throttle');

const topLanguages = ['en', 'ja'];
const fillableFields = ['imageURL', 'imageB64', 'imageB64Name', 'srcLang', 'destLang'];
const fieldCount = 7;

const templates = html.makeTemplates({
  html: `
    <!doctype html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width">
      <title>Translate an image</title>
      <link href="common.css" rel="stylesheet">
      <link href="index.css" rel="stylesheet">
      <script src="index.js"></script>
    </head><body>
      <%= navbar %>
      <form action="results" method="POST" enctype="multipart/form-data">
        <section class="about">
          <h1>Translate an image</h1>
          <div class="small">Powered by Google&#39;s <a href="https://cloud.google.com/vision/" target="_blank" rel="noopener">Vision API</a> and Microsoft&#39;s <a href="https://www.microsoft.com/en-us/translator/business/translator-api/" target="_blank" rel="noopener">Translator API</a></div>
          <div style="font-weight: bold">This functionality is now available for free directly from Google by clicking the "Search by image" button at <a href="https://images.google.com/">https://images.google.com/</a>. Thus this site has been discontinued. Source code for the site is available at <a href="https://codeberg.org/translateimages/translateimages.site">https://codeberg.org/translateimages/translateimages.site</a>.</div>
        </section>
        <section class="imageselect">
          <label>
            <div>Choose an image from your computer:</div>
            <input name="image" type="file" onchange="fileInputChanged(this)">
            <div class="imagepreview" hidden>
              <button type="button" onclick="clearFile()">\xd7</button>
              <img>
              <span class="imagepreview-filename"></span>
            </div>
          </label>
          <label>
            <div>Or paste a link to the image:</div>
            <input name="imageURL" type="text" value="<%- imageURL %>">
          </label>
          <label>
            <div>Or drag and drop or paste an image.</div>
            <input name="imageB64" type="hidden" value="<%- imageB64 %>">
            <input class="imageB64Name" type="hidden" value="<%- imageB64Name %>">
          </label>
        </section>
        <section class="languages">
          <label>
            <div>Translate from:</div>
            <select name="srcLang">
              <option value="auto">Auto-detect</option>
              <%= srcLangHTML %>
            </select>
          </label>
          <label>
            <div>Translate to:</div>
            <select name="destLang">
              <%= destLangHTML %>
            </select>
          </label>
        </section>
        <section></section>
        <section class="verifysubmit" <%= submitHidden %>>
          <input value="Submit" type="submit">
        </section>
        <output <%= outputHidden %>><%- issue %></output>
      </form>
    </body></html>
  `,
  language: `<option value="<%- code %>" <%= selected %>><%- name %></option>`,
});

function generateLangHTML(languages, selectedLang) {
  let langHTML = '';
  topLanguages.forEach(code => {
    const {name} = languages.get(code);
    const selected = (code === selectedLang) ? 'selected' : '';
    if (name) langHTML += templates.language({code, name, selected});
  });
  languages.forEach(({name}, code) => {
    if (!topLanguages.includes(code)) {
      const selected = (code === selectedLang) ? 'selected' : '';
      langHTML += templates.language({code, name, selected});
    }
  });
  return langHTML;
}

async function index({imageURL, imageB64, imageB64Name, srcLang, destLang, user}) {
  const languages = await translate.getLanguages();
  const srcLangHTML = generateLangHTML(languages, srcLang);
  const destLangHTML = generateLangHTML(languages, destLang);
  const issue = throttle.overCost('cloud', user);
  const submitHidden = issue ? 'hidden' : '';
  const outputHidden = issue ? '' : 'hidden';
  const indexHTML = templates.html({imageURL, imageB64, imageB64Name, srcLangHTML, destLangHTML, navbar: html.navbar, submitHidden, outputHidden, issue});
  return {html: indexHTML};
}

module.exports = {index, fillableFields, fieldCount};
