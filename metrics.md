# Metrics we collect
The Foxy Client collects metrics about your usage of Foxy.  The intent is to collect data in order to improve the user's experience while using Foxy.  Data about your specific browsing behaior or the sites you visit is **never transmitted to any Mozilla server**.  

Data is sent to our servers in the form of messages whenever 1) Foxy is started or stopped, or encounters an error and 2) whenever you ask Foxy to do something or ask it a question.  Essentially, one message is sent every time you invoke 'Hey Foxy'.  Pings are sent in [JSON serialized format](http://www.json.org/) utilizing the [GA Measurement protocol](https://developers.google.com/analytics/devguides/collection/protocol/v1/).

At Mozilla, [we take your privacy very seriously](https://www.mozilla.org/privacy/).  We do not transmit what you are browsing, searches you perform or any private settings.  

The following is a detailed overview of the different kinds of data we collect in the Foxy Client.

## Non Interaction Messages
Messages are sent to Google Analytics under the following conditions:
1) Foxy is started
2) Foxy is stopped
3) Foxy encounters an exception or error.

### Format
Start|Stop command
```js
{
  "ec": "foxy",
  "ea": "start"|"stop",
  "v": "1",
  "cid": <randomly generated uuid>,
  "uid": <randomly generated stored uuid>
}
```

## Interaction Messages
Messages are sent to Google Analytics when you start a command with "Hey Foxy":

### Format
User Interaction command
```js
{
  "ec": "foxy",
  "ea": "spotify"|"npr"|"timer"|"nextslide"|"previousslide"|"pocket"|"iot"|"weather"|"feedback",
  "el": "genre"  |     |"tag"  |           |               |        |"tag"|"city"   |"feedback",
  "ev":          |     |<seconds>|         |               |        |     |         |  
  "v": "1",
  "cid": <randomly generated uuid>,
  "uid": <randomly generated stored uuid>
}
```
