const fs = require('fs');
const fsPromises = fs.promises;

const logPath = './log';

fs.mkdirSync(logPath, {recursive: true});

function logger(filename, options={}) {
  let {timeResolution, awaitSuccess} = options;
  let buffer = '';
  let handle;
  let writer;

  async function write(data) {
    let time = Date.now();
    if (timeResolution) {
      time = Math.floor(time / timeResolution) * timeResolution;
    }
    data.time = time;
    data = JSON.stringify(data) + '\n';
    buffer += data;
    if (writer) return writer;
    writer = (async() => {
      if (!handle) {
        handle = await fsPromises.open(`${logPath}/${filename}`, 'a');
      }
      try {
        while(buffer) {
          let b = buffer;
          buffer = '';
          await handle.appendFile(b);
        }
      } catch(err) {
        await handle.close().catch(console.error);
        handle = undefined;
      }
    })().finally(() => {
      writer = undefined;
    });
    return writer;
  }

  function log(data) {
    // dispatch write job without awaiting
    write(data).catch(console.error);
  }

  return (awaitSuccess ? write : log);
}

module.exports = {logger};
