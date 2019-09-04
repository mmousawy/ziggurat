# Quickstart
You can install and setup Ziggurat by cloning the repository and running `gulp`.
Note that some parts of Ziggurat depend on an some software already being available.


## Dependencies
__Required dependencies:__
- PHP 7.1+
- Node 10+

__Optional dependencies:__
- Page caching: SQLite3 extension for PHP
- Image ratio calculation: GD Library or Imagick for PHP


## Running Ziggurat
1. Clone Ziggurat from the GitHub repository:

```bash
$ git clone --recurse-submodules https://github.com/mmousawy/ziggurat.git
```

2. Install NPM packages

```bash
$ cd ziggurat
$ npm i
```

3. Copy the `ziggurat-config.json` file to your project folder.

```bash
$ mkdir your-project
$ cp ziggurat-config.default.json your-project/ziggurat-config.json
```

4. Run Ziggurat inside the cloned folder while providing your project folder.

```bash
$ npm run ziggurat -- --project your-project/
```
