![Ziggurat logo](https://raw.githubusercontent.com/mmousawy/ziggurat/master/ziggurat-logo-type.svg?sanitize=true)

---


## What is Ziggurat?

A complete development toolchain for building websites including a simple dynamic site router with Markdown support written in Node and PHP.


## Features

**Ziggurat core**:
- Templating using PHP
- Hierarchical page organisation
- Page indexing and caching
- Basic HTML minification
- Output compression using [Zlib](https://www.php.net/manual/en/book.zlib.php)
- Markdown in pages or posts with the help of [Parsedown](https://github.com/parsedown/parsedown)
- Lazy loading image ratio calculation for `padding-top` trick

**Development tools**:
- Live server with PHP support using [BrowserSync](https://github.com/BrowserSync/browser-sync) and [gulp-connect-php](https://github.com/micahblu/gulp-connect-php)
- SCSS to CSS prefixing and compilation using [Autoprefixer](https://github.com/postcss/autoprefixer) and [node-sass](https://github.com/sass/node-sass)
- ES6 uglification and transpilation to ES5 using [Terser](https://github.com/terser-js/terser) and [Babel](https://github.com/babel/babel)
- SVG inlining (for SCSS and HTML)


## To do

- [ ] Better configurability with config.json
- [ ] Favicon generation
- [ ] Custom page type handling
- [ ] Automatic pages/posts list
- [ ] Deployment integration?
- [ ] Hook for custom templating engine?


## Done

- [x] Add example project (added on: 2019-04-20)
