# Using Ziggurat Toolchain

The Toolchain will provide you with an automated development server to run your project in. It will build certain files, watch for changes and move/copy all the project files.

## Running the toolchain
By running Ziggurat, you will automatically run the toolchain.

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


### Ziggurat toolchain arguments
You can provide a single optional argument to run the Ziggurat Toolchain with a specific build process.

```bash
$ npm run ziggurat [args]

$ npm run ziggurat
# Default. Clean, build and watch for changes for all files.

$ npm run ziggurat deploy
# Clean, build for deployment (no sourcemaps) and watch for changes for all files.

$ npm run ziggurat skipFavicons
# Clean, build but skip favicons generation and watch for changes for all files.

$ npm run ziggurat skipImageAssets
# Don't clean, build but skip generating favicons and images, watch for all files.
```


## Configuration
You can manually override file locations and build options by editing `ziggurat-config.json`.

```json
{
  "buildOptions": {
    "project": {
      "source": "src/",
      "destination": "examples/murtada.nl-ziggurat/dist"
    },
    "server": {
      "port": 5050
    },
    "pages": [
      "examples/murtada.nl-ziggurat/src/**/*.php"
    ],
    "scss": {
      "source": "examples/murtada.nl-ziggurat/src/scss/style.scss",
      "watch": "examples/murtada.nl-ziggurat/src/scss/**/*.scss",
      "base": "examples/murtada.nl-ziggurat/src/scss",
      "destination": "examples/murtada.nl-ziggurat/dist/",
      "browserList": "last 1 version, chrome > 70, not dead"
    },
    "javascript": {
      "source": "examples/murtada.nl-ziggurat/src/script/script.js",
      "destination": "examples/murtada.nl-ziggurat/dist/script.min.js",
      "libs": "examples/murtada.nl-ziggurat/src/script/lib/*.js"
    },
    "images": {
      "jpg": [
        "examples/murtada.nl-ziggurat/src/assets/images/**/*.{jpg,png}",
        "!examples/murtada.nl-ziggurat/src/assets/images/**/_*.png",
        "!examples/murtada.nl-ziggurat/src/assets/images/duotone.jpg"
      ],
      "png": [
        "examples/murtada.nl-ziggurat/src/assets/images/**/_*.png"
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
      "source": "examples/murtada.nl-ziggurat/src/favicon.png",
      "destination": "examples/murtada.nl-ziggurat/dist/favicons",
      "options": {
        "path": "/favicons/",
        "appName": "Murtada.nl website",
        "appShortName": "Murtada.nl",
        "appDescription": "Personal portfolio and blog of Murtada al Mousawy"
      }
    },
    "otherAssets": [
      "examples/murtada.nl-ziggurat/src/robots.txt",
      "examples/murtada.nl-ziggurat/src/humans.txt",
      "examples/murtada.nl-ziggurat/src/assets/**/*",
      "!examples/murtada.nl-ziggurat/src/assets/**/*.{fla,jpg,png,psd,ai}",
      "!examples/murtada.nl-ziggurat/src/assets/**/_*.svg",
      "examples/murtada.nl-ziggurat/src/assets/**/duotone.jpg",
      "examples/murtada.nl-ziggurat/src/assets/**/duotone.webp"
    ]
  }
}
```
