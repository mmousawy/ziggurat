<?php
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

namespace MMousawy;

require_once dirname(__DIR__) . '/Parsedown/Parsedown.php';

class Ziggurat
{
  private $base_dir;
  private $pages_dir;
  private $pages;
  private $minify;
  private $Parsedown;
  private $options;
  private $db;
  private $databaseEnabled;
  private $xmlSiteMapSchema = 'http://www.sitemaps.org/schemas/sitemap/0.9';

  public $siteUrl;

  public $imageSizes = [
    'small' => 512,
    'medium' => 1024,
    'large' => 1920
  ];

  public $resolvedPage;


  /**
   * Constructor
   *
   * @param  mixed $options
   *
   * @return Ziggurat
   */
  function __construct(array $options = [])
  {
    $this->siteUrl = $this->getSiteUrl();

    $this->pages = [];
    $this->Parsedown = new \Parsedown();

    $this->options = [
      'base_dir' => getcwd(),
      'pages_dir' => './pages',
      'templateDir' => './template',
      'enable_cache' => false,
      'minify_html' => false
    ];

    $this->options = array_replace_recursive($this->options, $options);

    if (isset($options['template'])) {
      $this->loadTemplate($options['template']);
    }

    if ($this->options['enable_cache'] === true) {
      $this->databaseEnabled = $this->initDatabase();
      $this->loadCache();
    }

    // Hook the custom error page to the PHP shutdown event
    if (isset($this->options['error'])) {
      register_shutdown_function([ $this, 'shutDownHandler' ]);
    }
  }


  public function getSiteUrl(): string
  {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? 'https://' : 'http://';

    return $protocol . $_SERVER['HTTP_HOST'] . '/';
  }


  private function getRelativePath($path): array
  {
    $pathParts = explode('/', $path);
    foreach($pathParts as $partIndex => $part) {
      if (isset($this->rootPathParts[$partIndex])
          && $part === $this->rootPathParts[$partIndex]) {
        array_splice($pathParts, 0, 1);
      }
    }
    return $pathParts;
  }


  private function shutDownHandler() {
    $error = error_get_last();

    if ($error) {
      header('HTTP/1.1 500 Internal Server Error');

      $errorPage = $this->searchPage('error');

      $this->render($errorPage);
    }
  }


  /**
   * Initialize SQLite3 database.
   *
   * @return bool Returns true if database was initialized successfully
   */
  private function initDatabase(): bool
  {
    $this->db = new \SQLite3($this->options['database']);

    $schema = <<<SQL
      CREATE TABLE IF NOT EXISTS pages (
        path text NOT NULL,
        properties text NOT NULL,
        slug_path PRIMARY KEY NOT NULL,
        ancestors text NOT NULL,
        html text NOT NULL
      );
    SQL;

    return $this->db->exec($schema);
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

      /**
       * Read out file metadata
       * Match any string that has the following pattern:
       * #zigg:property = `value`
       */
      $pattern = '/#\s*zigg\s*:\s*([a-zA-Z0-9-_]+)(\s*=\s*`([^`]+))?/m';
      preg_match_all($pattern, $fileContents, $matches, PREG_SET_ORDER);

      foreach ($matches as $match) {
        if ($match[1] === 'ignore' && !isset($match[3])) {
          $page['properties'][$match[1]] = 'true';

        } else if (($match[1] === 'cover-image' && isset($match[3]))
                   || ($match[1] === 'cover-image-webp' && isset($match[3]))) {
          $page['properties'][$match[1]] = [];

          if (strpos($match[3], '{$size}')) {
            $coverImage = explode('{$size}', $match[3]);
          }

          foreach ($this->imageSizes as $label => $pixels) {
            $imageUrl = [
              'url' => "{$coverImage[0]}-{$pixels}px{$coverImage[1]}",
              'size' => $pixels
            ];

            if (file_exists($imageUrl['url'])) {
              $page['properties'][$match[1]][$label] = $imageUrl;
            }
          }
        } else if (isset($match[3])) {
          $page['properties'][$match[1]] = $match[3];
        }
      }

      array_push($this->pages, $page);
    }

    /**
     * Sort pages
     */
    usort($this->pages, function($item1, $item2) {
      // By path depth
      return strcmp($item1['path'], $item2['path']);
    });

    foreach ($this->pages as &$page) {
      $page['slug_path'] = $this->resolveSlugPath($page);
      $page['ancestors'] = explode('/', $page['slug_path']);
    }

