'use strict'

const record = require('node-record-lpcm16');
const stream = require('stream');
const {Detector, Models} = require('snowboy');
const Parser = require('./parser');
const fs = require('fs');
const Logger = require('filelogger');
const express = require('express');

const app = express();
var logger = new Logger('debug', 'error', 'foxy.log');

const ERROR = {
  NOT_STARTED: "NOT_STARTED",
  INVALID_INDEX: "INVALID_INDEX"
};

const stateEnum = {
    LISTENING: 'listening',
    STREAMING: 'streaming',
    PAUSED: 'paused',
    NOT_STARTED: 'notstarted'
};

const Foxy = {};
var parser = new Parser.Parser();

Foxy.init = () => {
  const opts = Object.assign({}),
    models = new Models(),
    foxy = new stream.Writable()
  foxy.mic = {}
  foxy.started = false
  foxy.state = stateEnum.NOT_STARTED
  foxy.audioBuffer = []

  models.add({
    file:  'resources/Hey_Foxy.pmdl',
    sensitivity: '0.5',
    hotwords: 'Hey Foxy'
  });

  // defaults
  opts.models = models
  opts.resource = 'resources/common.res'
  opts.audioGain =  2.0
  opts.language =  'en-US'

  const detector = foxy.detector = new Detector(opts)
  logger.log('debug', 'Created detector');

  detector.on('silence', () => {
    if(foxy.state == stateEnum.STREAMING) {
      // Stop streaming and pause the microphone.
      Foxy.pause(foxy);
      foxy.state = stateEnum.PAUSED;
      parser.parseResults(Buffer.from(foxy.audioBuffer), function(status) {
        // Start capturing the audio again.
        foxy.audioBuffer = [];
        Foxy.resume(foxy);
        foxy.state = stateEnum.LISTENING;
      });
    }
    foxy.emit('silence');
  });

  detector.on('sound', (buffer) =>  {
    logger.log('debug', 'sound');
    if(foxy.state == stateEnum.STREAMING) {
      logger.log('State is STREAMING');
      Array.prototype.push.apply(foxy.audioBuffer, buffer);
    }
    foxy.emit('sound', buffer);
  });

  // When a hotword is detected pipe the audio stream to speech detection
  detector.on('hotword', (index, hotword, buffer) => {
    foxy.trigger(index, hotword, buffer)
  })

  foxy.trigger = (index, hotword, buffer) => {
    if (foxy.started) {
      try {
        let triggerHotword = (index == 0) ? hotword : models.lookup(index);
        foxy.state = stateEnum.STREAMING;
        Array.prototype.push.apply(foxy.audioBuffer, buffer);
        foxy.emit('hotword', index, triggerHotword);
        logger.log('debug', 'FOUND KEYWORD');
      } catch (e) {
        logger.log('error', 'Failed on trigger');
        throw ERROR.INVALID_INDEX;
      }
    } else {
      logger.log('error', 'Foxy not started');
      throw ERROR.NOT_STARTED;
    }
  }

  return foxy;
};

Foxy.start = foxy => {
  logger.log('debug', 'Entering Foxy.start');
  foxy.mic = record.start({
    threshold: 0,
    verbose: true
  });

  foxy.mic.pipe(foxy.detector);
  foxy.state = stateEnum.LISTENING;
  foxy.started = true;
  logger.log('debug', 'Leaving Foxy.start');
}

Foxy.trigger = (foxy, index, hotword) => foxy.trigger(index, hotword)

Foxy.pause = foxy => foxy.mic.pause()

Foxy.resume = foxy => foxy.mic.resume()

Foxy.stop = () => record.stop()

logger.log('debug', 'Initializing Foxy Process.');
Foxy.start(Foxy.init());

process.on('uncaughtException', function (exception) {
  console.log(exception.stack);
  logger.log('error', exception.stack);
});
