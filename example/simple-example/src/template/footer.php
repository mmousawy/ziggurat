</main>
<footer>
  <div class="wrapper">
    {i18n: Current language}: <?= $Ziggurat->currentLanguageLong ?>
    <div class="languages">
    <?php

      $currentPath = $currentPage['slug_path'];

      foreach ($Ziggurat->options['i18n'] as $language => $languageLong) {
        if ($language !== 'default') {
          echo "<a href='$currentPath?lang=$language'>$languageLong</a>";
        }
      }

    ?>
    </div>
  </div>
</footer>
</body>
</html>
