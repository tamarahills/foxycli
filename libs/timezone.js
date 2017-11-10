const request = require('request-promise');
const nconf = require('nconf');


nconf.file({ file: './config/config.json' });
nconf.load();
const GOOGLE_API_KEY = nconf.get('google_token');

const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

class Timezone {
  getLocaltime(coords) {
    const now = new Date();
    const location = `${coords.lat} ${coords.lon}`;
    const timestamp = Math.floor(now.getTime() / 1000);
    const url =
      'https://maps.googleapis.com/maps/api/timezone/json' +
      '?location=' +
      location +
      '&timestamp=' +
      timestamp +
      '&key=' +
      GOOGLE_API_KEY;
    return request(url).then(response => {
      const data = JSON.parse(response);
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const date = new Date(
        utc + data.rawOffset * 1000 + data.dstOffset * 1000
      );
      const hours = `0${date.getHours()}`.slice(-2);
      const minutes = `0${date.getMinutes()}`.slice(-2);
      return {
        time: `${hours}:${minutes}`,
        day: days[date.getDay()]
      };
    });
  }
}

module.exports = new Timezone();
