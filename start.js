/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const express = require('express')
const Logger = require('filelogger');
const bodyParser = require('body-parser').json();
const rp = require('request-promise');
const nconf = require('nconf');
const validator = require('validator');

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

// Read the configuration file for pocket info.
nconf.file({ file: './config/config.json' });
nconf.load();
consumer_key = nconf.get('pocketconsumerkey');  // identity of foxy ext
access_token = nconf.get('access_token');       // user's oauth token
userid = nconf.get('userid');                   // userid

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
  logger.log('debug', 'cmd is:' + command);
  if (command == 'POCKET') {
    logger.log('debug', 'command is POCKET');
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

    if (chunk.length != 4) {
      tempBytesCount += chunk.length - 4;
      inputChunks.push(Buffer.from(
        bufLength.slice(5, chunk.length - 1)).toString());
      // figure out if this is the rest of the buffer or if more to come
      if (bytesToRead + 4 == chunk.length) {
        pocketHelper(inputChunks.toString());
      }
    }
  } else {
    tempBytesCount += chunk.length;
    inputChunks.push(chunk);
    if(tempBytesCount == bytesToRead) {
      var stringurl = inputChunks.toString();
      pocketHelper(stringurl);
    }
    logger.log('debug', chunk);
  }
});

function pocketHelper(stringurl) {
  var newStringUrl = stringurl.replace(/['"]+/g, '');
  inputChunks = [];
  tempBytesCount = 0;
  bytesToRead = 0;
  addPocket(newStringUrl);
}

function addPocket(url) {
  logger.log('debug', 'url is: ' + url);
  if (!validator.isURL(url)) {
    logger.log('debug', 'Malformed URL');
    return;
  }

  var addBody = {
    'url': url,
    'consumer_key': consumer_key,
    'access_token': access_token
  };
  addOptions.body = JSON.stringify(addBody);
  rp(addOptions)
    .then(function() {
      logger.log('debug', 'pocket add success');
    })
    .catch(function(err) {
      logger.log('debug', 'Failed to add to pocket');
      logger.log('error', err);
    });
}

/*
 * This is called 1) When the extension is unloaded from the sidebar and
 * 2) when the user removes or reloads it as a temporary extension.
 */
stdin.on('end', function () {
  logger.log('debug', 'got end');
  console.log('GOT AN END');
  inputChunks = [];
  tempBytesCount = 0;
  bytesToRead = 0;
  gracefulShutdown();
});

stdin.on('error', function(err) {
  console.error(err);
});

//
// Pocket Auth Flows
//
app.get('/pocket', function(req, res) {
  var oauthBody = {'consumer_key':consumer_key,
     'redirect_uri': 'http://127.0.0.1:3000/redirecturi'
   };
  oathRequestOptions.body = JSON.stringify(oauthBody);
  rp(oathRequestOptions)
    .then(function(body) {
      let jsonBody = JSON.parse(body);
      logger.log('debug', 'Code is:' + jsonBody.code);
      user_key = jsonBody.code;

      var redir = 'https://getpocket.com/auth/authorize?request_token=' +
      user_key + '&redirect_uri=http://127.0.0.1:3000/redirecturi';
      // console.log(redir);

      return res.redirect(redir);
    });
});

app.get('/redirecturi', function(req, res) {
  logger.log('debug', 'calling redirect');

  var authBody = {
    'consumer_key':consumer_key,
    'code':user_key
  };
  finalAuthorizeOptions.body = JSON.stringify(authBody);
  logger.log('debug', 'calling redirect');
  
  rp(finalAuthorizeOptions)
    .then(function(body) {
      let jsonBody = JSON.parse(body);
      access_token = jsonBody.access_token;
      userid = jsonBody.username;
      // Save to the config so they don't need to redo this.
      nconf.set('access_token', access_token);
      nconf.set('userid', userid);
      nconf.save();
    })
    .catch(function(err) {
      logger.log('debug','Call failed' + err);
    });
    res.status(200).send('OK');
});

var server = app.listen(3000, function () {
  logger.log('debug', 'initializing startup shim');
});

// this function is called when you want the server to die gracefully
// i.e. wait for existing connections
var gracefulShutdown = function() {
  console.log('Received kill signal, shutting down gracefully.');
  server.close(function() {
    console.log('Closed out remaining connections.');
    process.exit()
  });
  
   // if after ten seconds, it's not closing, shut down.
   setTimeout(function() {
       console.error('Could not close connections in time, shutting down');
       process.exit()
  }, 10*1000);
}
