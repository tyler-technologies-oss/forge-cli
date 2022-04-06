# Forge CLI

The Forge command line interface is a utility for building, managing, and deploying projects built as native Web Components.

This utility can be used to scaffold new projects and components, as well as build and publish Web Components libraries to npm.

## Usage

The CLI tool is intended to be installed individually within each project.

```shell
$ npm install @tylertech/forge-cli
```

> The `--registry` option is needed unless you have configured your system to default to the registry shown above.

## View commands

```shell
$ forge help
```

## Generating a new project

```shell
$ forge new
```

## Serving the static demo application

```shell
$ forge serve
```
Run `$ forge help serve demo` for information on options that can be passed to the serve command.

## Development

Install dependencies:

```shell
$ npm install
```

Build the package:

```shell
$ npm run build
```

To run the build command in watch mode for an on-the-fly build:

```shell
$ npm run watch
```

Testing the CLI locally can be done by using `npm link`, or by just using a path the `dist` folder after a successful build:

```shell
$ node ../tyler-components-web-cli/dist/bin/forge help
```

## License

Apache-2.0