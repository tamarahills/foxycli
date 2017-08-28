/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
const fs = require('fs');
const rp = require('request-promise');
const Logger = require('filelogger');
const robot = require('robotjs');
var SpotifyConn= require('./spotify');

var logger = new Logger('debug', 'error', 'foxy.log');

var spotify = new SpotifyConn();


function Parser() {}

const FOXY_COMMANDS = {
  'NONE': 'NONE',
  'NEXTSLIDE': 'NEXTSLIDE',
  'PREVIOUSSLIDE': 'PREVIOUSSLIDE',
  'SHUTUP': 'SHUTUP',
  'WEATHER': 'WEATHER',
  'BOOKMARK': 'BOOKMARK',
  'TIMER': 'TIMER',
  'SPOTIFY': 'SPOTIFY',
  'IOT': 'IOT'
};

const CITY_NAMES = {
  'NEWYORK': 'NEW YORK',
  'LA': 'LOS ANGELES',
  'CHICAGO': 'CHICAGO',
  'HOUSTON': 'HOUSTON',
  'PARIS': 'PARIS',
  'SANFRANCISCO': 'SAN FRANCISCO'
};

const asrOptions = {
  uri: 'http://52.53.97.165/asr',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/octet-stream'},
  qs: {'endofspeech': 'false', 'nbest': 10}
};

const aiOptions = {
  uri: 'https://api.api.ai/api/query',
  method: 'POST',
  body: '',
  headers: {
    'Authorization': 'Bearer af2bccd942c24fd68622efc6b4c8526c',
    'Content-Type': 'application/json'
  }
};

const shimOptions = {
  uri: 'http://localhost:3000/command',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json'}
};

Parser.prototype.parseResults = function(foxyBuffer, callback) {
  asrOptions.body = foxyBuffer;

  // Send the speech buffer to Kaldi
  rp(asrOptions)
    .then(function(body) {
      const resBody = body && body.toString('utf8');
      console.log('Body is: ' + resBody);
      var jsonResults = JSON.parse(resBody);
      console.log('status is:' + jsonResults.status);
      if (jsonResults.status != 'ok') {
        console.log('error.  Could not understand speech');
      } else {
        console.log('result ok');
      }
      // Get results from Kaldi Speech rec. Format for Api.ai
      aiOptions.body = JSON.stringify(getAiBody(jsonResults));
      // chain to API.ai
      return rp(aiOptions);
    })
    .then(function(aiBody) {
      var payload = parseAIBody(aiBody);
      if(payload.cmd == FOXY_COMMANDS.SPOTIFY) {
        console.log('Spotify cmd');
        let playlistBrowseUri = 'https://api.spotify.com/v1/browse/categories/'
          + payload.param + '/playlists';
        console.log('playlist browse URI: '+ playlistBrowseUri);
        var spotifyCategoryPlaylistOptions = {
          uri: playlistBrowseUri,
          method: 'GET',
          headers: {'Authorization': 'Bearer ' + SpotifyConn.apiToken}
        };
        rp(spotifyCategoryPlaylistOptions)
          .then(function(body) {
            console.log('Got the spotify response');
            payload.param = parseSpotify(body);
            shimOptions.body = JSON.stringify(payload);
            return rp(shimOptions);
          })
          .catch(function(err) {
            callback('Spotify error');
            console.log('Call failed' + err);
          });
      } else if (payload.cmd == FOXY_COMMANDS.IOT) {
        console.log('iot');
        let iotUri = 'https://10.19.2.243:4443/things/zwave-efbddb01-4/properties/on';
        var iotOptions = {
          uri: iotUri,
          method: 'PUT',
          rejectUnauthorized: false,
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjJiYzcxNWM1LTk3OTktNGM1OS1hMGRlLTEwNjQ1OTBjYTMwNyJ9.eyJpYXQiOjE1MDI3NDYyNTh9.X-T90f8wFv_aErWq-_8vQcyeMTzA2XFwAV-SdfDxbw-7b43AuXj7DCwFL7F5RgzzlVcTIe5KRobq5C4ld51BLA',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: ''
        };
        (payload.param2 == 'on')?
          iotOptions.body = JSON.stringify({"on": true}):
          iotOptions.body = JSON.stringify({"on": false});

        rp(iotOptions)
          .then(function(body) {
            console.log('Got the iot response: ' + JSON.stringify(shimOptions));
            shimOptions.body = JSON.stringify(payload);
            return rp(shimOptions);
          })
          .catch(function(err) {
            callback('iot error');
            console.log('Call failed' + err);
          });
        }
      else {
        console.log('before calling rp on shim');
        shimOptions.body = JSON.stringify(payload);
        return rp(shimOptions);
      }
    })
    .then(function(shimBody) {
       callback('ok');
       console.log('finished the chain');
    })
    .catch(function(err) {
      callback('error');
      console.log('Call failed' + err);
    });
}

