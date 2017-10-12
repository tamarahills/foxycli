Foxy client  [![Build Status](https://travis-ci.org/tamarahills/foxycli.svg?branch=test-travis)](https://travis-ci.org/tamarahills/foxycli)
-----------
This is the an agent that handles the voice processing for the "Hey Foxy"
application.  

### Prerequisites
-------------
The following are prerequisites for running the Foxy Client:
- Mac OSX ONLY!
- nodejs >= 7.10.0
- sox
- snowboy
- Firefox browser https://www.mozilla.org/en-US/firefox/

### Install node (if you didn't use nvm)

(If you already installed node via nvm you can skip this step)

Follow the directions from [NodeJS](https://nodejs.org) to install on your platform.

### Install software 
First, clone this repo:
```
$ git clone https://github.com/tamarahills/foxycli.git
```
### Install dependencies 
Install portaudio and sox:
```
$ brew install portaudio sox
$ pip install pyaudio
```
Download the Snowboy binaries at http://docs.kitt.ai/snowboy/#downloads

### Install the node packages
```
$ cd foxycli
$ npm install
```
Download the "Hey Foxy" model from https://snowboy.kitt.ai/dashboard:
1.  Search on "Hey Foxy"
2.  Record a few samples while you are there (Optional)
3.  Click on the "download icon"
4.  Save "Hey_Foxy.pmdl" to the foxycli/resources directory.

### Start the agent

```
$ cd foxycli
$ node index.js
```
### Start the extension
See instructions at https://github.com/tamarahills/foxyext to install and start the extensions. To verify that Foxy is working, you can use the following commands:
```
Hey Foxy, what's the weather in Seattle
Hey Foxy, set a timer for ten minutes
Hey Foxy, play some NPR
Hey Foxy, play some (jazz|classical|rock)
Hey Foxy, add that to pocket (requires pocket integration)
Hey Foxy, turn the kitchen light on (requires integration with https://github.com/mozilla-iot/gateway)

```

### Running the tests
```
$ cd foxycli
$ npm test
```
### Troubleshooting Known Issues

