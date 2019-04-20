// Default gulpfile for Murtada.nl
const gulp         = require('gulp'),
      fs           = require('fs'),
      del          = require('del'),
      path         = require('path'),
      map          = require('map-stream'),
      querystring  = require('querystring'),
      newer        = require('gulp-newer'),
      scss         = require('gulp-sass'),
      csso         = require('gulp-csso'),
      autoprefixer = require('gulp-autoprefixer'),
      rename       = require("gulp-rename"),
      babel        = require('gulp-babel'),
      uglify       = require('gulp-uglify-es').default,
      notify       = require('gulp-notify'),
      pngToJpeg    = require('png-to-jpeg'),
      imagemin     = require('gulp-imagemin'),
      responsive   = require('gulp-responsive'),
      connect      = require('gulp-connect-php'),
      browserSync  = require('browser-sync').create(),
      compression  = require('compression');

// Config
const config = require('./config.json');

// BrowserSync reload
const reload = browserSync.reload;

// Initialise SVGO
const SVGO = require('svgo');
const svgo = new SVGO(config.svgo || {});

// Clean
function clean() {
  return del(config.destination);
}

// Image assets
function imageAssetsTask() {
  const baseWidth = 512;

  return gulp.src(
    [
      `${config.source}/assets/images/**/*.{jpg,png}`,
      `!${config.source}/assets/images/duotone.jpg`
    ], { base: config.source })
  .pipe(newer(config.destination))
  .pipe(responsive({
    '**/*.*': [
      {
        width: baseWidth,
        rename: {
          suffix: `-${baseWidth}px`,
          extname: '.png'
        }
      }, {
        width: baseWidth * 2,
        rename: {
          suffix: `-${baseWidth * 2}px`,
          extname: '.png'
        }
      }
    ]
  },
  {
    withMetadata: false,
    errorOnEnlargement: false,
    errorOnUnusedConfig: false
  }))
  .pipe(imagemin([
    pngToJpeg({ quality: 80 })
  ], {
    optimize: true,
    grayscale: true,
    progressive: true
  }))
  .pipe(rename(path => {
    path.extname = '.jpg'
  }))
  .pipe(gulp.dest(config.destination));
}

// Other assets
function otherAssetsTask() {
  return gulp.src(
    [
      `${config.source}/assets/**/*`,
      `!${config.source}/assets/**/*.{fla,jpg,png,psd}`,
      `!${config.source}/assets/**/_*.svg`,
      `${config.source}/assets/**/duotone.jpg`,
      `${config.source}/assets/**/duotone.webp`
    ], { base: config.source })
  .pipe(newer(config.destination))
  .pipe(gulp.dest(config.destination));
}

// HTML
function htmlTask() {
  const regex = /<picture.+?data-src="(.+?)"/gms;

  return gulp.src([
    `${config.source}/**/*.php`,
    `${config.source}/**/*.md`
  ], { base: config.source })
  .pipe(map(inlineSvgHTML()))
  .pipe(newer(config.destination))
  .pipe(gulp.dest(config.destination))
}

// SCSS
function scssTask() {
  return gulp.src(`${config.source}/scss/style.scss`, { base: `${config.source}/scss`, allowEmpty: true })
  .pipe(scss({ outputStyle: 'compressed' }))
    .on('error', notify.onError('SCSS compile error: <%= error.message %>'))
  .pipe(autoprefixer({ browsers: 'last 2 versions' }))
  .pipe(map(inlineSvgCSS()))
    .on('error', notify.onError('Inline SVG error: <%= error.message %>'))
  .pipe(csso())
  .pipe(gulp.dest(config.destination))
  .pipe(browserSync.stream());
}

// Inline SVG into HTML
function inlineSvgHTML(file, cb) {
  return async (file, cb) => {
    const urlPattern = /<img\s?(.+)?\ssrc="([^"]+.svg)"([^>]+)?>/gmi;
    let fileContents = file.contents.toString('utf8');
    let urlMatch, svgPath, svgContents, svgAttributes;

    // Loop through all occurrences of the URL-pattern
    while ((urlMatch = urlPattern.exec(fileContents)) !== null) {
      svgAttributes = (urlMatch[1] || '');
      svgPath = (urlMatch[2] || '');
      svgAttributes += (urlMatch[3] || '');

      // Attempt to read the SVG file
      svgContents = fs.readFileSync(
        path.join(config.source, svgPath)
      ).toString('utf8');

      svgContents = svgContents.replace(/<svg\s(.+?)>/, `<svg $1 ${svgAttributes}>`);

      // Attempt to optimise the SVG file
      // svgContents = await svgo.optimize(svgContents);
      // svgContents = svgContents.data;

      // Replace the matched string with the data URI
      fileContents = fileContents.slice(0, urlMatch.index)
        + svgContents
        + fileContents.slice((urlMatch.index + urlMatch[0].length));

      urlPattern.lastIndex = (urlMatch.index + 1);
    }

    file.contents = Buffer.from(fileContents);
    return cb(null, file);
  }
}

