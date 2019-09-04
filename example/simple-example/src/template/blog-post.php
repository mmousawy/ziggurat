<?php

$props = $currentPage['properties'];
$cleanDate = date('F jS, Y', strtotime($props['date']));
$coverImage = $props['cover-image'];
$coverAlt = isset($props['cover-alt']) ? $props['cover-alt'] : '';

?>
<section class="wrapper">
  <img src="<?= $coverImage['medium']['url'] ?>" alt="<?= $coverAlt ?>">
  <h1><?= $props['title'] ?></h1>
  <time datetime="{$props['date']} 12:00"><?= $cleanDate ?></time>
  <?= $currentPage['content'] ?>
</section>
