Foxy client  [![Build Status](https://travis-ci.org/tamarahills/metrics_controller.svg?branch=master)](https://travis-ci.org/tamarahills/metrics_controller)
-----------
This is the an agent that handles the voice processing for the "Hey Foxy"
application.  

Prerequisites
-------------
The following are prerequisites for running the Foxy Client:
- Mac OSX
- nodejs >= 7.10.0
- sox
- snowboy

First, clone this repo:
```
$ git clone https://github.com/tamarahills/foxycli.git
```
Install portaudio and sox:
```
$ brew install portaudio sox
$ pip install pyaudio
```
Download the Snowboy binaries at http://docs.kitt.ai/snowboy/#downloads

Install the node packages:
```
$ cd foxycli
$ npm install
```
Download the "Hey Foxy" model from https://snowboy.kitt.ai/dashboard:
1.  Search on "Hey Foxy"
2.  Record a few samples while you are there (Optional)
3.  Click on the "download icon"
4.  Save "Hey_Foxy.pmdl" to the foxycli/snowboy directory.

The agent is automatically started by the web extension which uses native
messaging to start the app and connect.

Edit foxycli/startup.sh to correct the Paths to your foxycli installation so that
the extension can properly start the client.
