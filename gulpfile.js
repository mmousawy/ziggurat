/**
 * Default gulpfile for Ziggurat.
 * This file contains all the individual tasks for the following gulp tasks:
 *
 *  gulp [default]
 *    Clean, build and watch for changes for all files.
 *
 *  gulp deploy
 *    Clean, build for deployment (no sourcemaps) and watch for changes for all files.
 *
 *  gulp skipFavicons
 *    Clean, build but skip favicons generation and watch for changes for all files.
 *
 *  gulp skipImageAssets
 *    Don't clean, build but skip generating images, watch for all files.
 */

// Base packages
const gulp         = require('gulp');
const fs           = require('fs');
const del          = require('del');
const path         = require('path');

// Gulp helper packages
const notify       = require('gulp-notify');
const cache        = require('gulp-cached');
const rename       = require("gulp-rename");
const gulpif       = require("gulp-if");
const map          = require('map-stream');

// SVG packages
const querystring  = require('querystring');
const csso         = require('gulp-csso');

// SCSS packages
const scss         = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const sourcemaps   = require('gulp-sourcemaps');

// JavaScript packages
const rollup       = require('rollup').rollup;
const terser       = require('rollup-plugin-terser').terser;

// Image packages
const sharp        = require('sharp');
const pngToJpeg    = require('png-to-jpeg');
const imagemin     = require('imagemin');
const pngQuant     = require('imagemin-pngquant');
const favicons     = require('gulp-favicons');

// Development server packages
const connect      = require('gulp-connect-php');
const browserSync  = require('browser-sync').create();

/**
 * Load the gulp config.
 */
const config = require('./config.json');

// Initialise SVGO
const SVGO = require('svgo');
const svgo = new SVGO(config.svgo || {});
let ENVIRONMENT = 'development';

// Individual Gulp tasks are below.

/**
 * Set the environment variable.
 *
 * @param {string} env
 */
function setDeployEnvironment(done) {
  ENVIRONMENT = 'deploy';

  done();
}

/**
 * Create a gulpified BrowserSync reload.
 *
 * @param {function} done
 */
function reload(done) {
  browserSync.reload();
  done();
}

/**
 * Clean the destination folder.
 */
function clean() {
  return del(config.buildOptions.project.destination);
}

/**
 * Process single image type in a single size.
 *
 * @param {string} type The type of image (jpg/png)
 * @param {int} size What size it should be
 */
function processImage(type, size) {
  return new Promise((resolve, reject) => {
    // Go through each glob depending on the type
    gulp.src(config.buildOptions.images[type],
      { base: config.buildOptions.project.source })
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
          quality: 75
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
          progressive: true,
          plugins: [
            whichPlugin[type]
          ]
        }
      );

      cb(null, file);
    }))
    .pipe(rename({
      suffix: `-${size}px`,
      extname: `.${type}`
    }))
    .pipe(gulp.dest(config.buildOptions.project.destination))
    .on('end', resolve);
  });
}

/**
 * Process all images asynchronously.
 *
 * @param {function} done
 */
