# Setting up a new project

Ziggurat is configurable out of the box: you can provide options for both the Ziggurat Core and the Ziggurat Toolchain. You can provide options for the core in your project's `index.php` file.

## Folder structure
Below you'll find the suggested way to structure your project to make sure Ziggurat can find your files. Note that you can manually provide file locations so this structure is not mandatory.

```bash
ziggurat/
├── ...                               # Ziggurat files
└── projects/                         # Projects folder
    └── your-project/                 # Root folder for your project
        └── src/                      # Project's source folder
            ├── pages/
            |   └── home.php          # Project's homepage
            |
            ├── template/
            ├── js/
            ├── scss/
            ├── assets/
            ├── ziggurat-config.json  # Project's toolchain configuration
            └── index.php             # Project's index file
```


## Running Ziggurat
When you've set your project up to have at least a `ziggurat-config.json` with an `index.php` in the root folder and a `home.php` in the pages folder, you can run the toolchain to build and serve your project.

```bash
$ npm run ziggurat -- --project your-project/
```
