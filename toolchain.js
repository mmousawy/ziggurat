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

// Base packages
const gulp         = require('gulp');
const fs           = require('fs');
const del          = require('del');
const path         = require('path');
const argv         = require('yargs').argv;
const chalk        = require('chalk');
const execFile     = require('child_process').execFile;
const readline     = require('readline');
const through2     = require('through2');

// ASCII flair
console.log(chalk.hex('#9B4E55').bold(`      _                         __
 ___ (_)__ ____ ___ _________ _/ /_
/_ // / _ \`/ _ \`/ // / __/ _ \`/ __/
/__/_/\\_, /\\_, /\\_,_/_/  \\_,_/\\__/
     /___//___/
`));

/**
 * Load the gulp config.
 */
const base = path.resolve((argv.project || '.'));

process.cwd(base);

const configLocation = path.join(base, 'ziggurat-config.json');

if (!fs.existsSync(configLocation)) {
  console.error(chalk.red(`[Ziggurat] No config file found in project folder (${configLocation})`));
  process.exit(5);
}

const config = require(configLocation);
config.buildOptions.project.source = path.join(base, config.buildOptions.project.source);
config.buildOptions.project.destination = path.join(base, config.buildOptions.project.destination);

// Gulp helper packages
const notify       = require('gulp-notify');
const cache        = require('gulp-cached');
const gulpif       = require("gulp-if");
const rename       = require('gulp-rename');
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
const pngquant     = require('pngquant-bin');
const favicons     = require('gulp-favicons');

// Development server packages
const connect      = require('gulp-connect-php');
const browserSync  = require('browser-sync').create();

// Initialize SVGO
const SVGO = require('svgo');
const svgo = new SVGO(config.svgo || {});
let ENVIRONMENT = 'development';

/**
 * Helper function to log progress.
 * @param {*} progress
 */
function printProgress(progress, text){
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0, null);
  process.stdout.write(`${parseFloat(progress).toFixed(2)}% - ${text}`);
}

/**
 * Create resolved source paths from config.
 *
 * @param {string|array} location
 * @param {string} prefix
 */
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
        src = src.substr(1);
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

/**
 * Create concatenated source paths from config.
 *
 * @param {string|array} location
 * @param {string} prefix
 */
function concatSource(location, prefix) {
  if (typeof location === 'string') {
    let not = '';

    if (location.indexOf('!') === 0) {
      not = '!';
      location = location.substr(1);
    }

    return `${not}${prefix || config.buildOptions.project.source}/${location}`;

  } else if (location instanceof Array) {
    return location.map(src => {
      let not = '';

      if (src.indexOf('!') === 0) {
        not = '!';
        src = src.substr(1);
      }

      return `${not}${prefix || config.buildOptions.project.source}/${src}`;
    });
  }

  console.error(chalk.red(`[Ziggurat] Could not join source for: ${location}`));

  return false;
}

/**
 * This file contains all the individual tasks for the following gulp tasks:
 *
 *  npm run watch [default]
 *    Clean, build and watch for changes.
 *
 *  npm run watch:skipImages
 *    Don't clean, build but skip image optimization and watch for changes.
 *
 *  npm run watch:production
 *    Clean, build for production (no sourcemaps, optimize images) and watch for changes.
 *
 *  npm run watch:production:skipImages
 *    Don't clean, build for production but skip image optimization and watch for changes.
 *
 *  npm run build [default]
 *    Clean, build.
 *
 *  npm run build:skipImages
 *    Don't clean, build but skip image optimization.
 *
 *  npm run build:production
 *    Clean, build for production (no sourcemaps, optimize images).
 *
 *  npm run build:production:skipImages
 *    Don't clean, build for production but skip image optimization.
 */

/**
 * Set the environment variable.
 *
 * @param {string} env
 */
