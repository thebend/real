var gulp = require('gulp');
var cdnizer = require('gulp-cdnizer');
// var uglify = require('gulp-uglify');
// var minifyCSS = require('gulp-csso');
var ts = require('gulp-typescript');
var pump = require('pump');

gulp.task('lib-build', function() {
    pump([
        gulp.src('src/index.html'),
        cdnizer([
            'cdnjs:jquery',
            'cdnjs:d3', {
                file: 'bower_components/bootstrap/dist/js/bootstrap.js',
                package: 'bootstrap',
                cdn: '//maxcdn.bootstrapcdn.com/bootstrap/${ version }/js/${ filenameMin }'
            }, {
                file: 'bower_components/bootstrap/dist/css/bootstrap.css',
                package: 'bootstrap',
                cdn: '//maxcdn.bootstrapcdn.com/bootstrap/${ version }/css/${ filenameMin }'
            }
        ]),
        gulp.dest('dist')
    ]);
});

gulp.task('lib-test', function() {
    pump([
        gulp.src('bower_components/**'),
        gulp.dest('dist/bower_components/')
    ]);

    pump([
        gulp.src('src/index.html'),
        gulp.dest('dist')
    ]);
});

gulp.task('css', function() {
    pump([
        gulp.src('src/*.css'),
        // minifyCSS(),
        gulp.dest('dist')
    ]);
});

gulp.task('ts-build', function() {
    var tsProject = ts.createProject('tsconfig.json');
    pump([
        gulp.src('src/*.ts'),
        tsProject(),
        // uglify(),
        gulp.dest('dist')
    ]);
});

gulp.task('ts-test', function() {
    var tsProject = ts.createProject('tsconfig.json');
    pump([
        gulp.src('src/*.ts'),
        tsProject(),
        gulp.dest('dist')
    ]);
});

gulp.task('assets', function() {
    pump([
        gulp.src('src/*.csv'),
        gulp.dest('dist')
    ]);
});

gulp.task('default', [ 'lib-test', 'css', 'ts-test', 'assets' ]);
gulp.task('build', [ 'lib-build', 'css', 'ts-build', 'assets' ]);

// var less = require('gulp-less');
//    return gulp.src('templates/*.less')
//         .pipe(less())
// });
