module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps: [
    // First application
    {
      name: 'Start API App',
      script: 'start.js',
      watch: true
    },
    // Second application
    {
      name: 'Index',
      script: 'index.js'
    }
  ]
};
