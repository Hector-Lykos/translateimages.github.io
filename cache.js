const fsPromises = require('fs').promises;
const crypto = require('crypto');

const outputPath = './cache';
const saltLength = 32;
const ivLength = 16;
const hashAlgorithm = 'sha512-256';
const encryptionAlgorithm = 'aes-256-ctr';

let salts;

async function getSalts() {
  if (salts) return salts;
  salts = (async() => {
    let results = {};
    await Promise.all(['storage', 'encryption'].map(async usage => {
      const filename = `../keys/${usage}.salt`;
      let salt;
      try {
        salt = await fsPromises.readFile(filename);
      } catch(err) {
        if (err.code !== 'ENOENT') throw err;
        salt = crypto.randomBytes(saltLength);
        await fsPromises.writeFile(filename, salt);
      }
      results[usage] = salt;
    }));
    return results;
  })();
  return salts;
}

async function getKeys(data) {
  const salts = await getSalts();
  const keys = {};
  for (let usage in salts) {
    const hmac = crypto.createHmac(hashAlgorithm, salts[usage]);
    hmac.update(data);
    keys[usage] = hmac.digest('hex');
  }
  return keys;
}

function decrypt(contents, key) {
  key = Buffer.from(key, 'hex');
  const iv = contents.slice(0, ivLength);
  contents = contents.slice(ivLength);
  const decipher = crypto.createDecipheriv(encryptionAlgorithm, key, iv);
  contents = decipher.update(contents);
  contents = Buffer.concat([contents, decipher.final()]);
  return contents;
}

function encrypt(contents, key) {
  key = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createDecipheriv(encryptionAlgorithm, key, iv);
  contents = cipher.update(contents);
  contents = Buffer.concat([contents, cipher.final()]);
  contents = Buffer.concat([iv, contents]);
  return contents;
}

const writers = new Map();

async function writeJSON(keys, suffix, inputData, makeContents) {
  if (!keys) keys = {storage: '_'};
  const filename = `${keys.storage}.${suffix}`;
  let writer = writers.get(filename);
  if (writer) return writer;
  writer = (async () => {
    const fullname = `${outputPath}/${filename}`;
    let contents;
    try {
      contents = await fsPromises.readFile(fullname);
      if (keys.encryption) contents = decrypt(contents, keys.encryption);
      contents = JSON.parse(contents.toString('utf8'));
      if (JSON.stringify(contents.i) === JSON.stringify(inputData)) {
        return contents.o;
      }
    } catch(err) {
      if (err.code !== 'ENOENT') console.error(err);
    }
    contents = await makeContents();
    // dispatch write job without awaiting
    (async() => {
      let contents2 = {i: inputData, o: contents};
      contents2 = Buffer.from(JSON.stringify(contents2), 'utf8');
      if (keys.encryption) contents2 = encrypt(contents2, keys.encryption);
      await fsPromises.mkdir(outputPath, {recursive: true});
      fsPromises.writeFile(fullname, contents2);
    })().finally(() => {
      writers.delete(filename);
    });
    return contents;
  })();
  writers.set(filename, writer);
  return writer;
}

module.exports = {getKeys, writeJSON};
