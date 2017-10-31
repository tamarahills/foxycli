'use strict'

const record = require('node-record-lpcm16');
const stream = require('stream');
const {Detector, Models} = require('snowboy');
const Parser = require('./parser');
const ua = require('universal-analytics');
const nconf = require('nconf');
const uuidv4 =  require('uuid/v4');
const rp = require('request-promise');

var logOpts = {
  logDirectory: __dirname ,
  fileNamePattern: 'foxy-<date>.log',
  dateFormat:'YYYY.MM.DD-HHa'
};

var logger = require('simple-node-logger').createRollingFileLogger(logOpts);
logger.setLevel('debug');


const shimOptions = {
  uri: 'http://localhost:3000/command',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json'}
};

var visitor = '';

const ERROR = {
  NOT_STARTED: 'NOT_STARTED',
  INVALID_INDEX: 'INVALID_INDEX'
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

  nconf.file({ file: './config/config.json' });
  nconf.load();
  var uuid = nconf.get('visitorid');

  // Create the uuid if it's not there.
  if (!uuid) {
    console.log('Setting uuid');
    uuid = uuidv4();
    nconf.set('visitorid', uuid);
    nconf.save(function (err) {
      if (err) {
        console.error(err.message);
        return;
      }
      console.log('Configuration saved successfully.');
    });
  }
  console.log('Creating visitor. Id is: ' + uuid);
  var visitor = ua(nconf.get('GAProperty'), uuid).debug();
  parser.setMetrics(visitor, uuid);
  var ga_params = {
    ec: 'foxy',
    ea: 'start',
    cd1: uuid,
    uid: uuid
  };
  visitor.event(ga_params).send();
  
  //Send the GA property info to the extension. NEED TO START EXTENSION FIRST
  var payload = {
    cmd: 'GA',
    param: nconf.get('GAProperty'),
    param2: uuid
  };  

  shimOptions.body = JSON.stringify(payload);
  rp(shimOptions);
    
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
  logger.debug('Created detector');

  detector.on('silence', () => {
    if(foxy.state == stateEnum.STREAMING) {
      // Stop streaming and pause the microphone.
      Foxy.pause(foxy);
      foxy.state = stateEnum.PAUSED;
      parser.parseResults(Buffer.from(foxy.audioBuffer), function(status) {
        if (status != 'ok') {
          logger.debug('parsing returned:' + status);
        }
        // Start capturing the audio again.
        foxy.audioBuffer = [];
        Foxy.resume(foxy);
        foxy.state = stateEnum.LISTENING;
      });
    }
    foxy.emit('silence');
  });

  detector.on('sound', (buffer) =>  {
    logger.debug('sound');
    if(foxy.state == stateEnum.STREAMING) {
      logger.debug('State is STREAMING');
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
        logger.debug('FOUND KEYWORD');
      } catch (e) {
        logger.error('Failed on trigger');
        throw ERROR.INVALID_INDEX;
      }
    } else {
      logger.error('Foxy not started');
      throw ERROR.NOT_STARTED;
    }
  }

  return foxy;
};

Foxy.start = foxy => {
  logger.debug('Entering Foxy.start');
  foxy.mic = record.start({
    threshold: 0,
    verbose: true
  });

  foxy.mic.pipe(foxy.detector);
  foxy.state = stateEnum.LISTENING;
  foxy.started = true;
  logger.debug('Leaving Foxy.start');
}

Foxy.trigger = (foxy, index, hotword) => foxy.trigger(index, hotword)

Foxy.pause = foxy => foxy.mic.pause()

Foxy.resume = foxy => foxy.mic.resume()

Foxy.stop = () => record.stop()

logger.debug('Initializing Foxy Process.');
Foxy.start(Foxy.init());

process.on('uncaughtException', function (exception) {
  console.log(exception.stack);
  visitor.exception('unhandled process exception: ' + exception.stack).send();
  logger.error(exception.stack);
});
