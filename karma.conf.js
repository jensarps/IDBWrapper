/* global module:false */
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'chai'],
    reporters: ['dots', 'progress'],
    browsers: ['Chrome', 'Firefox'],

    customLaunchers: {
      ChromeIncognito: {
        base: 'Chrome',
        flags: ['--incognito']
      }
    },

    files: [
      'idbstore.min.js',
      'test/**/*spec.js'
    ]
  });
};