// Inline SVG into CSS
function inlineSvgCSS(file, cb) {
  return async (file, cb) => {
    // Example: url('inline:file.svg?color=#fff&backgroundColor=#000');
    const urlPattern = /url\(['"]?inline\:(.+?\.svg)(?:\?(.+?))?['"]?\)/gmi;
    const variablePattern = /(?:\\\\|\\\$|\$([a-z0-9\-_]+))/gmi;
    let fileContents = file.contents.toString('utf8'), urlMatch;
    let svgPath, svgQuery, svgParameters, svgContents;
    let variableMatch, variableName, variableReplacement;

    // Loop through all occurrences of the URL-pattern
    while ((urlMatch = urlPattern.exec(fileContents)) !== null) {
      /* Extract the path and query (parameters) from the pattern
         (the indices vary based on which quotes were used) */
      svgPath = (urlMatch[1] || '');
      svgQuery = (urlMatch[2] || '');
      svgParameters = querystring.parse(svgQuery);

      // Attempt to read the SVG file
      svgContents = fs.readFileSync(
        path.join(config.source, svgPath)
      ).toString('utf8');

      // Loop through all occurences of the variable pattern
      while ((variableMatch = variablePattern.exec(svgContents)) !== null) {
        if (variableMatch[1]) {
          /* Attempt to replace the variable
             with the corresponding paramater value
             (or an empty string if the variable does _not_ exist) */
          variableName = variableMatch[1];
          variableReplacement = (svgParameters[variableName] || '');

        } else {
          // Replace the escape-character sequence with the character itself
          variableReplacement = variableMatch[0][1];
        }

        svgContents = svgContents.slice(0, variableMatch.index)
          + variableReplacement
          + svgContents.slice((variableMatch.index + variableMatch[0].length));

        variablePattern.lastIndex = (variableMatch.index + 1);
      }

      // Attempt to optimise the SVG file
      svgContents = await svgo.optimize(svgContents);

      // Format the interpolated and optimised SVG file as a data URI
      svgContents = (
        config.svgo.encode
          ? `url('data:image/svg+xml,${encodeURIComponent(svgContents.data)}')`
          : `url('data:image/svg+xml,charset=UTF-8,${svgContents.data}')`
      );

      // Replace the matched string with the data URI
      fileContents = fileContents.slice(0, urlMatch.index)
        + svgContents
        + fileContents.slice((urlMatch.index + urlMatch[0].length));

      urlPattern.lastIndex = (urlMatch.index + 1);
    }

    file.contents = Buffer.from(fileContents);
    return cb(null, file);
  }
}

// JS
function jsTask() {
  return gulp.src(`${config.source}/script/script.js`, { base: `${config.source}/script`, allowEmpty: true })
  .pipe(rename('script.min.js'))
  .pipe(gulp.dest(config.destination));
}

// JS
function jsTaskBuild() {
  return gulp.src(`${config.source}/script/script.js`, { base: `${config.source}/script`, allowEmpty: true })
  .pipe(babel({
      presets: ['@babel/env']
  }))
  .pipe(rename('script.min.js'))
  .pipe(uglify())
  .pipe(gulp.dest(config.destination));
}

// Serve
function serve(done) {
  connect.server({
    base: config.destination,
    port: parseInt(config.port) + 1,
    keepalive: true
  });

  browserSync.init({
    proxy: `127.0.0.1:${parseInt(config.port) + 1}`,
    port: config.port,
    open: true,
    notify: false
  });

  done();
}

// Watch
function watchTask() {
  gulp.watch(`${config.source}/assets/**/*.{jpg,png}`, gulp.series(imageAssetsTask, reload));
  gulp.watch([
    `${config.source}/assets/**/*`,
    `!${config.source}/assets/**/*.{fla,jpg,png}`,
    `!${config.source}/assets/**/_*.svg`,
    `${config.source}/assets/**/duotone.jpg`,
    `${config.source}/assets/**/duotone.webp`
  ], gulp.series(otherAssetsTask, htmlTask, reload));
  gulp.watch([
    `${config.source}/**/*.php`,
    `${config.source}/**/*.md`
  ], gulp.series(htmlTask, reload));
  gulp.watch(`${config.source}/scss/**/*.scss`, scssTask);
  gulp.watch(`${config.source}/script/**/*.js`, gulp.series(jsTask, reload));
}

console.log(`---------------------------------------------------------------`);
console.log(
`███████╗██╗ ██████╗  ██████╗ ██╗   ██╗██████╗  █████╗ ████████╗
╚══███╔╝██║██╔════╝ ██╔════╝ ██║   ██║██╔══██╗██╔══██╗╚══██╔══╝
  ███╔╝ ██║██║  ███╗██║  ███╗██║   ██║██████╔╝███████║   ██║
 ███╔╝  ██║██║   ██║██║   ██║██║   ██║██╔══██╗██╔══██║   ██║
███████╗██║╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║██║  ██║   ██║
╚══════╝╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   `);
console.log(`---------------------------------------------------------------`);

// Default task
gulp.task('default', gulp.series(clean, imageAssetsTask, gulp.parallel(otherAssetsTask, htmlTask, scssTask, jsTask), gulp.parallel(serve, watchTask)));

gulp.task('deploy', gulp.series(clean, imageAssetsTask, gulp.parallel(otherAssetsTask, htmlTask, scssTask, jsTaskBuild), gulp.parallel(serve, watchTask)));

gulp.task('skipAssets', gulp.series(clean, gulp.parallel(htmlTask, scssTask, jsTask), gulp.parallel(serve, watchTask)));
