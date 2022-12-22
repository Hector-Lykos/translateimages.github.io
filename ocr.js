const fs = require('fs');
const vision = require('@google-cloud/vision');
const cache = require('./cache');
const throttle = require('./throttle');
const {translators} = require('./translators');

const supportedLanguages = new Set(
  fs.readFileSync('./ocr-supported.txt', {encoding: 'utf8'}).trim().split('\n')
);

const client = new vision.ImageAnnotatorClient({
  keyFilename: '../keys/google_application_credentials.json'
});

class NoResultsError extends Error {}

async function ocr({keys, imageData, srcLang, user}) {
  let lang2;
  if (!supportedLanguages.has(srcLang)) {
    if (supportedLanguages.has(
      lang2 = srcLang.split('-')[0]
    )) {
      srcLang = lang2;
    } else if (supportedLanguages.has(
      lang2 = translators.get('google').convert(srcLang)
    )) {
      srcLang = lang2;
    } else {
      srcLang = 'auto';
    }
  }
  let annotations;
  try {
    annotations = await cache.writeJSON(
      keys,
      `o.${srcLang}.json`,
      null,
      async () => {
        throttle.addCost('cloud', user, 1.5);
        const languageHints = (srcLang === 'auto') ? undefined : [srcLang];
        const result = await client.documentTextDetection({
          image: {content: imageData},
          imageContext: {languageHints}
        });
        if (!result[0].fullTextAnnotation) throw new NoResultsError();
        return result;
      }
    );
  } catch(err) {
    if (err instanceof NoResultsError) {
      return [];
    } else {
      throw err;
    }
  }
  return processParagraphs(annotations);
}

const breaksAsText = new Map([
  ['UNKNOWN', ''],
  ['SPACE', ' '],
  ['SURE_SPACE', ' '],
  ['EOL_SURE_SPACE', '\n'],
  ['HYPHEN', '\n'],
  ['LINE_BREAK', '\n']
]);

function addBreak(text, property) {
  if (!property || !property.detectedBreak) return text;
  const {type, isPrefix} = property.detectedBreak;
  const breakText = (breaksAsText.get(type) || '');
  return isPrefix ? (breakText + text) : (text + breakText);
}

function extractText(paragraph) {
  return (paragraph.words || []).map(w =>
    addBreak(
      (w.symbols || []).map(s => addBreak(s.text, s.property)).join(''),
      w.property
    )
  ).join('').trim();
}

function extractParagraphs(annotations) {
  const paragraphs = [];
  ((annotations.fullTextAnnotation || {}).pages || []).forEach(page => {
    (page.blocks || []).forEach(b => {
      (b.paragraphs || []).forEach(p => {
        paragraphs.push(p);
      });
    });
  });
  return paragraphs;
}

function validateBox(obj) {
  return !!(obj.boundingBox && obj.boundingBox.vertices && obj.boundingBox.vertices.length);
}

function processParagraphs(annotations) {
  return (
    extractParagraphs(annotations[0])
      .filter(validateBox)
      .map(p => ({text: extractText(p), vertices: p.boundingBox.vertices}))
  );
}

module.exports = {ocr};
