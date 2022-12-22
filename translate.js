const fs = require('fs');
const fetch = require('node-fetch');
const cache = require('./cache');
const throttle = require('./throttle');

const keyFilename = '../keys/microsoft_translator_key.json';
const translateAPI = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0';
const languagesAPI = 'https://api.cognitive.microsofttranslator.com/languages?api-version=3.0';

const key = JSON.parse(fs.readFileSync(keyFilename, {encoding: 'utf-8'})).key;

async function requestError(context, res) {
  const text = await res.text();
  return new Error(`${context}: ${res.status} ${res.statusText}\n${text}`);
}

function computeCost(text) {
  return 0.01 * text.join('').length;
}

const joinLinesRegexp = new RegExp('(?<!\\p{P})\\n(?!\\p{P})', 'ug'); // https://github.com/jshint/jshint/issues/2361

function joinLines(text) {
  return text.replace(joinLinesRegexp, ' ');
}

async function translate({keys, annotations, srcLang, destLang, user}) {
  let text = annotations.map(x => joinLines(x.text));
  if (!text.length) {
    return annotations;
  }
  const cost = computeCost(text);
  text = text.map(x => ({Text: x}));
  let url = translateAPI;
  if (srcLang !== 'auto') {
    url += `&from=${srcLang}`;
  }
  url += `&to=${destLang}`;
  const headers = {
    'Ocp-Apim-Subscription-Key': key,
    'Content-Type': 'application/json'
  };
  const translations = await cache.writeJSON(
    keys,
    `t.${srcLang}.${destLang}.json`,
    {text, provider: 'microsoft'},
    async () => {
      throttle.addCost('cloud', user, cost);
      const res = await fetch(url, {method: 'POST', headers, body: JSON.stringify(text)});
      if (!res.ok) {
        throw await requestError('failed to fetch translation results', res);
      }
      return res.json();
    }
  );
  translations.forEach((result, i) => {
    if (annotations[i]) {
      annotations[i].translation = result.translations[0].text;
      annotations[i].srcLang = (srcLang === 'auto') ? result.detectedLanguage.language : srcLang;
      annotations[i].destLang = destLang;
    }
  });
  return annotations;
}

async function getLanguages() {
  const languages = await cache.writeJSON(
    null,
    `lang.json`,
    {provider: 'microsoft'},
    async () => {
      const res = await fetch(languagesAPI);
      if (!res.ok) {
        throw await requestError('failed to fetch available languages', res);
      }
      return res.json();
    }
  );
  return new Map(Object.entries(languages.translation).sort((a, b) => (a[1].name > b[1].name) ? 1 : (a[1].name < b[1].name) ? -1 : 0));
}

module.exports = {translate, getLanguages, joinLines};
