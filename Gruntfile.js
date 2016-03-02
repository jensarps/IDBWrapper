/*global module:false*/
module.exports = function (grunt) {

  'use strict';

  var pkg = grunt.file.readJSON('package.json');

  var additionalCSS = [
    '.navbar { display: none; }',
    '#toc { top: 0; }'
  ];

  grunt.initConfig({

    pkg: pkg,

    jshint: {
      all: ['Gruntfile.js', pkg.main],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    jsdoc: {
      dist: {
        src: [pkg.main],
        options: {
          destination: 'doc/' + pkg.version,
          private: false,
          template: './node_modules/jsdoc-oblivion/template',
          configure: 'conf.json'
        }
      }
    },

    closurecompiler: {
      minify: {
        files: {
          'idbstore.min.js': [pkg.main]
        },
        options: {
          'compilation_level': 'SIMPLE_OPTIMIZATIONS'
        }
      }
    },

    karma: {
      postbuild: {
        configFile: 'karma.conf.js'
      },
      dev: {
        configFile: 'karma.conf.js',
        files: {
          src: [
            'idbstore.js',
            'test/**/*spec.js'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-closurecompiler');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('test', 'karma:dev');
  grunt.registerTask('docs', ['jsdoc:dist', 'modifyDocs', 'copyLatestDocs']);

  grunt.registerTask('modifyDocs', function () {
    var docPath = 'doc/' + pkg.version,
      styleSheet = docPath + '/styles/site.oblivion.css',
      css = grunt.file.read(styleSheet);

    css += additionalCSS.join('\n') + '\n';
    grunt.file.write(styleSheet, css);
  });

  grunt.registerTask('copyLatestDocs', function () {
    grunt.config.set('copy.docs', {
      cwd: 'doc/' + pkg.version,
      src: '**/*',
      dest: 'doc/latest/',
      expand: true
    });
    grunt.task.run('copy:docs');
  });

  grunt.registerTask('build', [
    'jshint',
    'karma:dev',
    'closurecompiler',
    'karma:postbuild',
    'docs'
  ]);
};
