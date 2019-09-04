![Ziggurat logo](https://raw.githubusercontent.com/mmousawy/ziggurat/master/ziggurat-logo-type.svg?sanitize=true)

---


## What is Ziggurat?

A complete development toolchain with dynamic site routing and Markdown support for PHP websites.


## Features

**Ziggurat core**:
- Templating using PHP
- Hierarchical page organisation
- Simple page routing
- Page list querying (for listing sub-pages)
- Page indexing and caching (using [SQLite3](https://github.com/mackyle/sqlite), with JSON plaintext fallback)
- Basic HTML minification
- Output compression using [Zlib](https://www.php.net/manual/en/book.zlib.php)
- Markdown in pages with the help of [Parsedown](https://github.com/parsedown/parsedown)
- Lazy loading image ratio calculation for `padding-top` trick
- Automatic sitemap generator

**Development tools**:
- Live server with PHP support using [BrowserSync](https://github.com/BrowserSync/browser-sync) and [gulp-connect-php](https://github.com/micahblu/gulp-connect-php)
- SCSS to CSS prefixing and compilation using [Autoprefixer](https://github.com/postcss/autoprefixer) and [node-sass](https://github.com/sass/node-sass)
- ES6 uglification and transpilation to ES5 using [Rollup](https://github.com/rollup/rollup) and [Terser](https://github.com/terser-js/terser)
- SVG inlining (for SCSS and HTML)
- Automatic image resizing through [gulp-responsive](https://github.com/mahnunchik/gulp-responsive)
- Favicons/manifest generation using [Favicons](https://github.com/itgalaxy/favicons)


## To do

- [ ] Deployment integration?
- [ ] Hook for custom templating engine?


## Done

- [x] Automatic pages/posts list (done: 2019-04-19)
- [x] Add example project (done: 2019-04-20)
- [x] Favicon generation (done: 2019-04-21)
- [x] Generate sitemap automatically (done: 2019-05-04)
- [x] Better configurability with config.json (done: 2019-08-28)
- [x] Custom page status handling for error and 404 pages (done: 2019-08-29)
