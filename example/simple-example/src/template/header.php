<?php
$menuItems = $Ziggurat->list();

$menu = (function() use ($menuItems) {
  $html = '';

  foreach($menuItems as $item) {
    $html .= <<<HTML
      <li><a href="{$item['slug_path']}">{$item['properties']['title']}</a></li>
    HTML;
  }

  return $html;
})();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <base href="/">
  <title>Ziggurat example</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<main>
  <header class="page-header">
    <div class="wrapper">
      <span class="page-logo"><a href="/">Ziggurat example</a></span>
      <nav class="page-nav">
        <ul><?= $menu ?></ul>
      </nav>
    </div>
  </header>
