// Default gulpfile for Murtada.nl
const gulp         = require('gulp'),
      fs           = require('fs'),
      del          = require('del'),
      path         = require('path'),
      map          = require('map-stream'),
      querystring  = require('querystring'),
      cache        = require('gulp-cached'),
      scss         = require('gulp-sass'),
      csso         = require('gulp-csso'),
      autoprefixer = require('gulp-autoprefixer'),
      rename       = require("gulp-rename"),
      babel        = require('gulp-babel'),
      sharp        = require('sharp'),
      uglify       = require('gulp-uglify-es').default,
      notify       = require('gulp-notify'),
      pngToJpeg    = require('png-to-jpeg'),
      imagemin     = require('imagemin'),
      pngQuant     = require('imagemin-pngquant'),
      connect      = require('gulp-connect-php'),
      browserSync  = require('browser-sync').create(),
      favicons     = require('gulp-favicons');

// Config
const config = require('./config.json');

// BrowserSync reload
const reload = (done) => {
  browserSync.reload();
  done();
}

// Initialise SVGO
const SVGO = require('svgo');
const svgo = new SVGO(config.svgo || {});


// Tasks below

// Clean
function clean() {
  return del(config.dest);
}


// Process single image type in size
function processImage(type, size) {
  return new Promise((resolve, reject) => {
    // Go through each glob depending on the type
    gulp.src(config.images[type],
      { base: config.src })
    .pipe(cache(`assets-${type}-${size}`, { optimizeMemory: true }))
    .pipe(
      map(async (file, cb) => {
        await sharp(file.contents)
        .resize({
          width: size,
          withoutEnlargement: true
        })
        .png()
        .toBuffer()
        .then(data => {
          file.contents = data;
          cb(null, file);
        });
      })
    )
    .pipe(map(async (file, cb) => {
      const whichPlugin = {
        jpg: pngToJpeg({
          quality: 80
        }),
        png: pngQuant({
          speed: 1,
          strip: true,
          dithering: 1,
          quality: [.5, 1]
        })
      };

      file.contents = await imagemin.buffer(file.contents,
        {
          optimize: true,
          grayscale: true,
          progressive: true
        },
        [ whichPlugin[type] ]
      );

      cb(null, file);
    }))
    .pipe(rename({
      suffix: `-${size}px`,
      extname: `.${type}`
    }))
    .pipe(gulp.dest(config.dest))
    .on('end', resolve);
  });
}


// Image assets
function imageAssetsTask(done) {
  const imageSizes = {
    jpg: [
      512,
      1024
    ],
    png: [
      512,
      1024,
      1920
    ]
  };

  const processes = [];

  Object.keys(imageSizes).forEach(type => {
    const sizes = imageSizes[type];

    sizes.forEach(size => {
      processes.push(processImage(type, size));
    });
  });

  Promise.all(processes)
  .then(resolve => {
    done();
  });
}


// Other assets
function otherAssetsTask() {
  return gulp.src([
    `${config.src}/robots.txt`,
    `${config.src}/humans.txt`,
    `${config.src}/assets/**/*`,
    `!${config.src}/assets/**/*.{fla,jpg,png,psd,ai}`,
    `!${config.src}/assets/**/_*.svg`,
    `${config.src}/assets/**/duotone.jpg`,
    `${config.src}/assets/**/duotone.webp`
  ], { base: config.src })
  .pipe(cache('assets-other', { optimizeMemory: true }))
  .pipe(gulp.dest(config.dest))
  &&
  gulp.src(`${config.dest}/favicons/favicon.ico`, { allowEmpty: true })
  .pipe(gulp.dest(config.dest));
}


// Favicon
function faviconTask() {
  return gulp.src(
    path.join(config.src, config.favicons.src),
    { base: config.favicons.src })
  .pipe(favicons(config.favicons.options))
    .on('error', notify.onError('Favicon generator error: <%= error.message %>'))
  .pipe(gulp.dest(path.join(config.dest, config.favicons.dest)));
}


// HTML
function htmlTask() {
  return gulp.src([
    `${config.src}/**/*.php`,
    `${config.src}/**/*.md`
  ], { base: config.src })
  .pipe(map(inlineSvgHTML()))
  .pipe(gulp.dest(config.dest));
}


// SCSS
function scssTask() {
  return gulp.src(
    `${config.src}/scss/style.scss`,
    { base: `${config.src}/scss`, allowEmpty: true })
  .pipe(scss({ outputStyle: 'compressed' }))
    .on('error', notify.onError('SCSS compile error: <%= error.message %>'))
  .pipe(autoprefixer({ overrideBrowserslist: 'last 2 versions' }))
  .pipe(map(inlineSvgCSS()))
    .on('error', notify.onError('Inline SVG error: <%= error.message %>'))
  .pipe(csso())
  .pipe(gulp.dest(config.dest))
  .pipe(browserSync.stream());
}


