# Ziggurat
---
> A complete development toolchain with dynamic site routing and Markdown support for PHP websites.


## What is Ziggurat?
Ziggurat consists of two parts:
1. __Ziggurat Core__: a PHP-based URL router that reads specific metadata in PHP files to index and create a dynamic page structure. The core also provides other features like templating, listing child-pages and built-in Markdown support.
2. __Ziggurat Toolchain__: a Node-based toolchain that utilizes Gulp to compile and generate a deployment-ready build of the website.


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

**Ziggurat toolchain**:
- Live server with PHP support using [BrowserSync](https://github.com/BrowserSync/browser-sync) and [gulp-connect-php](https://github.com/micahblu/gulp-connect-php)
- SCSS to CSS prefixing and compilation using [Autoprefixer](https://github.com/postcss/autoprefixer) and [node-sass](https://github.com/sass/node-sass)
- ES6 uglification and transpilation to ES5 using [Rollup](https://github.com/rollup/rollup) and [Terser](https://github.com/terser-js/terser)
- SVG inlining (for SCSS and HTML)
- Automatic image resizing through [gulp-responsive](https://github.com/mahnunchik/gulp-responsive)
- Favicons/manifest generation using [Favicons](https://github.com/itgalaxy/favicons)


## Example
There are a few examples on in the [examples folder of Ziggurat GitHub repo](https://github.com/mmousawy/ziggurat/tree/master/example). To see Ziggurat in action you can take a look at [my personal website](https://murtada.nl).


## Donate
Please consider donating if you think Ziggurat is helpful to you or that my work is valuable. I am happy if you can [help me buy a cup of coffee](https://paypal.me/MalMousawy). ☕️
