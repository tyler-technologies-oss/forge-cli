# Tyler Forge™ CLI

The Forge CLI is a command line utility for building and packaging Tyler Forge™ based Web Component libraries.

## Usage

```shell
npm i -D @tylertech/forge-cli
```

## View help

```shell
forge help
```

## Local Development

Install dependencies:

```shell
npm install
```

Build the package:

```shell
npm run build
```

To run the build command in watch mode use:

```shell
npm run watch
```

Running the CLI locally can be done by using standard `npm link`, or by using `node` to execute it as a binary via relative path:

```shell
node ../forge-cli/bin/forge help
```
