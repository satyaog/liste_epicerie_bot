const express = require('express');
const packageInfo = require('./package.json');

const app = express();

function createExpressCallback (webHookCallback)
{
  return (request, response) =>
  {
    webHookCallback(request, response);
  };
};

app.get('/', (request, response) =>
  {
    response.json({ version: packageInfo.version });
  });

var server = app.listen(process.env.PORT, "0.0.0.0", () =>
  {
    const host = server.address().address;
    const port = server.address().port;
    console.log('Web server started at http://%s:%s', host, port);
  });

module.exports = (telegraf) =>
{
  let webHookCallback = telegraf.webhookCallback(`/${telegraf.token}`);
  app.post(`/${telegraf.token}`, createExpressCallback(webHookCallback));
};
