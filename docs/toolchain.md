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
You can provide a single optional argument to run the Ziggurat Toolchain with a specific build process.

```bash
$ npm run ziggurat [args] [-- --flag <value>]

$ npm run ziggurat
# Default. Clean, build and watch for changes for all files.

$ npm run ziggurat deploy
# Clean, build for deployment (no sourcemaps) and watch for changes for all files.

$ npm run ziggurat skipFavicons
# Clean, build but skip favicons generation and watch for changes for all files.

$ npm run ziggurat skipImageAssets
# Don't clean, build but skip generating favicons and images, watch for all files.
```

### Flags
To add a flag, you have to type double dashes `--` after the argument list. The `--project` flag is required.

```bash
$ npm run ziggurat -- --project your-project/
```

### Debug mode
To have more verbosity from Ziggurat, you can run Ziggurat in debug mode:

```bash
$ npm run ziggurat-debug [args] [-- --flag <value>]
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
