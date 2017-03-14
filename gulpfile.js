var gulp = require('gulp');
var cdnizer = require('gulp-cdnizer');
var uglify = require('gulp-uglify');
var minifyCSS = require('gulp-csso');
var ts = require('gulp-typescript');
var pump = require('pump');

gulp.task('cdn', function() {
    // pump([
    //     gulp.src('src/index.html'),
    //     cdnizer([
    //         'cdnjs:jquery',
    //         'cdnjs:d3', {
    //             file: 'bower_components/bootstrap/dist/js/bootstrap.js',
    //             package: 'bootstrap',
    //             cdn: '//maxcdn.bootstrapcdn.com/bootstrap/${ version }/js/${ filenameMin }'
    //         }, {
    //             file: 'bower_components/bootstrap/dist/css/bootstrap.css',
    //             package: 'bootstrap',
    //             cdn: '//maxcdn.bootstrapcdn.com/bootstrap/${ version }/css/${ filenameMin }'
    //         }
    //     ]),
    //     gulp.dest('dist')
    // ]);
    return gulp.src('src/index.html')
        .pipe(cdnizer([
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
        ]))
        .pipe(gulp.dest('dist'));
});

gulp.task('css', function() {
    pump([
        gulp.src('src/*.css'),
        minifyCSS(),
        gulp.dest('dist')
    ]);
});

gulp.task('ts', function() {
    var tsProject = ts.createProject('tsconfig.json');
    pump([
        gulp.src('src/*.ts'),
        tsProject(),
        uglify(),
        gulp.dest('dist')
    ]);
});

gulp.task('js', function() {
    return gulp.src('src/*.js').pipe(babel())
        // .pipe(uglify())
        .pipe(gulp.dest('dist'));
    // pump([
    //     gulp.src('src/*.js'),
    //     // uglify(),
    //     gulp.dest('dist')
    // ]);
});

gulp.task('assets', function() {
    pump([
        gulp.src('src/*.csv'),
        gulp.dest('dist')
    ]);
});

gulp.task('default', [ 'cdn', 'css', 'ts', 'assets' ]);

// var less = require('gulp-less');
//    return gulp.src('templates/*.less')
//         .pipe(less())
// });
