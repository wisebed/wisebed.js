module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      'dist/<%= pkg.name %>.browserify.js': ['src/<%= pkg.name %>.js']
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'build/<%= pkg.name %>.browserify.js',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    },
	clean: ['dist/','docs/'],
    jshint: {
      all: ['src/**/*.js']
    },
    yuidoc: {
      compile: {
        name: '<%= pkg.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          paths: 'src/',
          outdir: 'docs/'
        }
      }
    },
    watch: {
      js: {
        files: ['src/*.js'],
        tasks: ['jshint','browserify','uglify']
      },
      docs: {
        files: ['src/*.js'],
        tasks: ['yuidoc']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');

  grunt.registerTask('doc', ['yuidoc']);
  grunt.registerTask('default', ['jshint','browserify','uglify','yuidoc']);

};
