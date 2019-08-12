<?php

namespace MMousawy;

require '../../../Parsedown/Parsedown.php';

class Ziggurat
{
  private $base_dir;
  private $pages_dir;
  private $pages;
  private $minify;
  private $Parsedown;
  private $options;
  private $xmlSiteMapSchema = 'http://www.sitemaps.org/schemas/sitemap/0.9';

  public $imageSizes = [
    'small' => 512,
    'medium' => 1024,
    'large' => 1920
  ];

  public $resolvedPage;

  function __construct(array $options = [])
  {
    $this->pages = [];
    $this->Parsedown = new \Parsedown();

    $this->options = [
      'base_dir' => '.',
      'pages_dir' => './pages',
      'template' => './template',
      'enable_cache' => false,
      'minify_html' => false
    ];

    $this->options = array_replace_recursive($this->options, $options);

    $this->loadTemplate($options['template']);

    if ($this->options['enable_cache'] === true) {
      $this->loadCache();
    }
  }


  public function index(): bool
  {
    if (!is_dir($this->options['pages_dir'])) {
      return false;
    }

    $directory = new \RecursiveDirectoryIterator($this->options['pages_dir']);
    $iterator = new \RecursiveIteratorIterator($directory);
    $regex = new \RegexIterator($iterator, '/^.+\.php$/i', \RecursiveRegexIterator::GET_MATCH);

    $this->pages = [];

    foreach ($regex as $file) {
      $page = [
        'path' => null,
        'properties' => []
      ];

      $page['path'] = $file[0];

      $fileContents = file_get_contents($page['path']);

      // Read out file metadata
      // Match any string that has the following pattern:
      // #zigg:property = `value`
      $pattern = '/#\s*zigg\s*:\s*([a-zA-Z0-9-_]+)\s*=\s*`([^`]+)/m';
      preg_match_all($pattern, $fileContents, $matches, PREG_SET_ORDER);

      foreach ($matches as $match) {
        if ($match[1] === 'ignore') {
          $page['properties'][$match[1]] = $match[2];
          array_push($this->pages, $page);

          continue 2;

        } else if ($match[1] === 'cover-image') {
          $page['properties'][$match[1]] = [];

          if (strpos($match[2], '{$size}')) {
            $coverImage = explode('{$size}', $match[2]);
          }

          foreach($this->imageSizes as $label => $pixels) {
            $imageUrl = [
              'url' => "assets/images/{$coverImage[0]}-{$pixels}px{$coverImage[1]}",
              'size' => $pixels
            ];

            if (file_exists($imageUrl['url'])) {
              $page['properties'][$match[1]][$label] = $imageUrl;
            }
          }
        } else {
          $page['properties'][$match[1]] = $match[2];
        }
      }

      array_push($this->pages, $page);
    }

    usort($this->pages, function($item1, $item2) {
      if (empty($item1['properties']['date'])) {
        return false;
      }

      if (empty($item2['properties']['date'])) {
        return true;
      }

      return $item2['properties']['date'] <=> $item1['properties']['date'];
    });

    foreach ($this->pages as &$page) {
      $page['slug-path'] = $this->resolveSlugPath($page);
      $page['ancestors'] = explode('/', $page['slug-path']);

      if ($this->options['enable_cache'] === true
          && isset($this->options['ignore'])
          && $this->options['ignore'] !== 'true') {
        $page['html'] = $this->render($page, true);
      }
    }

    if ($this->options['enable_cache'] === true) {
      $this->saveCache();
    }

    $this->generateSiteMap();

    return true;
  }


  public function saveCache(): bool
  {
    $cacheString = json_encode($this->pages);

    if (file_put_contents('ziggurat-cache.json.php', $cacheString) === false) {
      return false;
    }

    return true;
  }


  public function loadCache(): bool
  {
    // TODO: Check if cache is valid
    if (!file_exists('ziggurat-cache.json.php')) {
      return false;
    }

    $this->pages = json_decode(file_get_contents('ziggurat-cache.json.php'), true);

    return true;
  }


  public function generateSiteMap(): bool
  {
    $xml = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="' . $this->xmlSiteMapSchema . '"></urlset>');

    $hostURL = ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://') . $_SERVER['SERVER_NAME'];

    $siteMapData = [];

    foreach($this->pages as $page) {
      $siteMapEntry = [
        'url' => [
          'loc' => $hostURL . ($page['slug-path'] === 'index' ? '' : ('/' . $page['slug-path'])),
          'priority' => (isset($page['properties']['priority']) ? $page['properties']['priority'] : '0.1'),
          'lastmod' => isset($page['properties']['date']) ? $page['properties']['date'] : date('Y-m-d', filemtime($page['path'])),
          'changefreq' => 'weekly'
        ]
      ];

      $this->toXML($xml, $siteMapEntry);
    }

    return $xml->asXML('sitemap.xml');
  }


  private function toXML(\SimpleXMLElement &$object, array $data)
  {
    foreach ($data as $key => $value) {
      if (is_array($value)) {
        $new_object = $object->addChild($key);
        $this->toXML($new_object, $value);
      } else {
        $object->addChild("$key", htmlspecialchars("$value"));
      }
    }
  }


