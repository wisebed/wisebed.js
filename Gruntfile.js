module.exports = function(grunt) {

 // Project configuration.
 grunt.initConfig({
	pkg: grunt.file.readJSON('package.json'),
	browserify: {
	 'dist/wisebed.browserify.js': ['src/wisebed.js'],
	 browserifyOptions: {debug:true}
	},
	uglify: {
	 options: {
		banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
	 },
	 build: {
		src: 'dist/wisebed.browserify.js',
		dest: 'dist/wisebed.min.js'
	 }
	},
	copy: {
	 main: {
		files: [
		 {expand: true, cwd: 'src/', src:['**'], dest: 'dist/'}
		]
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
	},
	release: {
	 options: {
		github: {
		 repo: 'wisebed/wisebed.js'
		}
	 }
	}
 });

 grunt.loadNpmTasks('grunt-contrib-copy');
 grunt.loadNpmTasks('grunt-contrib-clean');
 grunt.loadNpmTasks('grunt-browserify');
 grunt.loadNpmTasks('grunt-contrib-uglify');
 grunt.loadNpmTasks('grunt-contrib-watch');
 grunt.loadNpmTasks('grunt-contrib-jshint');
 grunt.loadNpmTasks('grunt-contrib-yuidoc');
 grunt.loadNpmTasks('grunt-release');

 grunt.registerTask('doc', ['yuidoc']);
 grunt.registerTask('default', ['jshint','browserify','uglify','yuidoc','copy']);

};
