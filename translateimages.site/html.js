const _ = require('lodash');

const navbar = trim(`
  <nav id="topnav">
    <a href=".">Home</a>
    <a href="tools">Tools</a>
    <a href="privacy">Privacy</a>
    <a href="feedback">Feedback</a>
  </nav>
`);

function trim(text) {
  return text.replace(/\n\s*/g, '');
}

function makeTemplates(obj) {
  for (let key in obj) {
    obj[key] = _.template(trim(obj[key]));
  }
  return obj;
}

function escapeBR(text) {
  return _.escape(text).replace(/\n/g, '<br>');
}

module.exports = {navbar, trim, makeTemplates, escapeBR};
