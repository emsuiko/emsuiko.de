var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

var log = require('fancy-log');

var browserSync = require('browser-sync').create();

var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var del = require('del');

var uglify = require('gulp-uglify-es').default;
// * * * BROWSERIFY
var browserify = require('browserify');
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");

var env = require('minimist')(process.argv.slice(2))._[0] || 'development';

var isDevelopment = function() {
    return (env === 'development');
};
var isProduction = function () {
    return !isDevelopment();
};

var sassFilter = function(file) {
    return !/\/_/.test(file.path) || !/^_/.test(file.relative);
};

function onError(err) {
    require('beeper')();
    log.error(err);
}

// * * * * * FUNCTIONS * * * * * //
function imagine(file, destination) {
    return gulp.src([file])
        .pipe(gulp.dest('dist/img' + destination));
}

function sass(filestream) {
    return filestream
        .pipe($.sassInheritance({ dir: 'src/sass/' }))
        .pipe($.filter(sassFilter))
        .pipe($.if(isDevelopment(), $.sourcemaps.init()))
        .pipe($.sass())
        .pipe($.if(isProduction(), $.postcss([
            autoprefixer({ browsers: ['last 2 versions', 'ie >= 9'] }),
            cssnano()
        ]), $.postcss([
            autoprefixer({ browsers: ['last 2 versions', 'ie >= 9'] })
        ])))
        .pipe($.if(isDevelopment(), $.sourcemaps.write()))
        .pipe(gulp.dest('dist/css'));
}

function templates(filestream, destination) {
    return filestream
        .pipe($.pug())
        // .pipe($.rename({
        //     extname: ".twig"
        // }))
        .pipe(gulp.dest('dist'+destination))
}

function script(filename) {
    return browserify({
        entries: 'src/js/'+filename,
        debug: isDevelopment()
      })
      .bundle()
      .on('error', err => {
        log.error("Browserify Error: "+err.message);
      })
      .pipe(source(filename))
      .pipe(buffer())
      .pipe($.if(isProduction(), uglify()))
      .pipe($.sourcemaps.init({loadMaps: true}))
      .pipe($.sourcemaps.write('./maps'))
      .pipe(gulp.dest('../public/js'));
}

function fontawesome() {
    return gulp.src('node_modules/@fortawesome/fontawesome-free-webfonts/webfonts/*')
        .pipe(gulp.dest('dist/fonts'));
}

// function fonts(files, destination) {
//     return gulp.src(files)
//         .pipe(gulp.dest('../dist/fonts' + destination));
// }

// * * * * * TASKS * * * * * //

gulp.task('templates', function() {
    return templates(gulp.src('src/pug/**/*.pug'),'');
});

gulp.task('sass', function() {
    return sass(gulp.src('src/sass/**/*.sass'));
});

gulp.task('js', function() {
    return script('app.js');
});

gulp.task('fonts', function() {
    return fontawesome(); // && lightgallery() && fonts('fonts/**/*', '');
});

gulp.task('img', function() {
    return imagine('src/images/**/*', '');
});

gulp.task('stuff', function() {
    return gulp.src('src/*.*')
            .pipe(gulp.dest('dist'));
});

gulp.task('favicon', function() {
    return gulp.src('src/favicon.ico')
        .pipe(gulp.dest('dist'))
});

gulp.task('clean', function() {
    log('Clean destination directories.')
    return del([
        'dist/**/*',
    ]);
});

gulp.task('browserSync', function() {
    browserSync.init({
      server: {
        baseDir: 'dist'
      },
    })
});

gulp.task('build', gulp.series('clean', gulp.parallel('templates', 'sass', 'js', 'fonts', 'img', 'favicon', 'stuff')), () => {});

gulp.task('watch', gulp.series(gulp.parallel('templates', 'sass', 'js', 'fonts', 'img', 'favicon', 'browserSync', 'stuff'), function watch () {
    log('Start watching...');

    $.watch('src/*.*', function(vinyl) {
        var filename = vinyl.path.replace(vinyl.cwd + '/', '');
        var dest = vinyl.dirname.replace(vinyl.base, '');

        if (vinyl.event == 'unlink') {
            del('dist/' + filename, {
                force: true
            });
            log('deleted: ' + filename);
        } else {
            gulp.src(filename).pipe(gulp.dest('dist'))
                .on('end', function() {
                    log('...copied');
                });
        }
    });

    $.watch('src/images/**/*.*', { verbose: true }, function(vinyl) {
        var filename = vinyl.path.replace(vinyl.cwd + '/', '');
        var dest = vinyl.dirname.replace(vinyl.base, '');

        if (vinyl.event == 'unlink') {
            del('dist/' + filename, {
                force: true
            });
            log('deleted image: ' + filename);
        } else {
            imagine(filename, dest)
                .on('end', function() {
                    log('...re-imagined');
                });
        }
    });

    $.watch('src/pug/**/*.pug', { verbose: true }, function(vinyl) {
        var filename = vinyl.path.replace(vinyl.cwd + '/', '');
        var dest = vinyl.dirname.replace(vinyl.base, '');
        templates(gulp.src(filename)
                .pipe($.plumber({ errorHandler: onError })),'')
            .on('end', function() {
                log('...re-pugged');
            });
    });

    $.watch('src/sass/**/*.sass', { verbose: true }, function(vinyl) {
        var filename = vinyl.path.replace(vinyl.cwd + '/', '');
        sass(gulp.src([filename], { base: 'src/sass/' })
                .pipe($.plumber({ errorHandler: onError })))
            .on('end', function() {
                log('...re-sassed');
            });
    });

    $.watch('src/js/**/*.js', { verbose: true }, function(vinyl) {
        script('app.js').pipe($.plumber({ errorHandler: onError }))
            .on('end', function() {
                log('...re-scripted');
            });
    });

    $.watch('src/fonts/**/*.*', { verbose: true }, function(vinyl) {
        var filename = vinyl.path.replace(vinyl.cwd + '/', '');
        var dest = vinyl.dirname.replace(vinyl.base, '');
        fonts(filename, dest)
            .on('end', function() {
                log('...re-fonted');
            });
    });
}));

gulp.task('default', gulp.series('clean', 'watch'), function() {
    log('Start build for '+env);
});