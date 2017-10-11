/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';
const rp = require('request-promise');

var client_id = '650a8224cfe949e1882dd2120e453557'; // Your client id
var client_secret = '59c40781781a480885da1899bf55e9f7'; // Your secret

var spotifyTokenOptions = {
  uri: 'https://accounts.spotify.com/api/token',
  method: 'POST',
  form: {
    grant_type: 'client_credentials'
  },
  headers: {
    'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret)
      .toString('base64'))
  }
};

function SpotifyConn() {
}

function getToken() {
  console.log('Calling getToken');
  rp(spotifyTokenOptions)
    .then(function(body) {
      console.log('reached a response');
      const resBody = body && body.toString('utf8');
      var jsonResults = JSON.parse(resBody);
      console.log('access_token is:' + jsonResults.access_token);
      SpotifyConn.apiToken = jsonResults.access_token;
    })
    .catch(function(err) {
      console.log('Call failed' + err);
    });
}

SpotifyConn.apiToken = getToken();

module.exports = SpotifyConn;