// Inline SVG into HTML
function inlineSvgHTML(file, cb) {
  return async (file, cb) => {
    const urlPattern = /<img\s?(.+)?\ssrc="([^"]+\/_.+svg)"([^>]+)?>/gmi;
    let fileContents = file.contents.toString('utf8');
    let urlMatch, svgPath, svgContents, svgAttributes;

    // Loop through all occurrences of the URL-pattern
    while ((urlMatch = urlPattern.exec(fileContents)) !== null) {
      svgAttributes = (urlMatch[1] || '');
      svgPath = (urlMatch[2] || '');
      svgAttributes += (urlMatch[3] || '');

      // Attempt to read the SVG file
      svgContents = fs.readFileSync(
        path.join(config.src, svgPath)
      ).toString('utf8');

      svgContents = svgContents.replace(/<svg\s(.+?)>/, `<svg $1 ${svgAttributes}>`);

      // Attempt to optimise the SVG file
      // svgContents = await svgo.optimize(svgContents);
      // svgContents = svgContents.data;

      // Replace the matched string with the data URI
      fileContents = fileContents.slice(0, urlMatch.index)
        + svgContents.trim()
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
        path.join(config.src, svgPath)
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
  return gulp.src(
    `${config.src}/script/script.js`,
    { base: `${config.src}/script`, allowEmpty: true })
  .pipe(rename('script.min.js'))
  .pipe(gulp.dest(config.dest))
  &&
  gulp.src(`${config.src}/script/lib/*.js`, { base: `${config.src}`, allowEmpty: true })
  .pipe(gulp.dest(config.dest));
}


// JS
function jsTaskBuild() {
  return gulp.src(
    `${config.src}/script/script.js`,
    { base: `${config.src}/script`, allowEmpty: true })
  .pipe(babel({
      presets: ['@babel/env']
  }))
  .pipe(rename('script.min.js'))
  .pipe(uglify())
  .pipe(gulp.dest(config.dest))
  &&
  gulp.src(`${config.src}/script/lib/*.js`, { base: `${config.src}`, allowEmpty: true })
  .pipe(gulp.dest(config.dest));
}


// Serve
function serve(done) {
  connect.server({
    base: config.dest,
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
  gulp.watch(`${config.src}/assets/**/*.{jpg,png}`, gulp.series(imageAssetsTask, reload));

  gulp.watch([
    `${config.src}/assets/**/*`,
    `!${config.src}/assets/**/*.{fla,jpg,png}`,
    `!${config.src}/assets/**/_*.svg`,
    `${config.src}/assets/**/duotone.jpg`,
    `${config.src}/assets/**/duotone.webp`
  ], gulp.series(otherAssetsTask, htmlTask, reload));

  gulp.watch([
    `${config.src}/**/*.php`,
    `${config.src}/**/*.md`
  ], gulp.series(htmlTask, reload));

  gulp.watch(`${config.src}/scss/**/*.scss`, scssTask);

  gulp.watch(`${config.src}/script/**/*.js`, gulp.series(jsTask, reload));
}


// Default task
gulp.task('default',
  gulp.series(
    clean,
    faviconTask,
    imageAssetsTask,

    gulp.parallel(
      otherAssetsTask,
      htmlTask,
      scssTask,
      jsTask
    ),

    gulp.parallel(
      serve,
      watchTask
    )
  )
);

gulp.task('deploy',
  gulp.series(
    clean,
    faviconTask,
    imageAssetsTask,

    gulp.parallel(
      otherAssetsTask,
      htmlTask,
      scssTask,
      jsTaskBuild
    ),

    gulp.parallel(
      serve,
      watchTask
    )
  )
);

gulp.task('skipFavicons',
  gulp.series(
    clean,
    imageAssetsTask,

    gulp.parallel(
      otherAssetsTask,
      htmlTask,
      scssTask,
      jsTask
    ),

    gulp.parallel(
      serve,
      watchTask
    )
  )
);

gulp.task('skipAssets',
  gulp.series(
    gulp.parallel(
      otherAssetsTask,
      htmlTask,
      scssTask,
      jsTask
    ),
    gulp.parallel(
      serve,
      watchTask
    )
  )
);


// ASCII flair
console.log(`---------------------------------------------------------------
███████╗██╗ ██████╗  ██████╗ ██╗   ██╗██████╗  █████╗ ████████╗
╚══███╔╝██║██╔════╝ ██╔════╝ ██║   ██║██╔══██╗██╔══██╗╚══██╔══╝
  ███╔╝ ██║██║  ███╗██║  ███╗██║   ██║██████╔╝███████║   ██║
 ███╔╝  ██║██║   ██║██║   ██║██║   ██║██╔══██╗██╔══██║   ██║
███████╗██║╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║██║  ██║   ██║
╚══════╝╚═╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
---------------------------------------------------------------`);
