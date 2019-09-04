# Using Ziggurat Core
The core of Ziggurat is meant to route all URL requests to indexed pages. It will automatically route sluggified _pretty URLs_ to the right pages. You can also use templating for reusing header and footer files. Markdown support is built-in.


## 1. Including Ziggurat Core
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


## 2. Indexing pages
You are required to index your project's pages after initializing Ziggurat. This must happen on every page request since indexing is __not__ cached by default.

!> Optionally, you can choose to cache the page index by providing the `enable_cache` option to Ziggurat. The caching process happens every time you call the `index()` method, so only call the `index()` method when there are changes. Ziggurat will attempt to save the cache in an SQLite database, and fall back to a JSON format


```php
$Ziggurat->index();
```


## 3. Resolving a URL
Ziggurat does not resolve URLs for you. You can provide the current `REQUEST_URI` to the resolve method to search for and fetch the current page.

```php
$resolvedPage = $Ziggurat->resolve($_SERVER['REQUEST_URI']);
```


## 4. Rendering the resolved page
To render the resolved page, you can use the `render` method. To return the fully rendered page as a string instead of directly printing the result, you can optionally add `false` as the second parameter.

```php
// Print the page directly
$Ziggurat->render($resolvedPage);

// Return the page as a string
$rendered = $Ziggurat->render($resolvedPage, false);
```
