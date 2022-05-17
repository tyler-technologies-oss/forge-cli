# Forge CLI

The Forge CLI is a utility for building and managing native Web Component libraries that follow the Forge project structure.

This utility can be used to scaffold new projects and components, as well as build and publish Forge Web Components libraries to npm.

## Usage

The CLI tool is intended to be installed individually within each project.

```shell
$ npm install @tylertech/forge-cli
```

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

Testing the CLI locally can be done by using `npm link`, or by just using a path to the `dist` directory after a successful build:

```shell
$ node ../forge-cli/dist/bin/forge help
```

## License

Apache-2.0