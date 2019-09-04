# Using Ziggurat Core
The core of Ziggurat is meant to route all URL requests to indexed pages. It will automatically route sluggified _pretty URLs_ to the right pages. You can also use templating for reusing header and footer files. Markdown support is built-in.


## Including Ziggurat Core
You can initialize the core by requiring the Ziggurat class file, instantiating the class and optionally providing options for your own needs.

```php
require_once "./lib/MMousawy/Ziggurat.php"

$zigguratOptions = [
  'pages_dir' => './pages',
  'template' => './template',
  '404' => '404',
  'error' => 'error',
  'database' => '../ziggurat-cache.db',
  'enable_cache' => true,
  'minify_html' => true
];

$Ziggurat = new \MMousawy\Ziggurat($zigguratOptions);

```


## Indexing pages
You are required to index your project's pages after initializing Ziggurat. This must happen on every page request since indexing is __not__ cached by default.

!> Optionally, you can choose to cache the page index by providing the `enable_cache` option to Ziggurat. The caching process happens every time you call the `index()` method, so only call the `index()` method when there are changes. Ziggurat will attempt to save the cache in an SQLite database, and fall back to a JSON format


```php
$Ziggurat->index();
```

### Page properties
In order for Ziggurat to correctly index your pages, you should provide Ziggurat properties at the top of every page like so:

```php
<?php
#zigg:title       = `` (Page title)
#zigg:slug        = `` (Unique page identifier, lowercase no spaces or special characters)
#zigg:priority    = `` (0.0 to 1.0 for XML sitemap page priority)
#zigg:order       = `` (Integer to provide page order)
#zigg:type        = `` ("markdown" or omit)
#zigg:template    = `` (PHP filename from project root)
#zigg:parent      = `` (Parent slug)
#zigg:cover-image = `` (Image cover URL for the current page)
#zigg:date        = `` (Date in YYYY-MM-DD format, used for ordering)
#zigg:ignore           (Ignore this page when indexing)
?>
```

You can add custom properties that can be read out and indexed by Ziggurat for you to use in your website. See the examples in the GitHub repo for more.


## Resolving a URL
Ziggurat does not resolve URLs for you. You can provide the current `REQUEST_URI` to the resolve method to search for and fetch the current page.

```php
$resolvedPage = $Ziggurat->resolve($_SERVER['REQUEST_URI']);
```


## Rendering the resolved page
To render the resolved page, you can use the `render` method. To return the fully rendered page as a string instead of directly printing the result, you can optionally add `false` as the second parameter.

```php
// Print the page directly
$Ziggurat->render($resolvedPage);

// Return the page as a string
$rendered = $Ziggurat->render($resolvedPage, false);
```
