<?php

require_once '../../../lib/MMousawy/Ziggurat.php';

$Ziggurat = new \MMousawy\Ziggurat([
  'template' => './template',
  'i18n' => [
    'default' => 'en',
    'en' => 'English',
    'nl' => 'Nederlands'
  ],
  'i18nMap' => './i18n-translation.json'
]);

$Ziggurat->index();

$resolvedPage = $Ziggurat->resolve($_SERVER['REQUEST_URI']);

if (isset($_GET['lang'])) {
  $Ziggurat->switchLanguage($_GET['lang']);
}

$Ziggurat->render($resolvedPage);