  public function render(array &$page = null, bool $index = false): string
  {
    // Make reference to Ziggurat available for resolved pages
    $Ziggurat = $this;

    if (empty($page)) {
      $page = &$this->resolvedPage;
    } else {
      $this->resolvedPage = $page;
    }

    if (!empty($page['html']) && !$index) {
      return $page['html'];
    }

    if (!isset($page)) {
      header('HTTP/1.0 404 Not Found');
      $page = $this->searchPage('404');
    }

    ob_start();
    require $page['path'];
    $this->resolvedPage['content'] = ob_get_clean();

    // Render markdown file with Parsedown
    if ((isset($page['type']) && $page['type'] == 'markdown') || (isset($page['properties']['type']) && $page['properties']['type'] == 'markdown')) {
      $this->resolvedPage['content'] = $this->Parsedown->text($this->resolvedPage['content']);
    }

    ob_start();

    foreach ($this->options['template'] as $partName => $templatePart) {
      $template = isset($page['template']) ? $page['template'] : isset($page['properties']['template']) ? $page['properties']['template'] : $templatePart;

      if ($partName === 'body' && isset($template)) {
        require $template;
      } else {
        require $templatePart;
      }
    }
    $renderedPage = ob_get_clean();

    // Get image aspect ratios
    $pattern = '/<picture.+?data-src="(?<url>.+?)"/si';

    preg_match_all($pattern, $renderedPage, $matches, PREG_SET_ORDER);

    foreach ($matches as $match) {
      if (!file_exists($match['url'])) {
        continue;
      }

      $dimensions = getimagesize($match['url']);
      $ratio = $dimensions[1] / $dimensions[0];
      $ratio = round($ratio * 100, 2);

      $updatedPicture = substr($match[0], 0, 8)
        . ' style="padding-top:' . $ratio . '%"'
        . substr($match[0], 8);

      $renderedPage = str_replace($match[0], $updatedPicture, $renderedPage);
    }

    if ($this->options['minify_html'] === true) {
      $renderedPage = $this->minifyHTML($renderedPage);
    }

    return $renderedPage;
  }


  public function loadTemplate($template): bool
  {
    if (is_string($template)) {
      $this->options['template'] = [
        'header' => $template . '/header.php',
        'body'   => $template . '/body.php',
        'footer' => $template . '/footer.php'
      ];
    } else if (is_array($template)) {
      if ($template['header'] && $template['body'] && $template['footer']) {
        $this->options['template'] = $template;
      }
    }

    return true;
  }


  public function minifyHTML(string $buffer): string
  {
    $search = [
      '/\s{2,}|\n/m', // Remove multiple whitespaces and newlines
      '/<!--(.|\s)*?-->/' // Remove HTML comments
    ];

    $replace = [
      '',
      ''
    ];

    $buffer = preg_replace($search, $replace, $buffer);

    return $buffer;
  }


  public function resolve($path = null, bool $return = false)
  {
    if (is_array($path)) {
      $foundPage = $path;
    } else if (is_string($path)) {
      $relativePath = ltrim(str_replace(basename(getcwd()) . '/', '', $path), '/');
      $foundPage = $this->searchPage($relativePath);
    } else {
      return false;
    }

    if (empty($foundPage)) {
      return false;
    }

    $resolvedPage = [
      'page-type' => 'page',
      'path'      => $foundPage['path'],
      'slug-path' => $foundPage['slug-path'],
      'ancestors' => $foundPage['ancestors']
    ];

    if (isset($foundPage['html'])) {
      $resolvedPage['html'] = $foundPage['html'];
    }

    $resolvedPage = $foundPage;

    if ($return) {
      return $resolvedPage;
    }

    $this->resolvedPage = $resolvedPage;

    return true;
  }

  public function list(string $path, bool $isParent = false, $amount = null): array
  {
    $foundPages = [];
    $foundAmount = 0;

    foreach ($this->pages as $page) {
      if ($foundAmount) {
        continue;
      }

      if ($isParent) {
        if (isset($page['properties']['parent']) && $page['properties']['parent'] === $path) {
          array_push($foundPages, $page);
        }
      } else {
        if ($page['properties']['slug'] === $path) {
          array_push($foundPages, $page);
        }
      }

      if ($amount !== null) {
        $foundAmount = count($foundPages) == $amount;
      }
    }

    return $foundPages;
  }

  // Private
  private function searchPage(string $path = '')
  {
    if (empty($path)) {
      $path = 'index';
    }

    foreach ($this->pages as $page) {
      if (!empty($page['slug-path'])) {
        if ($page['slug-path'] === $path) {
          return $page;
        }
      } else if (pathinfo($page['path'], PATHINFO_FILENAME) === $path) {
        return $page;
      }
    }

    return false;
  }


  private function resolveSlugPath(array $page): string
  {
    if (!$page['properties']) {
      return false;
    }

    $path = $page['properties']['slug'];

    if (!empty($page['properties']['parent'])) {
      $foundPage = $this->searchPage($page['properties']['parent']);

      if ($foundPage) {
        $path = $this->resolveSlugPath($foundPage) . '/' . $path;
      }
    }

    return $path;
  }


  // Getters
  public function getPages(): array
  {
    return $this->pages;
  }
}