function imageAssetsTask(done) {
  const imageSizes = config.buildOptions.images.sizes;

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

/**
 * Move all other assets.
 */
function otherAssetsTask() {
  return gulp.src(config.buildOptions.otherAssets, { base: config.buildOptions.project.source })
  .pipe(cache('assets-other', { optimizeMemory: true }))
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Generate favicons and move them to destination.
 */
function faviconTask() {
  return gulp.src(
    config.buildOptions.favicons.source,
    { base: config.buildOptions.project.source })
  .pipe(favicons(config.buildOptions.favicons.options))
    .on('error', notify.onError('Favicon generator error: <%= error.message %>'))
  .pipe(gulp.dest(config.buildOptions.favicons.destination))

  &&

  // Move favicon to destination root
  gulp.src(`${config.buildOptions.project.destination}/favicons/favicon.ico`, { allowEmpty: true })
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Move HTML and PHP files to destination while inlining SVG files.
 */
function htmlTask() {
  return gulp.src(config.buildOptions.pages, { base: config.buildOptions.project.source })
  .pipe(map(inlineSvgHTML()))
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Compile CSS to SCSS and compress
 */
function scssTask() {
  return gulp.src(
    `${config.buildOptions.project.source}/scss/style.scss`,
    { base: `${config.buildOptions.project.source}/scss`, allowEmpty: true })
  .pipe(gulpif(ENVIRONMENT === 'development', sourcemaps.init()))
  .pipe(scss({ outputStyle: 'compressed' }))
    .on('error', notify.onError('SCSS compile error: <%= error.message %>'))
  .pipe(autoprefixer({ overrideBrowserslist: config.buildOptions.scss.browserList }))
  .pipe(map(inlineSvgCSS()))
    .on('error', notify.onError('Inline SVG error: <%= error.message %>'))
  .pipe(csso())
  .pipe(gulpif(ENVIRONMENT === 'development', sourcemaps.write()))
  .pipe(gulp.dest(config.buildOptions.project.destination))
  .pipe(browserSync.stream());
}

/**
 * Inline external SVG into HTML.
 *
 * @param {*} file
 * @param {function} cb
 */
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
      if (fs.existsSync(path.join(config.buildOptions.project.source, svgPath))) {
        svgContents = fs.readFileSync(
          path.join(config.buildOptions.project.source, svgPath)
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
      } else {
        console.log(`Inline SVG in HTML: File: ${path.join(config.buildOptions.project.source, svgPath)} does not exist`);
      }
    }

    file.contents = Buffer.from(fileContents);
    return cb(null, file);
  }
}

/**
 * Inline SVG into CSS files.
 *
 * @param {*} file
 * @param {function} cb
 */
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

      if (fs.existsSync(path.join(config.buildOptions.project.source, svgPath))) {
        // Attempt to read the SVG file
        svgContents = fs.readFileSync(
          path.join(config.buildOptions.project.source, svgPath)
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

        // Format the interpolated and optimized SVG file as a data URI
        svgContents = (
          config.buildOptions.svgo.encode
            ? `url('data:image/svg+xml,${encodeURIComponent(svgContents.data)}')`
            : `url('data:image/svg+xml,charset=UTF-8,${svgContents.data}')`
        );

        // Replace the matched string with the data URI
        fileContents = fileContents.slice(0, urlMatch.index)
          + svgContents
          + fileContents.slice((urlMatch.index + urlMatch[0].length));

        urlPattern.lastIndex = (urlMatch.index + 1);
      } else {
        console.log(`Inline SVG in CSS: File: ${path.join(config.buildOptions.project.source, svgPath)} does not exist`);
      }
    }

    file.contents = Buffer.from(fileContents);
    return cb(null, file);
  }
}

/**
 * Compile javascript to ES5, minify and bundle script file.
 * Move javascript libraries to destination.
 */
function jsTask() {
  return rollup({
    input: config.buildOptions.javascript.source,
    plugins: [ terser() ]
  })
  .then(bundle => {
    return bundle.write({
      file: config.buildOptions.javascript.destination,
      format: 'iife',
      sourcemap: (ENVIRONMENT === 'development')
    });
  })

  &&

  // Move script libraries to destination.
  gulp.src(config.buildOptions.javascript.libs, { base: config.buildOptions.project.source, allowEmpty: true })
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Serve the website through BrowserSync with a PHP server.
 *
 * @param {function} done
 */
function serve(done) {
  connect.server({
    base: config.buildOptions.project.destination,
    port: parseInt(config.buildOptions.server.port) + 1,
    keepalive: true
  });

  browserSync.init({
    proxy: `127.0.0.1:${parseInt(config.buildOptions.server.port) + 1}`,
    port: config.buildOptions.server.port,
    open: true,
    notify: false
  });

  done();
}

/**
 * Default watch task for every relevant file for the project.
 */
function watchTask() {
  gulp.watch(
    config.buildOptions.images.jpg.concat(
      config.buildOptions.images.png
    ), gulp.series(imageAssetsTask, reload));

  gulp.watch(config.buildOptions.otherAssets, gulp.series(otherAssetsTask, htmlTask, reload));

  gulp.watch(config.buildOptions.pages, gulp.series(htmlTask, reload));

  gulp.watch(config.buildOptions.scss.source, scssTask);

  gulp.watch(
    config.buildOptions.javascript.source.concat(
      config.buildOptions.javascript.libs
    ), gulp.series(jsTask, reload));
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

// Deploy task
gulp.task('deploy',
  gulp.series(
    setDeployEnvironment,
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

// skipFavicons
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

// skipImageAssets
gulp.task('skipImageAssets',
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
