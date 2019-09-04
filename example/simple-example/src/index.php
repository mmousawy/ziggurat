<?php

require_once '../../../lib/MMousawy/Ziggurat.php';

$Ziggurat = new \MMousawy\Ziggurat([
  'template' => './template'
]);

$Ziggurat->index();

$resolvedPage = $Ziggurat->resolve($_SERVER['REQUEST_URI']);

$Ziggurat->render($resolvedPage);