function setProductionEnvironment(done) {
  console.info(chalk.cyan(`[Ziggurat] Setting environment to PRODUCTION`));
  ENVIRONMENT = 'production';

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
async function cleanTask() {
  await del(config.buildOptions.project.destination);
  await fs.mkdirSync(config.buildOptions.project.destination);

  console.info(chalk.cyan(`[Ziggurat] Done cleaning destination: ${config.buildOptions.project.destination}`));

  return;
}

/**
 * Process all images: resize and compress.
 *
 * @param {function} done
 */
async function imageAssetsTask(done) {
  console.info(chalk.cyan(`[Ziggurat] Processing images...`));

  let imageCount = 0;
  let imageIndex = 0;

  // Count all files
  await Promise.all(config.buildOptions.images.map(imageSrcObject => {
    return new Promise(resolve => {
      gulp.src(concatSource(imageSrcObject.source), {
        base: config.buildOptions.project.source,
        allowEmpty: true
      })
      .pipe(through2.obj((file, enc, cb) => {
        imageCount++;

        cb();
      },
      // Flush
      (cb) => {
        resolve();
        cb();
      }))
    });
  }));

  await Promise.all(config.buildOptions.images.map(imageSrcObject =>
    new Promise(resolve => {
      gulp.src(concatSource(imageSrcObject.source), {
        base: config.buildOptions.project.source,
        allowEmpty: true
      })
      .pipe(cache('assets-images', { optimizeMemory: true }))
      .pipe(map(async (file, cb) => {
        printProgress((imageIndex / imageCount) * 100, `Processing image ${(imageIndex + 1)}/${imageCount} [${path.relative(config.buildOptions.project.source, file.path)}]`);

        await processImage(file, imageSrcObject);

        imageIndex++;

        cb();
      }))
      .on('end', () => {
        resolve();
      });
    })
  ));

  printProgress(100, `Done processing ${imageCount} images!\n`);

  return done();
}

async function processImage(file, imageSrcObject) {
  const extName = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp'
  };

  const relativePath = path.dirname(file.path.replace(path.resolve(config.buildOptions.project.source), ''));
  const fileExt = path.extname(file.path);
  const fileNameNoExt = path.basename(file.path, fileExt);

  // Make dir if it doesn't exit
  fs.mkdirSync(path.resolve(path.join(config.buildOptions.project.destination, relativePath)), { recursive: true });

  // Load the image in a Sharp instance
  const sharpImage = sharp(file.contents);

  // For each size
  const sizePromises = imageSrcObject.sizes.map(size =>
    new Promise(resolveSize => {

      // Resize image
      const sharpImageResized = sharpImage
      .resize({
        width: size,
        withoutEnlargement: true
      });

      // Now convert and save each resized image for each image type (size x type)
      const typePromises = Object.entries(imageSrcObject.types).map(([imageType, imageOptions]) =>
        new Promise(resolveFormat => {
          let newFileName = fileNameNoExt;

          // Remove underscore prefix for images being converted to another image format
          if (newFileName.charAt(0) === '_' && fileExt !== extName[imageType]) {
            newFileName = newFileName.substr(1);
          }

          const fileName = `${newFileName}-${size}px${extName[imageType]}`;
          const outputFilePath = path.resolve(path.join(config.buildOptions.project.destination, relativePath, fileName));

          // Take the resized image
          sharpImageResized
          // Convert to different type
          [imageType](imageOptions || {})
          // Save image to file
          .toFile(outputFilePath)
          // If in production, run pngquant to minify png images
          .then(info => {
            if (ENVIRONMENT === 'production' && imageType === 'png') {
              execFile(pngquant, [
                '--quality', `${imageOptions.quality[0]}-${imageOptions.quality[1]}`,
                '--skip-if-larger',
                '--verbose',
                '-f',
                '-o', outputFilePath,
                outputFilePath
              ], (err) => {
                resolveFormat();
              });
            } else {
              // Otherwise just resolve
              resolveFormat();
            }
          });
        })
      );

      return Promise.all(typePromises).then(resolveSize);
    })
  );

  await Promise.all(sizePromises);
}

/**
 * Move all other assets.
 */
