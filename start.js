/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var childProcess = require('child_process');
const express = require('express')
const fs = require('fs');
const Logger = require('filelogger');
const bodyParser = require('body-parser').json();


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
  logger.log('debug', 'param is:' + param);
  var len = new Buffer(4);
  var buf = new Buffer(JSON.stringify(req.body));

  len.writeUInt32LE(buf.length, 0);
  process.stdout.write(len);
  process.stdout.write(buf);
  res.status(200).send('OK');
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
