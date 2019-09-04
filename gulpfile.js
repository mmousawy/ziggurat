/**
 * Ziggurat Core.
 *
 * A PHP-based URL router that reads specific metadata in PHP files to index and create
 * a dynamic page structure. The core also provides other features like templating,
 * listing child-pages and built-in Markdown support.
 *
 * @author  Murtada al Mousawy <https://murtada.nl>
 * @link    https://github.com/mmousawy/ziggurat
 * @license MIT
 */

/**
 * This file contains all the individual tasks for the following gulp tasks:
 *
 *  npm run ziggurat [default]
 *    Clean, build and watch for changes for all files.
 *
 *  npm run ziggurat deploy
 *    Clean, build for deployment (no sourcemaps) and watch for changes for all files.
 *
 *  npm run ziggurat skipFavicons
 *    Clean, build but skip favicons generation and watch for changes for all files.
 *
 *  npm run ziggurat skipImageAssets
 *    Don't clean, build but skip generating images, watch for all files.
 */

// Base packages
const gulp         = require('gulp');
const fs           = require('fs');
const del          = require('del');
const path         = require('path');
const argv         = require('yargs').argv;
const chalk        = require('chalk');

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
const base = path.resolve((argv.project || '.'));

process.cwd(base);

const configLocation = path.join(base, '/ziggurat-config.json');

if (!fs.existsSync(configLocation)) {
  console.error(chalk.red(`[Ziggurat] No config file found in project folder (${configLocation})`));
  process.exit(1);
}

const config = require(path.join(base, '/ziggurat-config.json'));
config.buildOptions.project.source = path.resolve(base, config.buildOptions.project.source);
config.buildOptions.project.destination = path.resolve(base, config.buildOptions.project.destination);

// Initialize SVGO
const SVGO = require('svgo');
const svgo = new SVGO(config.svgo || {});
let ENVIRONMENT = 'development';

function createSource(location, prefix) {
  if (typeof location === 'string') {
    return path.join(
      prefix || config.buildOptions.project.source,
      location
    );
  } else if (location instanceof Array) {
    return location.map(src => {
      let not = '';

      if (src.indexOf('!') === 0) {
        not = '!';
      }

      return not + path.join(
        prefix || config.buildOptions.project.source,
        src
      );
    });
  }

  console.error(chalk.red(`[Ziggurat] Could not create source for: ${location}`));

  return false;
}

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
    gulp.src(createSource(config.buildOptions.images[type]),
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
  const source = createSource(config.buildOptions.otherAssets.source);

  return gulp.src(source, {
    base: config.buildOptions.project.source,
    allowEmpty: true
  })
  .pipe(cache('assets-other', { optimizeMemory: true }))
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Generate favicons and move them to destination.
 */
function faviconTask() {
  return gulp.src(
    createSource(config.buildOptions.favicons.source),
    { base: config.buildOptions.project.source,
      allowEmpty: true })
  .pipe(favicons(config.buildOptions.favicons.options))
    .on('error', notify.onError('Favicon generator error: <%= error.message %>'))
  .pipe(gulp.dest(path.join(config.buildOptions.project.destination, config.buildOptions.favicons.options.path)))

  &&

  // Move favicon to destination root
  gulp.src(path.join(config.buildOptions.project.destination, '/favicons/favicon.ico'), { allowEmpty: true })
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Move HTML and PHP files to destination while inlining SVG files.
 */
function htmlTask() {
  return gulp.src(createSource(config.buildOptions.pages), { base: config.buildOptions.project.source })
  .pipe(map(inlineSvgHTML()))
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Compile CSS to SCSS and compress
 */
function scssTask() {
  return gulp.src(
    createSource(config.buildOptions.scss.source),
    { base: createSource(config.buildOptions.scss.base), allowEmpty: true })
  .pipe(gulpif(ENVIRONMENT === 'development', sourcemaps.init()))
  .pipe(scss({ outputStyle: 'compact' }))
    .on('error', notify.onError('SCSS compile error: <%= error.message %>'))
  .pipe(autoprefixer({ overrideBrowserslist: config.buildOptions.scss.browserList }))
  .pipe(map(inlineSvgCSS()))
    .on('error', notify.onError('Inline SVG error: <%= error.message %>'))
  .pipe(csso())
  .pipe(gulpif(ENVIRONMENT === 'development', sourcemaps.write('.')))
  .pipe(gulp.dest(createSource(config.buildOptions.scss.destination, config.buildOptions.project.destination)))
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
    input: createSource(config.buildOptions.javascript.source),
    plugins: [ terser() ]
  })
  .then(bundle => {
    return bundle.write({
      file: createSource(config.buildOptions.javascript.destination, config.buildOptions.project.destination),
      format: 'iife',
      sourcemap: (ENVIRONMENT === 'development')
    });
  })
  .catch(error => {
    notify.onError('Could not compile JS: <%= error.message %>')
  })

  &&

  // Move script libraries to destination.
  gulp.src(createSource(config.buildOptions.javascript.libs), { base: config.buildOptions.project.source, allowEmpty: true })
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Serve the website through BrowserSync with a PHP server.
 *
 * @param {function} done
 */
function serve(done) {
  const source = path.resolve(config.buildOptions.project.destination);

  console.log(chalk.green(`[Ziggurat]: Now serving from: ${source}`));

  if (!fs.existsSync(source)) {
    return false;
  }

  connect.server({
    base: source,
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
    createSource(config.buildOptions.images.jpg.concat(
      config.buildOptions.images.png
    )), gulp.series(imageAssetsTask, reload));

  gulp.watch(createSource(config.buildOptions.otherAssets.source), gulp.series(otherAssetsTask, htmlTask, reload));

  gulp.watch(createSource(config.buildOptions.pages), gulp.series(htmlTask, reload));

  gulp.watch(createSource(config.buildOptions.scss.watch), scssTask);

  gulp.watch(
    createSource(config.buildOptions.javascript.source.concat(
      config.buildOptions.javascript.libs
    )), gulp.series(jsTask, reload));
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
console.log(`      _                         __
 ___ (_)__ ____ ___ _________ _/ /_
/_ // / _ \`/ _ \`/ // / __/ _ \`/ __/
/__/_/\\_, /\\_, /\\_,_/_/  \\_,_/\\__/
     /___//___/
`);