function otherAssetsTask() {
  console.info(chalk.cyan(`[Ziggurat] Copying other assets...`));

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
  console.info(chalk.cyan(`[Ziggurat] Starting favicon task...`));

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
  .pipe(map(replaceVariables()))
  .pipe(gulp.dest(config.buildOptions.project.destination));
}

/**
 * Replace variables in HTML.
 *
 * @param {*} file
 * @param {function} cb
 */
function replaceVariables(file, cb) {
  return async (file, cb) => {
    let fileContents = file.contents.toString('utf8');

    fileContents = fileContents.replace('%__VERSION__%', Math.round((new Date()).getTime() / 1000));

    file.contents = Buffer.from(fileContents);
    return cb(null, file);
  }
}

/**
 * Compile CSS to SCSS and compress
 */
function scssTask() {
  console.info(chalk.cyan(`[Ziggurat] Compiling SCSS...`));

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
    const urlPattern = /<img\s?(.+)?\ssrc="inline:([^"]+\/.+svg)"([^>]+)?>/gmi;
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
        console.log(chalk.red(`[Ziggurat]: Inline SVG in HTML: File: ${path.join(config.buildOptions.project.source, svgPath)} does not exist`));
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
  console.info(chalk.cyan(`[Ziggurat] Compiling JS...`));

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
  let imgSources = [];

  config.buildOptions.images.forEach(imageSrcObject => imgSources = imgSources.concat(imageSrcObject.source));

  gulp.watch(imgSources,
    { cwd: config.buildOptions.project.source },
    gulp.series(imageAssetsTask, reload));

  gulp.watch(config.buildOptions.otherAssets.source,
    { cwd: config.buildOptions.project.source },
    gulp.series(otherAssetsTask, htmlTask, reload));

  gulp.watch(config.buildOptions.pages,
    { cwd: config.buildOptions.project.source },
    gulp.series(htmlTask, reload));

  gulp.watch(config.buildOptions.scss.watch,
    { cwd: config.buildOptions.project.source },
    scssTask);

  gulp.watch(config.buildOptions.javascript.watch,
    { cwd: config.buildOptions.project.source },
    gulp.series(jsTask, reload));
}

/**
 * watch task
 */
gulp.task('watch',
  gulp.series(
    cleanTask,
    otherAssetsTask,
    imageAssetsTask,

    gulp.parallel(
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

/**
 * watch:production task
 */
gulp.task('watch:production',
  gulp.series(
    setProductionEnvironment,
    cleanTask,
    otherAssetsTask,
    imageAssetsTask,
    faviconTask,

    gulp.parallel(
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

/**
 * watch:skipImages task
 */
gulp.task('watch:skipImages',
  gulp.series(
    cleanTask,
    otherAssetsTask,

    gulp.parallel(
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

/**
 * watch:production:skipImages task
 */
gulp.task('watch:production:skipImages',
  gulp.series(
    setProductionEnvironment,
    cleanTask,
    otherAssetsTask,

    gulp.parallel(
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

/**
 * build task
 */
gulp.task('build',
  gulp.series(
    cleanTask,
    otherAssetsTask,
    imageAssetsTask,

    gulp.parallel(
      htmlTask,
      scssTask,
      jsTask
    )
  )
);

/**
 * build:production task
 */
gulp.task('build:production',
  gulp.series(
    setProductionEnvironment,
    cleanTask,
    otherAssetsTask,
    imageAssetsTask,
    faviconTask,

    gulp.parallel(
      htmlTask,
      scssTask,
      jsTask
    )
  )
);

/**
 * build:skipImages task
 */
gulp.task('build:skipImages',
  gulp.series(
    cleanTask,
    otherAssetsTask,

    gulp.parallel(
      htmlTask,
      scssTask,
      jsTask
    )
  )
);

/**
 * build:production:skipImages task
 */
gulp.task('build:production:skipImages',
  gulp.series(
    setProductionEnvironment,
    cleanTask,
    otherAssetsTask,

    gulp.parallel(
      htmlTask,
      scssTask,
      jsTask
    )
  )
);