function parseSpotify(body) {
  const resBody = body && body.toString('utf8');
  console.log('GOT DATA FROM SPOTIFY');
  var jsonResults = JSON.parse(resBody);
  let plArray = jsonResults.playlists.items;
  var playlistId = '';
  for(var i = 0; i < plArray.length; i++) {
    var obj = plArray[i];
    if (obj.type == 'playlist') {
      console.log('Found a playlist: ' + obj.id);
      playlistId = obj.id;
      break;
    }
  }
  return playlistId;
}

function parseAIBody(aiBody) {
  let jsonBody = JSON.parse(aiBody);
  var payload = {
    cmd: 'none',
    param: 'none',
    param2: 'none'
  };
  console.log(aiBody);
  //Determine the action from the API.AI intent parser
  switch (jsonBody.result.action) {
    case 'weather':
      console.log('weather is action');
      payload.cmd = FOXY_COMMANDS.WEATHER;
      payload.param = parseWeather(jsonBody.result);
      break;
    case 'timer':
      console.log('timer is action');
      payload.cmd = FOXY_COMMANDS.TIMER;
      payload.param = parseTimer(jsonBody.result);
      payload.param2 = jsonBody.result.parameters.any;
      console.log('timer is:' + payload.param + '. Name is: ' + payload.param2);
      break;
    case 'play':
      console.log('play is action');
      console.log('genre is: ' + jsonBody.result.parameters['music-genre']);
      payload.cmd = FOXY_COMMANDS.SPOTIFY;
      payload.param = jsonBody.result.parameters['music-genre'];
      break;
    case 'iot':
      console.log('iot is action');
      payload.cmd = FOXY_COMMANDS.IOT;
      payload.param = jsonBody.result.parameters.rooms;
      payload.param2 = jsonBody.result.parameters.onoff;
      console.log('room is: ' + payload.param);
      break;
    case 'nextslide':
      console.log('nextslide is action');
      robot.keyTap("right");
      break;
    case 'lastslide':
      console.log('nextslide is action');
      robot.keyTap("left");
      break;
    default:
      console.log('No match');
      break;
  }
  return payload;
}

function getAiBody(asrBody) {
  let conf = 0;
  let body = {
    "v":"20150910",
    "query": '',
    "lang":"en",
    "sessionId":"62c6454e-e3c3-40fb-a25a-d582e0b78191",
    "timezone":"2017-07-24T10:45:52-0400"
  };
  let text = '';
  for (var i in asrBody.data) {
    if (asrBody.data[i].confidence > conf) {
      conf = asrBody.data[i].confidence;
      text = asrBody.data[i].text;
    }
  }
  body.query = text;
  console.log(body);
  return body;
}

function parseTimer(result) {
  logger.log('debug', 'Entering parseTimer');
  var durationSecs = 0;
  if (!result.parameters.duration) {
    return durationSecs;
  }

  switch (result.parameters.duration.unit) {
    case 'min':
      durationSecs = result.parameters.duration.amount * 60;
      break;
    case 's':
      durationSecs = result.parameters.duration.amount;
      break;
    case 'h':
      durationSecs = result.parameters.duration.amount * 3600;
      break;
    case 'day':
      durationSecs = result.parameters.duration.amount * 86400;
      break;
    default:
      break;
  }

  return durationSecs;
}

function parseWeather(result) {
  console.log('Calling parseWeather');
  var weatherUrl = 'https://www.yahoo.com/news/weather/';
  if (!result.parameters['geo-city']) {
    return weatherUrl;
  }
  console.log('Before switch:' + result.parameters['geo-city'].toUpperCase());

  switch (result.parameters['geo-city'].toUpperCase()) {
    case 'NEW YORK':
      logger.log('debug','city is : NEW YORK');
      weatherUrl = 'https://www.yahoo.com/news/weather/united-states/new-york/new-york-2459115';
      break;
    case 'LOS ANGELES':
      logger.log('debug','city is : LA');
      weatherUrl = 'https://www.yahoo.com/news/weather/united-states/california/los-angeles-2442047'
      break;
    case 'CHICAGO':
    logger.log('debug','city is : CHICAGO');
      weatherUrl = 'https://www.yahoo.com/news/weather/united-states/illinois/chicago-2379574';
      break;
    case 'HOUSTON':
      logger.log('debug','city is : HOUSTON');
      weatherUrl = 'https://www.yahoo.com/news/weather/united-states/texas/houston-2424766';
      break;
    case 'PARIS':
      logger.log('debug','city is : PARIS');
      weatherUrl = 'https://www.yahoo.com/news/weather/france/%C3%AEle-de-france/paris-615702';
      break;
    case 'SAN FRANCISCO':
      logger.log('debug','city is : SAN FRANCISCO');
      weatherUrl = 'https://www.yahoo.com/news/weather/united-states/california/san-francisco-2487956';
      break;
    default:
      logger.log('debug', 'sending default city since no match');
      break;
  }
  console.log('returning weather url:' + weatherUrl);
  return weatherUrl;
}

module.exports = {
  Parser:Parser,
  FOXY_COMMANDS: FOXY_COMMANDS
};
