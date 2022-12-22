class Translator {
  constructor(details) {
    for (let key in details) {
      this[key] = details[key];
    }
  }

  convert(code) {
    if (this.absent.has(code)) code = 'auto';
    code = (this.substitutions.get(code) || code);
    return code;
  }

  link({srcLang, destLang, text}) {
    srcLang = this.convert(srcLang);
    srcLang = (this.srcSubstitutions.get(srcLang) || srcLang);
    destLang = this.convert(destLang);
    const p = [srcLang, destLang, text].map(encodeURIComponent);
    const url = this.urlFromParams(p);
    return url;
  }
}

const translators = new Map([
  ['microsoft', new Translator({
    name: 'Microsoft Translator',
    urlFromParams: (p) => `https://www.bing.com/translator?from=${p[0]}&to=${p[1]}&text=${p[2]}`,
    windowSize: 'height=500,width=800',
    absent: new Set([]),
    substitutions: new Map([]),
    srcSubstitutions: new Map([
      ['auto', '']
    ])
  })],
  ['google', new Translator({
    name: 'Google Translate',
    urlFromParams: (p) => `https://translate.google.com/#${p.join('|')}`,
    windowSize: 'height=500,width=500',
    absent: new Set(['fj', 'otq', 'tlh', 'to', 'ty', 'yua']),
    substitutions: new Map([
      ['fil', 'tl'],
      ['he', 'iw'],
      ['mww', 'hmn'],
      ['nb', 'no'],
      ['sr-Cyrl', 'sr'],
      ['sr-Latn', 'sr'],
      ['yue', 'zh-TW'],
      ['zh-Hans', 'zh-CN'],
      ['zh-Hant', 'zh-TW']
    ]),
    srcSubstitutions: new Map([
      ['zh-TW', 'zh-CN']
    ])
  })]
]);

module.exports = {translators};
