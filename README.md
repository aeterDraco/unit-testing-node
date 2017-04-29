# Unit testing in Node.js

[![Build Status](https://travis-ci.org/mbland/unit-testing-node.svg?branch=master)](https://travis-ci.org/mbland/unit-testing-node)

This exercise will walk you through writing a small [Node.js][] application and
writing unit tests for it. You will learn how to:

- structure your code to separate concerns effectively, which maximizes
  readability, maintainability, and testability
- write small, focused tests for your application-specific logic
- use a technique known as "dependency injection" to simulate interaction
  with a remote service
- write an automated integration test for your application

This exercise assumes you are comfortable executing commands in a UNIX
environment. Specifically, it expects that you are familiar with the basics of
how to create directories and files on the command line of a terminal program.

## Installation

**Docker users**: Ensure you have `docker` and `docker-machine` installed. Run
`./docker-startup.sh` to build and run the docker image and open your web
browser to appropriate web address. You may have to refresh after the server
finally starts.

**OS X users**: Consider using [Homebrew][] to install the software described
below.

1. Install [Node.js][] on your system. This package requires
   version 4.2 or greater or version 5 or greater. You may wish to first install
   a version manager such as [nvm][] to manage and install different Node.js
   versions.

1. Install [Ruby][] version 2.2.3 or greater on your system. You can see if it
   is already installed by running `ruby -v` in a terminal window. You may wish
   to first install a version manager such as [rbenv][] to manage and install
   different Ruby versions.

   *Why Ruby?* The `./go` script mentioned below is written in Ruby. The
   content is published and hosted locally using [Jekyll][], a Ruby application.

1. Install [git][] if you do not have it installed already.

1. Clone this repository and change into the working directory by running:
   ```bash
   $ git clone https://github.com/mbland/unit-testing-node.git
   $ cd unit-testing-node
   ```

1. Run `./go serve` to serve the site locally.

   The `./go` script will check that your Ruby version is supported, install
   the [Bundler gem][Bundler] if it is not yet installed, install all the gems
   needed by the exercise website, and launch a running instance on
   `http://localhost:4000/`.

1. Visit http://localhost:4000/ in your browser.

## Developing

Run all the [installation instructions](#installation) to make sure the site
builds. Then, in your clone of this repository, run the following to ensure
your installation is in a good state:

```bash
$ npm install
$ ./go ci_build
```

### Directory structure

The directory layout is as follows (note that in this exercise, _content_ in the directories other than `pages` pertains to the code used in the exercise):

- `pages`: contains the content of the exercise website
- `exercise`: contains the content that the person following the exercise will
  edit
- `.exercise-init`: contains the content used to create the starting state of
  the exercise

  **Note**: The `exercise` and `.exercise-init` directories should always
  remain identical in the published version of the repo.

- `solutions`: contains subdirectories containing solution content pertaining
  to chapters of the exercise
  - `00-CHAPTER`: each chapter should have a corresponding directory
    containing the solution content for that chapter, with a unique numeric
    prefix reflecting the order of the chapters
  - `complete`: this directory should contain the solution content reflecting
    the completed exercise

Each `00-CHAPTER` directory need not contain the full content from previous
chapters; only the content that has changed relative to previous chapters.
This is due to the way that the `./go` commands to set `exercise` state work,
discussed in the next section. However, each chapter should be self-contained
and testable in isolation from other chapters.

The `solutions` chapter from this exercise contains:

```
00-config
01-rule
02-slack-client
03-github-client
04-log
05-middleware
06-integration
complete
```

### `./go` commands to set `exercise` state

The [`./go` script](./go) will create the following `Tutorial commands` to set
the state of the `exercise` directory:

- `start-over`: sets the state to the very beginning of the exercise
- `set-CHAPTER`: sets the state to that required at the beginning of
  `CHAPTER`, where `CHAPTER` corresponds to one of the `OO-CHAPTER`
  subdirectories within the `solutions` directory
- `set-complete`: sets the state to that of the completed exercise

The `Tutorial commmands` from this exercise are:

```
Tutorial commands
  start-over         Restore the initial state of the exercise files
  set-config         Set up the files for the config chapter
  set-rule           Set up the files for the rule chapter
  set-slack-client   Set up the files for the slack-client chapter
  set-github-client  Set up the files for the github-client chapter
  set-log            Set up the files for the log chapter
  set-middleware     Set up the files for the middleware chapter
  set-integration    Set up the files for the integration chapter
  set-complete       Copy the complete solution into the exercise dir
```

### Interaction between `./go` and the directory structure

All of the `./go` commands that update `exercise` state start by clearing out
the `exercise` directory and copying over the files from `.exercise-init`.

Every `set-CHAPTER` command will then copy the files from each _previous_
`solutions/00-CHAPTER` directory into `exercise`, one directory at a time.
Since each `00-CHAPTER` directory need only contain partial content, this
process will build the _complete_ state required at the beginning of the
target exercise chapter.

(_Note_: This presumes that content files will not be _removed_ during the
course of the exercise; may want to revisit this mechanism in the future.)

The `./go set-complete` command will reset the `exercise` state to the
beginning before copying over all the files from `solutions/complete`.

### `gulpfile.js` and `npm` command setup

All of the `scripts` in the [`package.json`](./package.json) file are
implemented via [`gulpfile.js`](./gulpfile.js):

- The `npm test` and `npm run lint` commands only operate on the files in the
  `exercise` directory.
- The `npm run test-all` command processes `.exercise-init` and all
  `solutions` subdirectories, in serial
- `npm run lint-all` command processes every `.js` file in the project

### Running a subset of tests

The `buildArgs()` function in `gulpfile.js` enables the following `npm test`
syntax to allow running a subset of tests matching a regular expression:

```bash
$ npm test -- --grep '^Config '
```

Alternatively, if you want to use [gulp][] directly:

```bash
$ npm install -g gulp
$ gulp test --grep '^Config '
$ gulp test-all --grep '^Config '
```

### `.eslintrc` configuration

This project uses [ESLint][] for static analysis. See the [ESLint configuration
user guide][ESLint user] and [ESLint rules guide][ESLint rules] for details on
each parameter of the [`.eslintrc`](.eslintrc) file.

### Open Source License

This software is made available as [Open Source software][oss-def] under the
[ISC License][ISC].  For the text of the license, see the [LICENSE](LICENSE.md)
file.


### Prior work

This is derived from the original [18F/unit-testing-node][utn-old]
implementation.

[Node.js]:      https://nodejs.org/
[Homebrew]:     http://brew.sh/
[nvm]:          https://github.com/creationix/nvm
[Ruby]:         https://www.ruby-lang.org/
[rbenv]:        https://github.com/rbenv/rbenv
[Jekyll]:       https://jekyllrb.com/
[git]:          https://git-scm.com/downloads
[Bundler]:      http://bundler.io/
[gulp]:         https://www.npmjs.com/package/gulp
[ESLint]:       http://eslint.org/
[ESLint user]:  http://eslint.org/docs/user-guide/configuring
[ESLint rules]: http://eslint.org/docs/rules
[oss-def]:      https://opensource.org/osd-annotated
[ISC]:          https://www.isc.org/downloads/software-support-policy/isc-license/
[utn-old]:      https://github.com/18F/unit-testing-node