    /**
     * Pre-render the HTML if caching is turned on
     */
    if ($this->options['enable_cache'] === true) {
      foreach ($this->pages as &$page) {
        if (isset($page['properties'])
            && !isset($page['properties']['ignore'])
            || (isset($page['properties']['ignore'])
                && $page['properties']['ignore'] !== 'true')) {
          $page['html'] = $this->render($page, false, true);
        }
      }
    }

    /**
     * Save cache at the end of indexing
     */
    if ($this->options['enable_cache'] === true) {
      $this->saveCache();
    }

    $this->generateSiteMap();

    return true;
  }


  public function saveCache(): bool
  {
    if (!$this->databaseEnabled) {
      $cacheString = json_encode($this->pages);

      if (file_put_contents('ziggurat-cache.json.php', $cacheString) === false) {
        return false;
      }
    } else {
      foreach ($this->pages as $page) {
        $query = <<<SQL
          INSERT INTO
            pages
              (path, properties, slug_path, ancestors, html)
          VALUES
            (:path, :properties, :slug_path, :ancestors, :html)
          ON
            CONFLICT(slug_path)
          DO
            UPDATE SET
              path = :path,
              properties = :properties,
              slug_path = :slug_path,
              ancestors = :ancestors,
              html = :html;
        SQL;

        $st = $this->db->prepare($query);
        $st->bindValue(':path', $page['path']);
        $st->bindValue(':properties', json_encode($page['properties']));
        $st->bindValue(':slug_path', $page['slug_path']);
        $st->bindValue(':ancestors', json_encode($page['ancestors']));
        $st->bindValue(':html', isset($page['html']) ? $page['html'] : '');

        $results = $st->execute();
      }
    }

    return true;
  }


  private function loadCache(): bool
  {
    if (!$this->databaseEnabled) {
      // TODO: Check if cache is valid
      if (!file_exists('ziggurat-cache.json.php')) {
        return false;
      }

      $this->pages = json_decode(file_get_contents('ziggurat-cache.json.php'), true);
    }

    return true;
  }


  private function generateSiteMap(): bool
  {
    $xml = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="' . $this->xmlSiteMapSchema . '"></urlset>');

    $hostURL = ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://') . $_SERVER['SERVER_NAME'];

    $siteMapData = [];

    foreach ($this->pages as $page) {
      if (isset($page['properties']['ignore']) && $page['properties']['ignore'] === 'true') {
        continue;
      }

      $siteMapEntry = [
        'url' => [
          'loc' => $hostURL . ($page['slug_path'] === 'index' ? '' : ('/' . $page['slug_path'])),
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


  public function render(&$page = null, bool $echo = true, bool $index = false): string
  {
    if (empty($page) || !$page) {
      header('HTTP/1.1 404 Not Found');
      $page = $this->searchPage('404');
    }


    // Make reference to Ziggurat available for resolved pages
    $Ziggurat = $this;

    if (isset($page)
        && empty($page['html'])
        && $this->databaseEnabled
        && !$index
        && !(isset($page['properties']['ignore']) && $page['properties']['ignore'] == 'true')) {
      $query = <<<SQL
        SELECT
          html
        FROM
          pages
        WHERE
          slug_path = :slug_path;
      SQL;

      $st = $this->db->prepare($query);
      $st->bindValue(':slug_path', $page['slug_path']);

      $results = $st->execute();

      $row = $results->fetchArray();

      if ($row) {
        $page['html'] = $row['html'];

        if ($echo) {
          echo $page['html'];
        }

        return $page['html'];
      }
    }

    if (!empty($page['html']) && !$index) {

      if ($echo) {
        echo $page['html'];
      }

      return $page['html'];
    }

    if (empty($page['path'])) {
      header('HTTP/1.1 404 Not Found');
      $page = $this->searchPage('404');
    }

    if (empty($page['path'])) {
      echo '404 - Page not found.';
      exit;
    }

    ob_start();

    $currentPage = &$page;

    (function() use ($Ziggurat, $currentPage) {
      include_once $Ziggurat->options['base_dir'] . '/' . $currentPage['path'];
    })();

    $page['content'] = ob_get_clean();

    // Render markdown file with Parsedown
    if ((isset($page['type']) && $page['type'] == 'markdown') || (isset($page['properties']['type']) && $page['properties']['type'] == 'markdown')) {
      $page['content'] = $this->Parsedown->text($page['content']);
    }

    $renderedPage = '';

    if (empty($this->options['template']['body'])) {
      // No template was provided, just render the found page
      $renderedPage = $page['content'];

    } else {
      // Render page with template
      ob_start();

      foreach ($this->options['template'] as $partName => $templatePart) {
        if ($partName === 'body') {
          $bodyTemplate = isset($page['properties']['template'])
                            ? $page['properties']['template']
                            : $templatePart;

          include $this->options['templateDir'] . '/' . $bodyTemplate . '.php';
        } else {
          include $this->options['templateDir'] . '/' . $templatePart . '.php';
        }
      }

      $renderedPage = ob_get_clean();
    }

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

    if ($echo) {
      echo $renderedPage;
    }

    return $renderedPage;
  }


  private function loadTemplate($template): bool
  {
    if (is_string($template)) {
      $this->options['template'] = [
        'header' => 'header',
        'body'   => 'body',
        'footer' => 'footer'
      ];
    } else if (is_array($template)) {
      if ($template['header'] && $template['body'] && $template['footer']) {
        $this->options['template'] = $template;
      }
    }

    return true;
  }


  private function minifyHTML(string $buffer): string
  {
    $search = [
      '/(?s)<pre[^<]*>.*?<\/pre>(*SKIP)(*F)|\s{2,}|\n/m', // Remove multiple whitespaces and newlines
      '/<!--(.|\s)*?-->/' // Remove HTML comments
    ];

    $replace = [
      '',
      ''
    ];

    $buffer = preg_replace($search, $replace, $buffer);

    return $buffer;
  }


  public function resolve($path = null, bool $return = true)
  {
    if (!$path) {
      return false;
    }

    if (is_array($path)) {
      $foundPage = $path;
    } else if (is_string($path)) {
      $relativePath = ltrim(preg_replace('/^.+?' . basename(getcwd()) . '/', '', $path), '/');

      $foundPage = $this->searchPage($relativePath);
    }

    if (empty($foundPage)) {
      return false;
    }

    $resolvedPage = [
      'page-type' => 'page',
      'path'      => $foundPage['path'],
      'slug_path' => $foundPage['slug_path'],
      'ancestors' => $foundPage['ancestors']
    ];

    if (isset($foundPage['html'])) {
      $resolvedPage['html'] = $foundPage['html'];
    }

    $resolvedPage = $foundPage;

    if ($return) {
      return $resolvedPage;
    }

    return true;
  }


  public function list(string $path = '', bool $isParent = true, $amount = null): array
  {
    $foundPages = [];
    $foundAmount = 0;

    foreach ($this->pages as $page) {
      if ($isParent) {
        // Get the first level pages
        if ($path === '') {
          if (!isset($page['properties']['parent']) && !isset($page['properties']['ignore'])) {
            array_push($foundPages, $page);
          }
        } else if (isset($page['properties']['parent']) && $page['properties']['parent'] === $path) {
          array_push($foundPages, $page);
        }
      } else {
        if ($page['properties']['slug'] === $path) {
          array_push($foundPages, $page);
        }
      }
    }

    usort($foundPages, function($item1, $item2) {
      // By order
      if (isset($item1['properties']['order'])
          && isset($item2['properties']['order'])) {
        return $item1['properties']['order'] > $item2['properties']['order'];
      } else if (isset($item2['properties']['order'])) {
        return true;
      }

      // By date
      if (isset($item1['properties']['date'])
          && isset($item2['properties']['date'])) {
        return $item2['properties']['date'] <=> $item1['properties']['date'];
      } else if (isset($item2['properties']['date'])) {
        return true;
      }

      return false;
    });

    if ($amount) {
      $foundPages = array_slice($foundPages, 0, $amount);
    }

    return $foundPages;
  }


  private function searchPage(string $path = '')
  {
    $pathParts = explode('?', $path);

    $path = $pathParts[0];

    if (isset($pathParts[1])) {
    	parse_str($pathParts[1], $_GET);
    }

    if (empty($path)) {
      $path = 'index';
    }

    if ($this->databaseEnabled) {
      $searchQuery = <<<SQL
        SELECT
          path,
          properties,
          slug_path,
          ancestors
        FROM
          pages
        WHERE
          slug_path = :slug_path;
      SQL;

      $st = $this->db->prepare($searchQuery);
      $st->bindValue(':slug_path', $path);

      $results = $st->execute();

      $row = $results->fetchArray();

      if ($row) {
        $page = [
          'path' => $row['path'],
          'properties' => json_decode($row['properties'], true),
          'slug_path' => $row['slug_path'],
          'ancestors' => json_decode($row['ancestors'])
        ];

        return $page;
      }
    }

    foreach ($this->pages as $page) {
      if (!empty($page['slug_path'])) {
        if ($page['slug_path'] === $path) {
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
    if (!isset($page['properties']) || !isset($page['properties']['slug'])) {
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


  public function getPages(): array
  {
    return $this->pages;
  }
}
