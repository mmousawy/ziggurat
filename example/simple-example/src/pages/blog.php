<?php
#zigg:title    = `Blog`
#zigg:slug     = `blog`
#zigg:priority = `0.8`
#zigg:order    = `2`

$blogPosts = $Ziggurat->list('blog', true);

?>
<h1>Blog</h1>

<?php

if ($blogPosts) {
  foreach($blogPosts as $blog) {
    $cleanDate = date('F jS, Y', strtotime($blog['properties']['date']));
    $coverImage = $blog['properties']['cover-image'];
    $coverAlt = isset($blog['properties']['cover-alt']) ? $blog['properties']['cover-alt'] : '';

    echo <<<HTML
      <div class="blog-item">
        <a href="{$blog['slug_path']}" class="blog-item__link">
          <img src="{$coverImage['small']['url']}" alt="">
          <div class="blog-item__meta">
            <span class="blog-item__title">{$blog['properties']['title']}</span>
            <time>{$cleanDate}</time>
          </div>
        </a>
      </div>
    HTML;
  }
} else {
  echo 'No posts available.';
}
