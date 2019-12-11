# Using Ziggurat Toolchain
The Toolchain will provide you with an automated development server to run your project in. It will build certain files, watch for changes and move/copy all the project files.


## Running the toolchain
To run the Ziggurat Toolchain, you can run the npm script called `ziggurat`. This will automatically spin up the build script and the watch server.

```bash
$ npm run ziggurat
```


## Toolchain steps
Depending on whether you have provided locations for the processes below, the build step will try to do the following:

- __Build__
    - __JavaScript__: Bundle, minify, mangle, move
    - __SCSS__: Bundle, compile to CSS, minify
    - __Images__: Multiple resizing, compress
    - __SVG__: Compress, inline into HTML & CSS

- __Move__
    - Move the built files and copy other project files to destination folder.

- __Watch__
    - Watch for changes in the project folder and __re-build changed files__ depending on what type they are, __replace the changed files__ in the destination folder and __refresh the browser__.

- __Serve__
    - Spins up a PHP server, proxied behind a BrowserSync instance to run and serve your project. Will automatically refresh your browser when there's a change.


## Arguments & flags
You can provide a single optional modifier to run the Ziggurat Toolchain with a specific build process.


```bash
$ npm run watch[:modifier] [-- --flag <value>]

$ npm run watch
# Clean, build and watch for changes.

$ npm run watch:skipImages
# Don't clean, build but skip image optimization and watch for changes.

$ npm run watch:production
# Clean, build for production (no sourcemaps, optimize images) and watch for changes.

$ npm run watch:production:skipImages
# Don't clean, build for production but skip image optimization and watch for changes.

$ npm run build [default]
# Clean, build.

$ npm run build:skipImages
# Don't clean, build but skip image optimization.

$ npm run build:production
# Clean, build for production (no sourcemaps, optimize images).

$ npm run build:production:skipImages
# Don't clean, build for production but skip image optimization.
```

### Flags
To add a flag, you have to type double dashes `--` after the build process. The `--project` flag is required.

```bash
$ npm run watch -- --project your-project/
```

### Production mode
For your final build, you can choose to run the `watch` or `build` process with the `production` modifier.

```bash
$ npm run watch:production -- --project your-project/
$ npm run build:production -- --project your-project/
```

### Debug mode
To run Ziggurat in verbose mode, start Ziggurat in debug mode:

```bash
$ npm run watch:debug -- --project your-project/
```


## Configuration
For the toolchain, you are required to have a config file named `ziggurat-config.json` in the root of your project folder.

Here's an example of how the config should look like:

```json
{
  "buildOptions": {
    "project": {
      "source": "src",
      "destination": "dist"
    },
    "server": {
      "port": 5050
    },
    "pages": [
      "/**/*.php"
    ],
    "scss": {
      "source": "scss/style.scss",
      "watch": "scss/**/*.scss",
      "base": "scss",
      "destination": "/",
      "browserList": "last 1 version, chrome > 70, not dead"
    },
    "javascript": {
      "source": "script/script.js",
      "destination": "script.min.js",
      "libs": "script/lib/*.js"
    },
    "images": {
      "jpg": [
        "assets/img/**/*.jpg"
      ],
      "png": [
        "assets/img/**/*.png"
      ],
      "sizes": {
        "jpg": [
          512,
          1024
        ],
        "png": [
          512,
          1024,
          1920
        ]
      }
    },
    "svgo": {
      "encode": true
    },
    "favicons": {
      "source": "favicon.png",
      "destination": "favicons",
      "options": {
        "path": "/favicons/",
        "appName": "My project",
        "appShortName": "My project",
        "appDescription": "Example project"
      }
    },
    "otherAssets": {
      "source": [
        "robots.txt",
        "humans.txt"
      ]
    }
  }
}
```
