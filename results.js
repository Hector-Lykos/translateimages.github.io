const fileType = require('file-type');
const cache = require('./cache');
const ocr = require('./ocr');
const translate = require('./translate');
const {translators} = require('./translators');
const html = require('./html');
const log = require('./log').logger('results');

const maxCounts = {
  character: 1000, // to limit cost
  paragraph: 100   // maximum allowed in one request by Microsoft
};

const templates = html.makeTemplates({
  html: `
    <!doctype html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width">
      <title>Translation results</title>
      <link href="common.css" rel="stylesheet">
      <link href="results.css" rel="stylesheet">
      <script src="results.js"></script>
    </head><body>
      <div>
        <label class="annotation-reset-body" for="annotation-reset"></label>
        <%= navbar %>
        <section id="warnings">
          <%= warningsHTML %>
        </section>
        <main>
          <label class="annotation-reset-main" for="annotation-reset"></label>
          <div class="image-container">
            <%= imageHTML %>
          </div>
        </main>
        <nav id="botnav"><a href=".">Translate another</a></nav>
      </div>
    </body></html>
  `,
  image: `
    <label class="annotation-reset-image" for="annotation-reset">
      <img src="<%- imageURI %>">
    </label>
    <form class="annotation-container">
      <%= annotationsHTML %>
      <input id="annotation-reset" type="reset">
    </form>
  `,
  annotation: `
    <label class="annotation" style="left: <%- x1 %>px; top: <%- y1 %>px;" onmouseup="handleSelection(this)">
      <input name="annotation-select" type="radio" onfocus="annotationFocus(this)">
      <svg class="outline" style="z-index: <%- z1 %>;" width="<%- dx %>" height="<%- dy %>" viewbox="0 0 <%- dx %> <%- dy %>" xmlns="http://www.w3.org/2000/svg">
        <polygon points="<%- points %>" fill="none" stroke="black" />
      </svg>
      <div class="tooltip-root"><div class="tooltip <%- hideTranslation %>">
        <div class="translation"><%= translationHTML %></div>
        <div class="attribution">
          <span>Translated from <%- srcLangName %> by</span><a href="http://aka.ms/MicrosoftTranslatorAttribution" target="_blank" rel="noopener"><img src="translated-by-microsoft.png" alt="Microsoft"></a>
        </div>
        <div class="original"><%= textHTML %></div>
        <%= linksHTML %>
      </div></div>
    </label>
  `,
  translateLink: `<a href="<%- url %>" target="_blank" rel="noopener" data-size="<%- windowSize %>" onclick="openTranslate(this, event)"><%- label %></a>`,
  translateLine: `<div class="openT"><%= lineHTML %></div>`,
  count: `<div>Translation aborted: Maximum <%- countType %> count of <%- maxCount %> exceeded.</div>`
});

function generateTranslateLinks({srcLang, destLang, text}) {
  const textJoined = translate.joinLines(text);
  let linksHTML = '';
  translators.forEach((translator) => {
    const {windowSize} = translator;
    let lineHTML = '';
    lineHTML += templates.translateLink({
      url: translator.link({srcLang, destLang, text: textJoined}),
      label: `open in ${translator.name}`,
      windowSize
    });
    if (text !== textJoined) {
      lineHTML += ' ' + templates.translateLink({
        url: translator.link({srcLang, destLang, text}),
        label: "[don't join lines]",
        windowSize
      });
    }
    linksHTML += templates.translateLine({lineHTML});
  });
  return linksHTML;
}

function generateAnnotation({translation, text, vertices, srcLang, destLang}, languages) {
  const xs = vertices.map(p => p.x);
  const ys = vertices.map(p => p.y);
  const zs = vertices.map(p => p.x + p.y);
  const x1 = Math.max(0, Math.min.apply(Math, xs));
  const y1 = Math.max(0, Math.min.apply(Math, ys));
  const z1 = Math.min.apply(Math, zs);
  const dx = Math.max.apply(Math, xs) - x1;
  const dy = Math.max.apply(Math, ys) - y1;
  const points = vertices.map(p => `${p.x - x1},${p.y - y1}`).join(' ');
  const translationHTML = html.escapeBR(translation);
  const textHTML = html.escapeBR(text);
  const srcLangName = (languages.get(srcLang) || {}).name;
  const linksHTML = generateTranslateLinks({srcLang, destLang, text});
  const hideTranslation = translation.length ? '' : 'hide-translation';
  return {z1, x1, y1, dx, dy, points, translationHTML, textHTML, srcLangName, linksHTML, hideTranslation};
}

function generateHTML(options) {
  const {annotations, imageData, warningsHTML, languages} = options;
  const annotationsData = annotations.map(o => generateAnnotation(o, languages));
  const zs = annotationsData.map(o => o.z1).sort((a, b) => a - b);
  annotationsData.forEach(o => {
    o.z1 = zs.indexOf(o.z1) - zs.length;
  });
  const annotationsHTML = annotationsData.map(templates.annotation).join('');
  let mimeType = (fileType(imageData) || {}).mime;
  if (!mimeType || !(/^image\//.test(mimeType))) mimeType = 'application/octet-stream';
  const imageURI = `data:${mimeType};base64,${imageData.toString('base64')}`;
  const imageHTML = templates.image({imageURI, annotationsHTML});
  const resultsHTML = templates.html({imageHTML, navbar: html.navbar, warningsHTML});
  return resultsHTML;
}

async function results({imageData, srcLang, destLang, languages, user}) {
  let warningsHTML = '';
  const keys = await cache.getKeys(imageData);
  const annotations = await ocr.ocr({keys, imageData, srcLang, user});
  const counts = {
    character: annotations.map(x => x.text).join('').length,
    paragraph: annotations.length
  };
  let countExceeded = false;
  for (let countType of ['character', 'paragraph']) {
    let maxCount = maxCounts[countType];
    if (counts[countType] > maxCount) {
      countExceeded = true;
      warningsHTML += templates.count({countType, maxCount});
      break;
    }
  }
  if (!countExceeded) {
    await translate.translate({keys, annotations, srcLang, destLang, user});
  }
  annotations.forEach(x => {
    if (!x.translation) x.translation = '';
    if (!x.srcLang) x.srcLang = srcLang;
    if (!x.destLang) x.destLang = destLang;
  });
  const resultsHTML = generateHTML({annotations, imageData, warningsHTML, languages});
  log({hash: keys.storage, charCount: counts.character, srcLang, destLang});
  return {html: resultsHTML, keys};
}

function blankHTML() {
  const resultsHTML = templates.html({imageHTML: '', navbar: html.navbar, warningsHTML: ''});
  return resultsHTML;
}

module.exports = {results, blankHTML};
