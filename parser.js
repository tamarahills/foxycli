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
  'IOT': 'IOT',
  'POCKET': 'POCKET',
  'NPR': 'NPR'
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
const weatherLink = 'http://api.openweathermap.org/data/2.5/weather?' +
  'APPID=aa9502b21136daabe9a2d556938ccfbe&units=imperial&q='
const weatherOptions = {
  uri: '',
  method: 'GET',
  body: '',
  headers: {
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
  var utterance = '';

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
      var speechBody = getAiBody(jsonResults);
      utterance = speechBody.query;
      aiOptions.body = JSON.stringify(speechBody);

      // chain to API.ai
      return rp(aiOptions);
    })
    .then(function(aiBody) {
      var payload = parseAIBody(aiBody);
      payload.utterance = utterance;
      if(payload.cmd == FOXY_COMMANDS.SPOTIFY) {
        console.log('Spotify cmd');
        let playlistBrowseUri = 'https://api.spotify.com/v1/browse/categories/'
          + payload.param + '/playlists';
        var spotifyCategoryPlaylistOptions = {
          uri: playlistBrowseUri,
          method: 'GET',
          headers: {'Authorization': 'Bearer ' + SpotifyConn.apiToken}
        };
        rp(spotifyCategoryPlaylistOptions)
          .then(function(body) {
            console.log('Got the spotify response');
            payload.param = parseSpotify(body);
            payload.utterance = cleanSpeech(payload);
            shimOptions.body = JSON.stringify(payload);
            return rp(shimOptions);
          })
          .catch(function(err) {
            callback('Spotify error');
            console.log('Call failed' + err);
          });
      } else if (payload.cmd == FOXY_COMMANDS.IOT) {
        console.log('iot');
        let iotUri = 'https://localhost:4443/things/zwave-efbddb01-4/properties/on';
        var iotOptions = {
          uri: iotUri,
          method: 'PUT',
          rejectUnauthorized: false,
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjM2NDNkNjdmLTQ1MzctNGEzMS04NmIxLTgyMDk0ZGI0ODU5NCJ9.eyJpYXQiOjE1MDU5MjE3NzV9.C6wKLoieTsR7ZzOqYopKPDXntxYvxY5emb4nKFqXbdE0fL1D8c2DTiRJOF2i4udTrQpIdks20q_TTDLoB-uZZA',
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
            payload.utterance = cleanSpeech(payload);
            shimOptions.body = JSON.stringify(payload);
            return rp(shimOptions);
          })
          .catch(function(err) {
            callback('iot error');
            console.log('Call failed' + err);
          });
      } else if (payload.cmd == FOXY_COMMANDS.WEATHER) {
        console.log('weather');
        weatherOptions.uri = weatherLink + payload.param;
        console.log('WEATHER URI: ' + weatherOptions.uri);

        rp(weatherOptions)
          .then(function(body) {
            console.log('Got the weather response: ');
            console.log('Body is: ' + body);
            var jsonResults = JSON.parse(body);
            console.log('weather is:' + jsonResults.weather);
            payload.param = jsonResults.name;             //City name
            payload.param2 = jsonResults.main.temp;       //Current temp
            payload.param3 = jsonResults.main.temp_min;   //Min temp
            payload.param4 = jsonResults.main.temp_max;   //Max temp
            payload.param5 = jsonResults.weather[0].main; //Description
            payload.utterance = cleanSpeech(payload);
            console.log(payload);

            shimOptions.body = JSON.stringify(payload);
            return rp(shimOptions);
          })
          .catch(function(err) {
            callback('weather error');
            console.log('Call failed' + err);
          });
      } else if(payload.cmd == FOXY_COMMANDS.NEXTSLIDE || payload.cmd == FOXY_COMMANDS.PREVIOUSSLIDE) {
        callback('ok');
      } else {
        console.log('before calling rp on shim');
        console.log('command is:' + payload.cmd);
        payload.utterance = cleanSpeech(payload);
        shimOptions.body = JSON.stringify(payload);
        if(payload.cmd != FOXY_COMMANDS.NEXTSLIDE || payload.cmd != FOXY_COMMANDS.PREVIOUSSLIDE) {
          return rp(shimOptions);
        }
      }
    })
    .then(function(shimBody) {
       callback('ok');
       logger.log('debug','finished the chain');
    })
    .catch(function(err) {
      callback('error');
      logger.log('debug','Call failed' + err);
    });
}

function parseSpotify(body) {
  const resBody = body && body.toString('utf8');
  logger.log('debug','GOT DATA FROM SPOTIFY');
  var jsonResults = JSON.parse(resBody);
  let plArray = jsonResults.playlists.items;
  var playlistId = '';
  for(var i = 0; i < plArray.length; i++) {
    var obj = plArray[i];
    if (obj.type == 'playlist') {
      logger.log('debug','Found a playlist: ' + obj.id);
      playlistId = obj.id;
      break;
    }
  }
  return playlistId;
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

function cleanSpeech(payload) {
  var lower = payload.utterance.toLowerCase();
  var final;
  switch (payload.cmd) {
    case FOXY_COMMANDS.WEATHER:
      final = '\"What\'s the weather in ' +
        payload.param + '?\"';
      break;
    // TODO: add next slide
    default:
      final = '\"' + lower.capitalize() + '.\"';
      console.log(final);
      break;
  }
  return final;
}

function parseAIBody(aiBody) {
  let jsonBody = JSON.parse(aiBody);
  var payload = {
    cmd: 'none',
    param: 'none',
    param2: 'none',
  };
  logger.log('debug', aiBody);
  //Determine the action from the API.AI intent parser
  switch (jsonBody.result.action) {
    case 'weather':
      logger.log('debug','weather is action');
      payload.cmd = FOXY_COMMANDS.WEATHER;
      payload.param = jsonBody.result.parameters['geo-city'];
      break;
    case 'timer':
      logger.log('debug','timer is action');
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
      console.log('switch is ' + payload.param2);
      break;
    case 'pocket':
      console.log('pocket is action');
      payload.cmd = FOXY_COMMANDS.POCKET;
      break;
    case 'nextslide':
      payload.cmd = FOXY_COMMANDS.NEXTSLIDE;
      console.log('nextslide is action');
      robot.keyTap("right");
      break;
    case 'lastslide':
      payload.cmd = FOXY_COMMANDS.PREVIOUSSLIDE;
      console.log('nextslide is action');
      robot.keyTap("left");
      break;
    case 'npr':
      console.log('npr is action');
      payload.cmd = FOXY_COMMANDS.NPR;
      break;
    default:
      payload.cmd = FOXY_COMMANDS.NONE;
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
module.exports = {
  Parser:Parser,
  FOXY_COMMANDS: FOXY_COMMANDS
};
