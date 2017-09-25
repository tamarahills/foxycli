/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var childProcess = require('child_process');
const express = require('express')
const fs = require('fs');
const Logger = require('filelogger');
const bodyParser = require('body-parser').json();
const rp = require('request-promise');
var consumer_key, user_key, access_token, userid;

const oathRequestOptions = {
  uri: 'https://getpocket.com/v3/oauth/request',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

const finalAuthorizeOptions = {
  uri: 'https://getpocket.com/v3/oauth/authorize',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

const addOptions = {
  uri: 'https://getpocket.com/v3/add',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};


// consumer_key = 'XXXXXXXXXXXXXXXXXXXXXXXKXXXXXXX';


const app = express();
var logger = new Logger('debug', 'error', 'shim.log');

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.get('/start', function (req, res) {
  res.send('Hello World!')
});

app.post('/command', bodyParser, function(req, res) {
  logger.log('debug', 'Got a command:' + JSON.stringify(req.body));
  var command = req.body.cmd;
  var param = req.body.param;
  logger.log('debug', 'cmd is:' + command);
  if (command == 'POCKET') {
    req.body.param = userid;
    req.body.param2 = access_token;
    req.body.param3 = consumer_key;
  }
  var len = new Buffer(4);
  var buf = new Buffer(JSON.stringify(req.body));

  len.writeUInt32LE(buf.length, 0);
  process.stdout.write(len);
  process.stdout.write(buf);
  res.status(200).send('OK');
});

var stdin = process.stdin,
  inputChunks = [],
  bytesToRead = 0,
  tempBytesCount = 0;

stdin.setEncoding('utf8');

stdin.on('data', function (chunk) {
  logger.log('debug', 'got data');
  if (bytesToRead == 0) {
    const bufLength = Buffer.from(chunk);
    bytesToRead = bufLength.readUInt32LE(0);
    logger.log('debug', 'bytes to read is:' + bytesToRead);
  } else {
    tempBytesCount += chunk.length;
    inputChunks.push(chunk);
    if(tempBytesCount == bytesToRead) {
      var stringurl = inputChunks.toString();
      var newStringUrl = stringurl.replace(/['"]+/g, '');
      logger.log('debug', 'stringurl:' +stringurl);
      logger.log('debug', 'newstring:' +newStringUrl);
      addPocket(newStringUrl);
      inputChunks = [];
      tempBytesCount = 0;
      bytesToRead = 0;
    }
    logger.log('debug', chunk);
  }

});

function addPocket(url) {
  logger.log('debug', 'calling addPocket');
  var addBody = {
    "url": url,
    "consumer_key": consumer_key,
    "access_token": 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXX'
  };
  addOptions.body = JSON.stringify(addBody);
  rp(addOptions)
    .then(function(body) {
      logger.log('success');
      let jsonBody = JSON.parse(body);
    })
    .catch(function(err) {
      logger.log('Failed to add to pocket');
      logger.log('error', err);
    });
}

stdin.on('end', function () {
  logger.log('debug', 'got end');

  inputChunks = [];
  tempBytesCount = 0;
  bytesToRead = 0;
});

//
// Pocket Auth Flows
//
app.get('/pocket', function(req, res) {
  var oauthBody = {"consumer_key":consumer_key,
     "redirect_uri": "http://127.0.0.1:3000/redirecturi"
   };
  oathRequestOptions.body = JSON.stringify(oauthBody);
  rp(oathRequestOptions)
    .then(function(body) {
      let jsonBody = JSON.parse(body);
      console.log('Code is:' + jsonBody.code);
      user_key = jsonBody.code;

      var redir = 'https://getpocket.com/auth/authorize?request_token=' +
      user_key + '&redirect_uri=http://127.0.0.1:3000/redirecturi';
      console.log(redir);

      return res.redirect(redir);
    });
});

app.get('/redirecturi', function(req, res) {
  console.log('redirecturi');
  console.log(req.body);

  var authBody = {
    "consumer_key":consumer_key,
    "code":user_key
  };
  finalAuthorizeOptions.body = JSON.stringify(authBody);

  rp(finalAuthorizeOptions)
    .then(function(body) {
      console.log(body);
      let jsonBody = JSON.parse(body);
      access_token = jsonBody.access_token;
      userid = jsonBody.username;
    });
});

app.listen(3000, function () {
  logger.log('debug', 'initializing startup shim');
  var environment = process.env;
  environment.PATH = '/opt/local/bin:/opt/local/sbin:/Users/mozilla/.gvm/bin:/Users/mozilla/.cargo/bin:“/Volumes/development/openwrt/staging_dir/host/bin:/usr/local/bin:/usr/local/bin/python:/usr/local/opt/coreutils/libexec/gnubin:/Applications/adt-bundle-mac-x86_64-20140321/sdk/platform-tools:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin”';
  childProcess.exec('"/Users/mozilla/.nvm/versions/node/v7.7.2/bin/node" ./index.js', environment,
    function(error, stdout, stderr) {
      if(error) {
        console.error('exec error:' + error);
        fs.writeFile("./index.log", "Exec error:" + error, function(err) {
        });
      }
    });
});
