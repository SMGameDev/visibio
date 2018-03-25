# visibio

Visibio is a 2d, browser-based MMO game being developed by the St. Mark's Game Dev club.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Server

#### Prerequisites

You should already have installed Go. If not, you can find instructions to do so at https://golang.org/doc/install.

#### Installation

To install the visibio server, run the following command:

```bash
go get github.com/smgamedev/visibio
```

This should install a binary called `visibio` wherever your Go environment is configured to do so.

#### Running the Server

To run the game server for development, simply run the command:

```bash
visibio server
```

The command line interface includes documentation of commands and flags.

### Client

#### Prerequisites

You need a copy of Node 8.0.0+ (we use v8.10.0 for development) and NPM or yarn for dependencies.

To install dependencies, run:

```bash
# npm
npm install
# yarn
yarn
```

#### Running the Dev Server

To run the development server, you can use:

```bash
# npm
npm run dev
# yarn
yarn run dev
```

## Authors

* **Meyer Zinn** - *Lead Developer*
* **Jordan Gaines** - *Client Developer*
* **Perry Naseck** - *Student Advisor*

See also the list of [contributors](https://github.com/smgamedev/visibio/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Dev notes

generate flatbuffers accessors--

```bash
flatc --go-namespace fbs -o . --go protocol/*
flatc --gen-all --gen-onefile --no-js-exports -o client/src --js protocol/visibio.fbs
```

### Physics

| Object | Category | Mask  |
| ------ | -------- | ----- |
| Wall   | 1        | 1,2,3 |
| Bullet | 2        | 1,3   |
| Player | 3        | 1,2   |

Groups are used to prevent collisions between "friend" groups (teammates).
