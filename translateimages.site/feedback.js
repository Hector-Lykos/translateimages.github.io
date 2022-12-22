const log = require('./log').logger('feedback', {awaitSuccess: true});
const html = require('./html');
const throttle = require('./throttle');

const maxLength = 10000;

const templates = html.makeTemplates({
  form: `
    <!doctype html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width">
      <title>Feedback</title>
      <link href="common.css" rel="stylesheet">
      <link href="static.css" rel="stylesheet">
    </head><body>
      <%= navbar %>
      <form action="feedbackposted" method="POST">
        <h1>Feedback</h1>
        <label>
          <div>If you can have any problems or suggestions, type them here and I&#39;ll look into them.</div>
          <textarea name="message" maxlength="<%- maxLength %>"></textarea>
        </label>
        <%= submit %>
      </form>
    </body></html>
  `,
  submit: `<input type="submit">`,
  cooldown: `<p class="cooldown"><%- issue %></p>`,
  response: `
    <!doctype html><head>
      <meta charset="UTF-8">
      <title>Feedback Submitted</title>
      <link href="common.css" rel="stylesheet">
      <link href="static.css" rel="stylesheet">
    </head><body>
      <%= navbar %>
      <main>
        <h1>Feedback Submitted</h1>
        <p>Thank you for your input.</p>
      </main>
    </body></html>
  `
});

function feedback(user) {
  const issue = throttle.overCost('feedback', user);
  const submit = issue ? templates.cooldown({issue}) : templates.submit();
  const form = templates.form({navbar: html.navbar, submit, maxLength});
  return form;
}

async function submit(data, user) {
  throttle.addCost('feedback', user, 1);
  await log(data);
  const responseHTML = templates.response({navbar: html.navbar});
  return responseHTML;
}

module.exports = {maxLength, feedback, submit};
