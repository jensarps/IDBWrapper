/*global module:false*/
module.exports = function (grunt) {

  'use strict';

  var pkg = grunt.file.readJSON('package.json');

  // Project configuration.
  grunt.initConfig({

    pkg: pkg,

    jshint: {
      all: ['Gruntfile.js', pkg.main],
      options: {
        jshintrc: '.jshintrc'
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');

};
