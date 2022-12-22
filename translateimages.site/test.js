const fsPromises = require('fs').promises;
const translate = require('./translate');
const index = require('./index');
const results = require('./results');

const samplePath = '../sample';
const staticPath = 'static';
const outputPath = 'test';

const srcLang = (process.argv[2] || 'auto');
const destLang = (process.argv[3] || 'en');
const filenamesManual = process.argv.slice(4);

async function parallel(tasks) {
  return Promise.all(tasks.map(task =>
    task.catch(console.error)
  ));
}

async function writeIndex() {
  const {html} = await index.index({user: {ip: 'bypass'}});
  return fsPromises.writeFile(`${outputPath}/index.html`, html);
}

async function handleFile(filename) {
  const imageData = await fsPromises.readFile(filename);
  const languages = await translate.getLanguages();
  const {html, keys} = await results.results({imageData, srcLang, destLang, languages, user: {ip: 'bypass'}});
  return parallel([
    fsPromises.writeFile(`${outputPath}/${keys.storage}.${srcLang}.${destLang}.html`, html),
    fsPromises.writeFile(`${outputPath}/${keys.storage}.key`, keys.encryption)
  ]);
}

async function writeHTML() {
  let filenames;
  if (filenamesManual.length) {
    filenames = filenamesManual;
  } else {
    filenames = await fsPromises.readdir(samplePath);
    filenames = filenames.map(f => `${samplePath}/${f}`);
  }
  return parallel(filenames.map(handleFile));
}

async function makeLinks() {
  const filenames = await fsPromises.readdir(staticPath);
  return parallel(filenames.map(async f => {
    try {
      await fsPromises.symlink(`../${staticPath}/${f}`, `${outputPath}/${f}`);
    } catch(err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }));
}

async function test() {
  await fsPromises.mkdir(outputPath, {recursive: true});
  return parallel([
    writeIndex(),
    writeHTML(),
    makeLinks()
  ]);
}

test();
