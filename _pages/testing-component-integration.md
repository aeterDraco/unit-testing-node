---
title: Testing component integration
---
Now that you've completed all of the application-specific components, and
implemented the core `Middleware` functionality, it's time to plug
`Middleware` into `Hubot`. You'll do this by creating the Hubot "script" that
defines the entry point of your application.

If you've skipped ahead to this chapter, you can establish the starting state
of the `exercise/` files for this chapter by running:

```sh
$ ./go set-integration
```

## What to expect

Since you've exhaustively tested every corner of your application logic using
small, fast, isolated tests, you only need to validate a few high-level
integration cases. The setup for this will be more complex, and the test cases
may not run as fast, but you will not need nearly as many. A failure of any of
these tests may indicate a misunderstanding of the system boundary. This
misunderstanding may also signal a gap in your component-level coverage that
you'll need to fill.

In short, in this tutorial, you'll learn to do the following:

- Integrate your application components to implement the [Hubot receive
  middleware](https://hubot.github.com/docs/scripting/#middleware) interface
- Use the [hubot-test-helper](https://www.npmjs.com/package/hubot-test-helper)
  package to simulate user interaction
- Use a helper class to programmatically validate expected log messages
- Launch a local HTTP test server to exercise components that access external
  APIs without depending on external services
- Write a temporary configuration file to pass test-specific values to the
  code under test
- [Monkey patch](https://en.wikipedia.org/wiki/Monkey_patch) an existing
  package to add missing behavior
- Validate high-level success and error cases that exercise all the core
  application components rather than using test doubles for any of them

## Writing the main script

Open a new file called `exercise/scripts/slack-github-issues.js`, and start it
with this preamble, with fields inspired by the [Hubot documentation
guidelines](https://hubot.github.com/docs/scripting/#documenting-scripts):

```js
// Description:
//   Uses the Slack Real Time Messaging API to file GitHub issues
//
// Configuration:
//   HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH

'use strict';
```

Now add `require` statements for all of the application components (except
`Rule`, which is created by `Middleware`):

```js
var Config = require('../lib/config');
var SlackClient = require('../lib/slack-client');
var GitHubClient = require('../lib/github-client');
var Logger = require('../lib/logger');
var Middleware = require('../lib/middleware');
```

The basic interface required to plug into Hubot is a function that takes a
Hubot instance as its only argument. Wire your core application components
together and register the `Middleware`:

```js
module.exports = function(robot) {
  var logger = new Logger(robot.logger),
      config = new Config(null, logger),
      impl = new Middleware(
        config,
        new SlackClient(robot.adapter.client, config),
        new GitHubClient(config),
        logger);

  robot.receiveMiddleware(function(context, next, done) {
    // Catch rejected Promises to avoid the UnhandledPromiseRejectionWarning
    // in Node.js v6.6.0 and higher.
    impl.execute(context, next, done).catch(function() { });
  });
  logger.info(null, 'registered receiveMiddleware');
};
```

Recall that you're conforming to the [Hubot receive
middleware](https://hubot.github.com/docs/scripting/#middleware) interface,
which takes a function (not an object) as its argument. This is why you must
create a closure that contains the `impl` object.

Believe it or not, as far as the main script goes, you're done. That's it!
Nothing more to it. (For now.)

## Integration testing using `hubot-test-helper`

Open the `exercise/test/integration-test.js` file, which should look like
this:

```js
'use strict';

describe('Integration test', function() {
  it('should successfully load the application script');
});
```

The first thing you're going to do is `require` the
[hubot-test-helper package](https://www.npmjs.com/package/hubot-test-helper).
This package simulates a Hubot "room" in which a Hubot instance is responding
to messages. Import it and create an instantiation for the entire test by
adding the following declarations to the file:

```js
var Helper = require('hubot-test-helper');
var scriptHelper = new Helper('../scripts/slack-github-issues.js');
```

To create a new "room" instance for each test case, add the following
`beforeEach` hook to the fixture:

```js
describe('Integration test', function() {
  var room;

  beforeEach(function() {
    room = scriptHelper.createRoom({ httpd: false, name: 'handbook' });
  });
```

## Introducing `LogHelper`

Even though you aren't really testing anything yet, run the test to see what
happens:

```sh
$ npm test -- --grep '^Integration test '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration test "

[19:28:42] Using gulpfile .../unit-testing-node/gulpfile.js
[19:28:42] Starting 'test'...


  Integration test
    an evergreen_tree reaction to a message
[Sat Jan 23 2016 19:28:42 GMT-0500 (EST)] INFO mbland-unit-testing-node: reading configuration from config/slack-github-issues.json
[Sat Jan 23 2016 19:28:42 GMT-0500 (EST)] INFO mbland-unit-testing-node: registered receiveMiddleware
      ✓ should create a GitHub issue


  1 passing (12ms)

[19:28:42] Finished 'test' after 574 ms
```

Notice the noisy log message in the middle of the test output. While you can
see that your script is getting loaded, it would be better to check the log
message programmatically and keep the test output clean. Let's introduce a new
lightweight helper, `LogHelper`, in a new
`exercise/test/helpers/log-helper.js` file:

```js
var sinon = require('sinon');

module.exports = LogHelper;

function LogHelper() {
  var messages = [];
  this.messages = messages;
  this.recordMessages = function() {
    var i, args = new Array(arguments.length);
    for (i = 0; i !== args.length; ++i) {
      args[i] = arguments[i];
    }
    messages.push(args.join(' '));
  };
}

LogHelper.prototype.capture = function(callback) {
  sinon.stub(process.stdout, 'write', this.recordMessages);
  sinon.stub(process.stderr, 'write', this.recordMessages);

  try {
    return callback();
  } finally {
    process.stderr.write.restore();
    process.stdout.write.restore();
  }
};
```

When you pass a function to `LogHelper.capture`, it will capture all standard
output and standard error messages in its `messages` member. It joins all of
the arguments so each call is represented by a single string, which you can
then programmatically validate. Should a test assertion within `callback`
fail, the `finally` block restores the standard output and error streams
before propagating the failure. This way, you can examine the expected log
output without swallowing the output from the test framework itself.

Update your test fixture to look like this:

```js
var Helper = require('hubot-test-helper');
var scriptHelper = new Helper('../scripts/slack-github-issues.js');
var LogHelper = require('./helpers/log-helper');

describe('Integration test', function() {
  var room, logHelper;

  beforeEach(function() {
    logHelper = new LogHelper();
    logHelper.capture(function() {
      room = scriptHelper.createRoom({ httpd: false, name: 'handbook' });
    });
  });
```

You can now implement the test case to ensure the script loads successfully to
begin with. First, add the following before the fixture:

```js
var chai = require('chai');

chai.should();
```

Then write the case so that it fails at first:

```js
  it('should successfully load the application script', function() {
    logHelper.messages.should.eql([]);
  });
```

Run the test and you should see something like the following:

```sh
$ npm test -- --grep '^Integration test '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration test "

[19:31:22] Using gulpfile .../unit-testing-node/gulpfile.js
[19:31:22] Starting 'test'...


  Integration test
    1) should successfully load the application script
    an evergreen_tree reaction to a message
      ✓ should create a GitHub issue


  1 passing (170ms)
  1 failing

  1) Integration test should successfully load the application script:

      AssertionError: expected [ Array(2) ] to deeply equal []
      + expected - actual

      -[
      -  "[Sat Jan 23 2016 19:31:23 GMT-0500 (EST)] INFO mbland-unit-testing-node: reading configuration from config/slack-github-issues.json\n"
      -  "[Sat Jan 23 2016 19:31:23 GMT-0500 (EST)] INFO mbland-unit-testing-node: registered receiveMiddleware\n"
      -]
      +[]

    at Context.<anonymous> (exercise/test/integration-test.js:26:31)




[19:31:23] 'test' errored after 730 ms
[19:31:23] Error in plugin 'gulp-mocha'
Message:
    1 test failed.
npm ERR! Test failed.  See above for more details.
```

## Filtering log messages

Before you update the test to make it pass, notice that the timestamp
component will change with every test run. Also notice that there's a bit of
boilerplate—both the `mbland-unit-testing-node` prefix and the newline at the
end.

Rather than hardcode all of this into the test data, write a `LogHelper`
function to strip out the boilerplate. To start, import the prefix from the
`Logger` class:

```js
var LOGGER_PREFIX = require('../../lib/logger').PREFIX;
```

Then let's define our helper function:

```js
LogHelper.prototype.filteredMessages = function() {
  var logFilter = /^\[.+\] ([A-Z]+) ([0-9a-z-]+:) (.*)/;

  return this.messages.map(function(message) {
    var match = message.match(logFilter);

    if (match && match[2] === LOGGER_PREFIX) {
      return match[1] + ' ' + match[3];
    }
    return message;
  });
};
```

This function uses a [RegExp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp)
to strip out the timestamp and capture the remaining content. If the message
doesn't match, or doesn't contain `LOGGER_PREFIX` as expected, the full
message is returned. Otherwise, you return just the material content of the
message, prefixed with the log level.

Change the test assertion to read as follows:

```js
    logHelper.filteredMessages().should.eql([]);
```

Run the tests again, and now you should see this:

```sh
$ npm test -- --grep '^Integration test '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration test "

[19:35:03] Using .../unit-testing-node/gulpfile.js
[19:35:03] Starting 'test'...


  Integration test
    1) should successfully load the application script
    an evergreen_tree reaction to a message
      ✓ should create a GitHub issue


  1 passing (163ms)
  1 failing

  1) Integration test should successfully load the application script:

      AssertionError: expected [ Array(2) ] to deeply equal []
      + expected - actual

      -[
      -  "INFO reading configuration from config/slack-github-issues.json"
      -  "INFO registered receiveMiddleware"
      -]
      +[]

    at Context.<anonymous> (exercise/test/integration-test.js:26:41)




[19:35:04] 'test' errored after
[19:35:04] Error in plugin 'gulp-mocha'
Message:
    1 test failed.
npm ERR! Test failed.  See above for more details.
```

Much better! Add this string to your test assertion and confirm it passes
before moving on to the next section.

## Launching the test server and writing the configuration

You also need to launch an `ApiStubServer` instance. You can use one instance
to stub out both Slack and GitHub API requests. However, you also need to
create a new configuration file so that the `SlackClient` and `GitHubClient`
instances can find it.

First, add the servers to the fixture. Start by adding the necessary `require`
statement:

```js
var ApiStubServer = require('./helpers/api-stub-server.js');
```

Then update the fixture thus, including dummy values for the Slack and GitHub
API tokens:

```js
describe('Integration test', function() {
  var room, logHelper, apiStubServer;

  before(function() {
    apiStubServer = new ApiStubServer();
    process.env.HUBOT_SLACK_TOKEN = '<mbland-github-token>';
    process.env.HUBOT_GITHUB_TOKEN = '<mbland-github-token>';
  });

  after(function() {
    apiStubServer.close();
    delete process.env.HUBOT_SLACK_TOKEN;
    delete process.env.HUBOT_GITHUB_TOKEN;
  });
```

This setup should seem pretty standard by now, and it follows the pattern of
the `SlackClient` and `GitHubClient` tests. Now, prepare the configuration.
Start by importing the test helpers package:

```js
var helpers = require('./helpers');
```

Add a `config` variable to the fixture, using `helpers.baseConfig()` as a
starting point before setting its `slackApiBaseUrl` and `githubApiBaseUrl`
properties:

```js
describe('Integration test', function() {
  var room, logHelper, apiStubServer, config;

  before(function() {
    apiStubServer = new ApiStubServer();
    process.env.HUBOT_SLACK_TOKEN = '<mbland-github-token>';
    process.env.HUBOT_GITHUB_TOKEN = '<mbland-github-token>';
    config = helpers.baseConfig();
    config.slackApiBaseUrl = apiStubServer.address() + '/slack/';
    config.githubApiBaseUrl = apiStubServer.address() + '/github/';
  });
```

Next, write out the configuration file and set the
`HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH` environment variable. You're going to
use the [temp npm package](https://www.npmjs.com/package/temp) to help create
and clean up the file. First import this package, the [file system
package](https://nodejs.org/api/fs.html) from the standard library, and the
script name like so:

```js
var temp = require('temp');
var fs = require('fs');
var scriptName = require('../package.json').name;
```

Add a `done` callback to the `before` callback, and then add a call to
`temp.open` like so:

```js
  before(function(done) {
    apiStubServer = new ApiStubServer();
    process.env.HUBOT_SLACK_TOKEN = '<mbland-github-token>';
    process.env.HUBOT_GITHUB_TOKEN = '<mbland-github-token>';
    config = helpers.baseConfig();
    config.slackApiBaseUrl = apiStubServer.address() + '/slack/';
    config.githubApiBaseUrl = apiStubServer.address() + '/github/';

    temp.open(scriptName + '-integration-test-config-', function(err, info) {
      if (err) {
        return done(err);
      }
      fs.write(info.fd, JSON.stringify(config));
      fs.close(info.fd, function(err) {
        if (!err) {
          process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH = info.path;
        }
        done(err);
      });
    });
  });
```

Here, you pass along to Mocha any errors that occur by passing them to the
`done` callback, then set `HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH` and call
`done` upon success. To clean up the file and the environment variable, add
a `done` callback to the `after` hook and remove the file like so:

```js
  after(function(done) {
    var configPath = process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH;

    apiStubServer.close();
    delete process.env.HUBOT_SLACK_TOKEN;
    delete process.env.HUBOT_GITHUB_TOKEN;
    delete process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH;
    fs.unlink(configPath, done);
  });
```

Now add a utility function to the fixture to produce default values for
`apiStubServer.urlsToResponses`. Start by declaring the function variable at
the top of the fixture, then calling it in the `beforeEach` hook:

```js
describe('Integration test', function() {
  var room, logHelper, apiStubServer, config, apiServerDefaults;

  // ...before and after hooks...

  beforeEach(function() {
    logHelper = new LogHelper();
    logHelper.capture(function() {
      room = scriptHelper.createRoom({ httpd: false, name: 'handbook' });
    });
    apiStubServer.urlsToResponses = apiServerDefaults();
  });
```

A little further down, define it thus, borrowing values from the `SlackClient`
and `GitHubClient` tests:

```js
  apiServerDefaults = function() {
    var metadata = helpers.metadata();

    return {
      '/slack/reactions.get': {
        expectedParams: {
          channel: helpers.CHANNEL_ID,
          timestamp: helpers.TIMESTAMP,
          token: process.env.HUBOT_SLACK_TOKEN
        },
        statusCode: 200,
        payload: helpers.messageWithReactions()
      },
      '/github/repos/mbland/handbook/issues': {
        expectedParams: {
          title: metadata.title,
          body: metadata.url
        },
        statusCode: 200,
        payload: {
          'html_url': helpers.ISSUE_URL
        }
      },
      '/slack/reactions.add': {
        expectedParams: {
          channel: helpers.CHANNEL_ID,
          timestamp: helpers.TIMESTAMP,
          name: config.successReaction,
          token: process.env.HUBOT_SLACK_TOKEN
        },
        statusCode: 200,
        payload: { ok: true }
      }
    };
  };
```

## Quick fix up

Let's stop and run our tests again to make sure they still pass:

```sh
$ npm test -- --grep '^Integration test '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration test "

[19:43:26] Using gulpfile .../unit-testing-node/gulpfile.js
[19:43:26] Starting 'test'...


  Integration test
    1) should successfully load the application script
    an evergreen_tree reaction to a message
      ✓ should create a GitHub issue


  1 passing (194ms)
  1 failing

  1) Integration test should successfully load the application script:

      AssertionError: expected [ Array(2) ] to deeply equal [ Array(2) ]
      + expected - actual

       [
      -  "INFO reading configuration from .../mbland-unit-testing-node-integration-test-config-116023-52840-1jwmn06"
      +  "INFO reading configuration from config/slack-github-issues.json"
         "INFO registered receiveMiddleware"
       ]

    at Context.<anonymous> (exercise/test/integration-test.js:99:41)




[19:43:26] 'test' errored after
[19:43:26] Error in plugin 'gulp-mocha'
Message:
    1 test failed.
npm ERR! Test failed.  See above for more details.
```

Whoops! Now that you've defined the `HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH`
environment variable to point to a temp file, `Config` is no longer reading
from the default config path. This is an easy fix:

```js
  it('should successfully load the application script', function() {
    logHelper.filteredMessages().should.eql([
      'INFO reading configuration from ' +
        process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH,
      'INFO registered receiveMiddleware'
    ]);
  });
```

Run the test and make sure it passes before moving on.

## Testing a configuration error

There's an issue with your script as it's currently written. As you learned
from the [`Config` class chapter]({{ site.baseurl }}/components/config/), the
`Config` constructor may throw an
[`Error`](https://nodejs.org/api/errors.html) if the config file is missing or
invalid. Allowing an error from your application to cross an interface
boundary is a bad habit.

Let's see why by writing a test that will fail due to an invalid config file.
Write the following to a new test helper file,
`exercise/test/helpers/test-config-invalid.json`:

```json
{
  "githubUser": "mbland",
  "githubTimeout": 5000,
  "slackTimeout": 5000,
  "successReaction": "heavy_check_mark"
}
```

This file is valid except that it's missing the `rules` field. After you've
written this new test configuration helper file, add the [`path`
module](https://nodejs.org/api/path.html) from the standard library to the
test fixture file:

```js
var path = require('path');
```

```js
  it('should not register if the config file is invalid', function() {
    var origPath = process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH,
        invalidConfigPath = path.join(
          __dirname, 'helpers', 'test-config-invalid.json');

    try {
      process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH = invalidConfigPath;
      room = scriptHelper.createRoom({ httpd: false, name: 'handbook' });
    } finally {
      process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH = origPath;
    }
  });
```

Now run the test and see what happens:

```sh
$ npm test -- --grep '^Integration '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration "

[14:08:23] Using gulpfile .../unit-testing-node/gulpfile.js
[14:08:23] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
[Sun Jan 24 2016 14:08:23 GMT-0500 (EST)] INFO mbland-unit-testing-node: reading configuration from .../unit-testing-node/exercise/test/helpers/test-config-invalid.json
[Sun Jan 24 2016 14:08:23 GMT-0500 (EST)] ERROR Unable to load .../unit-testing-node/exercise/scripts/slack-github-issues: Error: Invalid configuration:
  missing rules
  at validate (.../unit-testing-node/exercise/lib/config.js:58:11)
  at new Config (.../unit-testing-node/exercise/lib/config.js:13:3)
  at module.exports (.../unit-testing-node/exercise/scripts/slack-github-issues.js:22:14)
  at MockRobot.Robot.loadFile (.../unit-testing-node/node_modules/hubot/src/robot.coffee:356:11)
  at Helper.createRoom (.../unit-testing-node/node_modules/hubot-test-helper/src/index.coffee:85:13)
  at Context.<anonymous> (.../unit-testing-node/exercise/test/integration-test.js:116:29)
  [...snip Mocha stack frames...]

npm ERR! Test failed.  See above for more details.
```

Ugh, that's a lot of gunk to dump into a log file—surely you can do better!
Update the script to wrap your behavior in a [`try...catch`
block](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch):

```js
module.exports = function(robot) {
  var logger, config, impl;

  try {
    logger = new Logger(robot.logger);
    config = new Config(null, logger);
    impl = new Middleware(
      config,
      new SlackClient(robot.adapter.client, config),
      new GitHubClient(config),
      logger);

    robot.receiveMiddleware(function(context, next, done) {
      // Catch rejected Promises to avoid the UnhandledPromiseRejectionWarning
      // in Node.js v6.6.0 and higher.
      impl.execute(context, next, done).catch(function() { });
    });
    logger.info(null, 'registered receiveMiddleware');

  } catch (err) {
  }
};
```

Run the test again, and it should pass with no hint of the stack trace in the
output:

```sh
$ npm test -- --grep '^Integration test '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration test "

[11:25:37] Using gulpfile .../unit-testing-node/gulpfile.js
[11:25:37] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
[Sun Jan 24 2016 14:11:08 GMT-0500 (EST)] INFO mbland-unit-testing-node: reading configuration from .../unit-testing-node/exercise/test/helpers/test-config-invalid.json
    ✓ should not register if the config file is invalid
    an evergreen_tree reaction to a message
      ✓ should create a GitHub issue


  3 passing (210ms)

[11:25:38] Finished 'test' after
```

This is progress, but it would be better to see an error message explaining
the problem. Add the following to the `catch` block of the script:

```js
  } catch (err) {
    logger.error(null, 'receiveMiddleware registration failed:',
      err instanceof Error ? err.message : err);
  }
```

Run the test again, and _now_ we see:

```sh
$ npm test -- --grep '^Integration '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration "

[13:34:22] Using gulpfile .../unit-testing-node/gulpfile.js
[13:34:22] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
[Sun Jan 24 2016 14:11:37 GMT-0500 (EST)] INFO mbland-unit-testing-node: reading configuration from .../unit-testing-node/exercise/test/helpers/test-config-invalid.json
[Sun Jan 24 2016 14:11:37 GMT-0500 (EST)] ERROR mbland-unit-testing-node: receiveMiddleware registration failed: Invalid configuration:
  missing rules
    ✓ should not register if the config file is invalid
    an evergreen_tree reaction to a message
      ✓ should create a GitHub issue


  3 passing (191ms)

[13:34:23] Finished 'test' after 739 ms
```

That message looks right, keeps the logs clean, and might be of more use than
a stack trace to someone trying to diagnose a problem. With that squared away,
update the test to check these messages programmatically and keep them out of
the test runner output:

```js
  it('should not register if the config file is invalid', function() {
    var origPath = process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH,
        invalidConfigPath = path.join(
          __dirname, 'helpers', 'test-config-invalid.json');

    try {
      process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH = invalidConfigPath;
      logHelper = new LogHelper();
      logHelper.capture(function() {
        room = scriptHelper.createRoom({ httpd: false, name: 'handbook' });
      });
      logHelper.filteredMessages().should.eql([
        'INFO reading configuration from ' + invalidConfigPath,
        'ERROR receiveMiddleware registration failed: Invalid configuration:'
      ]);

    } finally {
      process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH = origPath;
    }
  });
```

Note that `logHelper.filteredMessages()` cuts off the error message after
`Invalid configuration` because it contains a newline character. Add one more
assertion to check that the raw log message reports the expected validation
error:

```js
      logHelper.messages[logHelper.messages.length - 1].should.have.string(
        'Invalid configuration:\n  missing rules');
```

## Monkey patching the `hubot-test-helper` framework

There's another thing you need to prepare to write your test cases, and it's
somewhat shady. As it turns out, the `hubot-test-helper` does not know about
`reaction_added` messages. The `room.user` member is defined entirely in the
`Room` constructor, precluding the possibility of adding a new function
prototype. You'll dynamically add that behavior onto the `room` object—a
technique known as "[monkey
patching](https://en.wikipedia.org/wiki/Monkey_patch)".

Again, add a new helper to the fixture, first by declaring the function
variable:

```js
  var room, logHelper, apiStubServer, config, apiServerDefaults,
      patchReactMethodOntoRoom;
```

Call it in the `beforeEach` hook:

```js
  beforeEach(function() {
    logHelper = new LogHelper();
    logHelper.capture(function() {
      room = scriptHelper.createRoom({ httpd: false, name: 'handbook' });
    });
    patchReactMethodOntoRoom(room);
    apiStubServer.urlsToResponses = apiServerDefaults();
  });
```

Then define the function thus:

```js
  patchReactMethodOntoRoom = function(room) {
    room.user.react = function(userName, reaction) {
      return new Promise(function(resolve) {
        var reactionMessage = helpers.fullReactionAddedMessage();

        room.messages.push([userName, reaction]);
        reactionMessage.user.name = userName;
        reactionMessage.rawMessage.reaction = reaction;
        room.robot.receive(reactionMessage, resolve);
      });
    };
  };
```

This function is based on the implementation of `Room.receive` found in
`node_modules/hubot-test-helper/src/index.coffee`. Yet another benefit of open
source is being able to see the code you depend on for hints on how to extend
its behavior. As always, remain mindful of [Promise gotcha #1: not returning
the `Promise`](#promises-gotcha-1).

Though monkey patching is not ideal, in this test, it gets the job done quite
effectively. In addition, `reaction_added` message support hasn't completely
propagated to the official Slack and Hubot npm packages at the time of writing.
[Writing this application would've been extremely difficult without being able
to fork the original
packages]({{ site.baseurl }}/concepts/forking-and-contributing-upstream). At
the same time, writing this test would've been more difficult without the
ability to monkey patch the existing test helper. (Writing a new one would
have been possible, but would have required a bit more work.)

## Sending a reaction message

You're finally ready to implement the `should create a GitHub issue given a
valid reaction` test case. Since `room.user.react` returns a `Promise`, you'll
use [chai-as-promised](https://www.npmjs.com/package/chai-as-promised) to
validate your test cases. The first thing to do is add the requisite `require`
and setup statements:

```js
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);
```

Now set up an empty test case using the [`.should.notify(done)`
syntax](https://www.npmjs.com/package/chai-as-promised#working-with-non-promisefriendly-test-runners),
which will allow you to make assertions after the `Promise` resolves:

```js
  it('should create a GitHub issue given a valid reaction', function(done) {
    room.user.react('mbland', helpers.REACTION).should.be.fulfilled
      .then(function() {
    }).should.notify(done);
  });
```

Try running the test as is to see what happens:

```sh
$ npm test -- --grep '^Integration '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration "

[17:17:28] Using gulpfile .../unit-testing-node/gulpfile.js
[17:17:28] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
    ✓ should not register if the config file is invalid
[Sun Jan 24 2016 17:17:29 GMT-0500 (EST)] ERROR TypeError: Cannot read property 'getChannelByID' of undefined
  at SlackClient.getChannelName (.../unit-testing-node/exercise/lib/slack-client.js:26:21)
  at Rule.channelMatches (.../unit-testing-node/exercise/lib/rule.js:28:34)
  at Rule.match (.../unit-testing-node/exercise/lib/rule.js:17:10)
  at .../unit-testing-node/exercise/lib/middleware.js:54:19
  at Array.find (native)
  at Middleware.findMatchingRule (.../unit-testing-node/exercise/lib/middleware.js:53:23)
  at Middleware.execute (.../unit-testing-node/exercise/lib/middleware.js:24:19)
  at .../unit-testing-node/exercise/scripts/slack-github-issues.js:30:12
  at .../unit-testing-node/node_modules/hubot/src/middleware.coffee:33:24
  [...snip Hubot stack frames...]

    ✓ should create a GitHub issue given a valid reaction


  3 passing (216ms)

[17:17:29] Finished 'test' after 790 ms
```

## Appreciating the invention of dependency injection

So it _passed_ ... or did it? The stack trace shows all the code getting
executed until it tries to call `SlackClient.getChannelName`.

Of course! This function depends on `SlackClient.client`, which gets
initialized with `robot.adapter.client` in the
`exercise/scripts/slack-github-issues.js` script. The only problem is, the
`MockRobot` inside the hubot-test-helper doesn't have such a member, so
`SlackClient.client` remains `undefined`.

This is why you use [dependency
injection]({{ site.baseurl }}/concepts/dependency-injection/). If the
hubot-test-helper permitted you to pass in a robot object, you could decorate
it with whatever you needed before instantiating your middleware. Since it
creates its own `MockRobot` instance directly, we have to resort to less
elegant measures.

Fortunately, this being JavaScript, you do have an effective measure available
to you. It isn't pretty, though. First, update the
`exercise/scripts/slack-github-issues.js` script to the following:

```js
module.exports = function(robot) {
  var logger, config, impl, middleware;

  try {
    logger = new Logger(robot.logger);
    config = new Config(null, logger);
    impl = new Middleware(
      config,
      new SlackClient(robot.adapter.client, config),
      new GitHubClient(config),
      logger);

    middleware = function(context, next, done) {
      // Catch rejected Promises to avoid the UnhandledPromiseRejectionWarning
      // in Node.js v6.6.0 and higher.
      impl.execute(context, next, done).catch(function() { });
    };
    middleware.impl = impl;
    robot.receiveMiddleware(middleware);
    logger.info(null, 'registered receiveMiddleware');

  } catch (err) {
    logger.error(null, 'receiveMiddleware registration failed:',
      err instanceof Error ? err.message : err);
  }
};
```

What you're doing is making the `impl` object a property of the `middleware`
function itself. That will allow you to do this in the top-level `beforeEach`
hook:

```js
    patchReactMethodOntoRoom(room);
    room.robot.middleware.receive.stack[0].impl.slackClient.client = {
      getChannelByID: function() {
        return { name: 'handbook' };
      },
      team: { domain: 'mbland' }
    };
    apiStubServer.urlsToResponses = apiServerDefaults();
```

You're reaching all the way into the receive middleware stack and all the way
into your `Middleware` and `SlackClient` implementations to make this patch.
Ugly, but effective.

## Capturing log messages in the presence of `Promises`

Run the test now and watch what happens:

```sh
$ npm test -- --grep '^Integration '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration "

[17:21:16] Using gulpfile .../unit-testing-node/gulpfile.js
[17:21:16] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
    ✓ should not register if the config file is invalid
[Sun Jan 24 2016 17:21:16 GMT-0500 (EST)] INFO mbland-unit-testing-node: C5150OU812:1360782804.083113: matches rule: Rule { reactionName: 'evergreen_tree', githubRepository: 'handbook' }
[Sun Jan 24 2016 17:21:16 GMT-0500 (EST)] INFO mbland-unit-testing-node: C5150OU812:1360782804.083113: getting reactions for https://mbland.slack.com/archives/handbook/p1360782804083113
[Sun Jan 24 2016 17:21:16 GMT-0500 (EST)] INFO mbland-unit-testing-node: C5150OU812:1360782804.083113: making GitHub request for https://mbland.slack.com/archives/handbook/p1360782804083113
[Sun Jan 24 2016 17:21:16 GMT-0500 (EST)] INFO mbland-unit-testing-node: C5150OU812:1360782804.083113: adding heavy_check_mark
[Sun Jan 24 2016 17:21:16 GMT-0500 (EST)] INFO mbland-unit-testing-node: C5150OU812:1360782804.083113: created: https://github.com/mbland/handbook/issues/1
    ✓ should create a GitHub issue given a valid reaction (54ms)


  3 passing (251ms)

[17:21:16] Finished 'test' after
```

Now it looks like the test and the code are doing exactly what they should be
doing. All you have to do is add the proper scaffolding and assertions to
clean up the test framework's output and validate the behavior
programmatically.

What you'll need to do now is capture the logs from the `room.user.react`
event. The problem is, `room.user.react` returns a `Promise`, and the
`LogHelper` isn't currently set up to handle this. There's an easy way around
that, however. First, refactor `LogHelper.capture` to this:

```js
LogHelper.prototype.beginCapture = function() {
  sinon.stub(process.stdout, 'write', this.recordMessages);
  sinon.stub(process.stderr, 'write', this.recordMessages);
};

LogHelper.prototype.endCapture = function() {
  process.stderr.write.restore();
  process.stdout.write.restore();
};

LogHelper.prototype.capture = function(callback) {
  this.beginCapture();

  try {
    return callback();
  } finally {
    this.endCapture();
  }
};
```

Then add these two functions, remembering to watch out for [Promise
gotcha #1: not returning the `Promise`](#promises-gotcha-1):

```js
LogHelper.prototype.endCaptureResolve = function() {
  var helper = this;

  return function(value) {
    helper.endCapture();
    return Promise.resolve(value);
  };
};

LogHelper.prototype.endCaptureReject = function() {
  var helper = this;

  return function(err) {
    helper.endCapture();
    return Promise.reject(err);
  };
};
```

You still need the other `logHelper.capture` call because
`scriptHelper.createRoom` may raise an error. Update the test case to make use
of the `logHelper`:

```js
  it('should create a GitHub issue given a valid reaction', function(done) {
    logHelper.beginCapture();
    room.user.react('mbland', helpers.REACTION).should.be.fulfilled
      .then(logHelper.endCaptureResolve(), logHelper.endCaptureReject())
      .then(function() {
    }).should.notify(done);
  });
```

Run the tests to make sure they still pass and that the log output is properly
captured.

## Writing the test assertions

Finally: With all this infrastructure in place, you're ready to write some
honest-to-goodness test assertions. Check the messages posted to the `room`
object during the course of the application flow:

```js
      .then(function() {
        room.messages.should.eql([
          ['mbland', 'evergreen_tree'],
          ['hubot', '@mbland created: ' + helpers.ISSUE_URL]
        ]);
```

Run the test and make sure it passes. Change one of the messages in the
assertion, and make sure the test fails.

Once you've done that, figure out how to validate the log messages. Start with
an empty assertion:

```js
    it('should create a GitHub issue', function() {
      room.messages.should.eql([
        ['mbland', 'evergreen_tree'],
        ['hubot', '@mbland created: ' + helpers.ISSUE_URL]
      ]);
      logHelper.filteredMessages().should.eql([
      ]);
    });
```

Run the test to see what you're in for:

```sh
$ npm test -- --grep '^Integration '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration "

[17:25:14] Using gulpfile .../unit-testing-node/gulpfile.js
[17:25:14] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
    ✓ should not register if the config file is invalid
    1) should create a GitHub issue given a valid reaction


  2 passing (279ms)
  1 failing

  1) Integration test should create a GitHub issue given a valid reaction:

      AssertionError: expected [ Array(7) ] to deeply equal []
      + expected - actual

      -[
      -  "INFO reading configuration from /var/folders/kr/qnjc102n0wg_b89_g0jsfbnh0000gp/T/mbland-unit-testing-node-integration-test-config-116024-65738-1ip6jz6"
      -  "INFO registered receiveMiddleware"
      -  "INFO C5150OU812:1360782804.083113: matches rule: Rule { reactionName: 'evergreen_tree', githubRepository: 'handbook' }"
      -  "INFO C5150OU812:1360782804.083113: getting reactions for https://mbland.slack.com/archives/handbook/p1360782804083113"
      -  "INFO C5150OU812:1360782804.083113: making GitHub request for https://mbland.slack.com/archives/handbook/p1360782804083113"
      -  "INFO C5150OU812:1360782804.083113: adding heavy_check_mark"
      -  "INFO C5150OU812:1360782804.083113: created: https://github.com/mbland/handbook/issues/1"
      -]
      +[]

    at exercise/test/integration-test.js:162:45




[17:25:15] 'test' errored after
[17:25:15] Error in plugin 'gulp-mocha'
Message:
    1 test failed.
npm ERR! Test failed.  See above for more details.
```

Lots of repetitive stuff there. Create a helper variable for those first two
messages, which are identical across the two tests you have so far:

```js
describe('Integration test', function() {
  var room, logHelper, apiStubServer, config, apiServerDefaults,
      patchReactMethodOntoRoom, initLogMessages;

  // ...existing implementation...

  initLogMessages = function() {
    return [
      'INFO reading configuration from ' +
        process.env.HUBOT_SLACK_GITHUB_ISSUES_CONFIG_PATH,
      'INFO registered receiveMiddleware'
    ];
  };

  it('should successfully load the application script', function() {
    logHelper.filteredMessages().should.eql(initLogMessages());
  });

  // ...invalid config file test case...

  it('should create a GitHub issue given a valid reaction', function(done) {
    logHelper.beginCapture();
    room.user.react('mbland', helpers.REACTION).should.be.fulfilled
      .then(logHelper.endCaptureResolve(), logHelper.endCaptureReject())
      .then(function() {
        room.messages.should.eql([
          ['mbland', 'evergreen_tree'],
          ['hubot', '@mbland created: ' + helpers.ISSUE_URL]
        ]);
        logHelper.filteredMessages().should.eql(
          initLogMessages().concat([
          ])
        );
    }).should.notify(done);
  });
```

Run the tests; the first two messages should now match. Of the messages that
remain, all are of the form `INFO helpers.MESSAGE_ID: ...`. Let's make another
helper function to wrap a series of messages with this prefix so the test case
can focus on the unique content of each message. You'll also define
`matchingRule` to avoid repeating it in every test that needs it:

```js
describe('Integration test', function() {
  var room, logHelper, apiStubServer, config, apiServerDefaults,
      patchReactMethodOntoRoom, initLogMessages, wrapInfoMessages,
      matchingRule = 'Rule { reactionName: \'evergreen_tree\', ' +
        'githubRepository: \'handbook\' }';

  // ...

  wrapInfoMessages = function(messages) {
    return messages.map(function(message) {
      return 'INFO ' + helpers.MESSAGE_ID + ': ' + message;
    });
  };

  // ...

  it('should create a GitHub issue given a valid reaction', function(done) {
    logHelper.beginCapture();
    room.user.react('mbland', helpers.REACTION).should.be.fulfilled
      .then(logHelper.endCaptureResolve(), logHelper.endCaptureReject())
      .then(function() {
        room.messages.should.eql([
          ['mbland', 'evergreen_tree'],
          ['hubot', '@mbland created: ' + helpers.ISSUE_URL]
        ]);
        logHelper.filteredMessages().should.eql(
          initLogMessages().concat(wrapInfoMessages([
            'matches rule: ' + matchingRule,
            'getting reactions for ' + helpers.PERMALINK,
            'making GitHub request for ' + helpers.PERMALINK,
            'adding ' + config.successReaction,
            'created: ' + helpers.ISSUE_URL
          ]))
        );
    }).should.notify(done);
  });
```

Run the tests again and make sure they all pass.

## Testing a failure case

So much for the happy path. Now let's see what happens when the operation
fails. Start a new test case as follows:

```js
  it('should fail to create a GitHub issue', function(done) {
    var payload = { message: 'test failure' },
        url = '/github/repos/mbland/handbook/issues',
        response = apiStubServer.urlsToResponses[url];

    response.statusCode = 500;
    response.payload = payload;
  });
```

Notice that all you're doing is configuring the GitHub endpoint of the
`apiStubServer` to send a failure response. To eliminate the repetition of
invoking the `logHelper` and `room.user.react`, create a new helper function
in the top level fixture and call it `sendReaction`:

```js
describe('Integration test', function() {
  var room, logHelper, apiStubServer, config, apiServerDefaults,
      patchReactMethodOntoRoom, sendReaction, initLogMessages, wrapInfoMessages,
      // ...other declarations...

  // ...other fixture functions...

  sendReaction = function(reactionName) {
    logHelper.beginCapture();
    return room.user.react('mbland', reactionName)
      .then(logHelper.endCaptureResolve(), logHelper.endCaptureReject());
  };
```

As ever, remain mindful of [Promise gotcha #1: not returning the
`Promise`](#promises-gotcha-1). Then, in the test cases, use `sendReaction` to
replace both the `logHelper.beginCapture` calls and the
`.then(logHelper.endCaptureResolve(), logHelper.endCaptureReject())` clause:

```js
  // ...

  it('should create a GitHub issue given a valid reaction', function(done) {
    sendReaction(helpers.REACTION).should.be.fulfilled.then(function() {

    // You can indent everything here back one level.

    }).should.notify(done);
  });

  it('should fail to create a GitHub issue', function(done) {
    var payload = { message: 'test failure' },
        url = '/github/repos/mbland/handbook/issues',
        response = apiStubServer.urlsToResponses[url];

    response.statusCode = 500;
    response.payload = payload;
    sendReaction(helpers.REACTION).should.be.fulfilled.then(function() {
    }).should.notify(done);
  });
```

Run the test to make sure everything passes. The previous `should create
a GitHub issue` test case should still pass. Now it's time to write the
`should fail to create a GitHub issue` test case. Format the expected error
reply and declare a variable to hold the expected log messages:

```js
    sendReaction(helpers.REACTION).should.be.fulfilled.then(function() {
      var errorReply = 'failed to create a GitHub issue in ' +
            'mbland/handbook: received 500 response from GitHub API: ' +
            JSON.stringify(payload),
          logMessages;
    }).should.notify(done);
```

The assertion for the room messages is pretty straightforward:

```js
      room.messages.should.eql([
        ['mbland', 'evergreen_tree'],
        ['hubot', '@mbland Error: ' + errorReply]
      ]);
```

Building up the `logMessages` is slightly messier, because the last message
containing the error is a little different from the rest. It's not too bad,
though:

```js
      logMessages = initLogMessages().concat(wrapInfoMessages([
        'matches rule: ' + matchingRule,
        'getting reactions for ' + helpers.PERMALINK,
        'making GitHub request for ' + helpers.PERMALINK
      ]));
      logMessages.push('ERROR ' + helpers.MESSAGE_ID + ': ' + errorReply);
      logHelper.filteredMessages().should.eql(logMessages);
```

Run the test and ensure that it passes.

## Testing the unknown reaction case

At last, it's time to test what happens when the middleware receives a reaction
that doesn't match any configuration rules. It should silently ignore the
message. The error responses are to verify that the middleware never attempts
to make any API requests:

```js
  it('should ignore a message receiving an unknown reaction', function(done) {
    Object.keys(apiStubServer.urlsToResponses).forEach(function(url) {
      var response = apiStubServer.urlsToResponses[url];

      response.statusCode = 500;
      response.payload = { message: 'should not happen' };
    });

    sendReaction('sad-face').should.be.fulfilled.then(function() {
      room.messages.should.eql([['mbland', 'sad-face']]);
      logHelper.filteredMessages().should.eql(initLogMessages());
    }).should.notify(done);
  });
```

Run the tests and ensure that they all pass. And that's it!

## Preventing `Errors` from escaping the application interface boundary

As mentioned in the `Middleware` chapter, [you should endeavor to prevent
any `Errors` escaping our application's interface
boundary]({{ site.baseurl }}/components/middleware/#interface-boundary).
Because you've already written `Middleware.execute` such that any unexpected
errors are caught and logged, you don't need to worry about testing it again
here.

However, it's such an important concept that it's worth reiterating. If
`Middleware.execute` throws any `Errors`, that could prevent other Hubot
scripts from working normally.

## Reflect on your work

This may have seemed like a lot of work for just a few tests, but consider a
few points:

- You now have reasonable confidence that all the code you've written works
  together as it should, even without using test doubles for some internal
  components.
- You have reasonable confidence that the entire script accesses the
  environment variables, the configuration file, and the external HTTP servers
  as expected.
- Given the amount of setup required for this test, the test is clearer for
  not having to exercise every corner case of the application.
- Making updates to one particular class won't require as much state and setup
  as was required for this test.
- _You didn't need all this state and setup to begin writing pieces of your
  application and testing them exhaustively._

## Check your work

By this point, all of the integration tests should be passing:

```sh
$ npm test -- --grep '^Integration '

> mbland-unit-testing-node@0.0.0 test .../unit-testing-node
> gulp test "--grep" "^Integration "

[19:23:53] Using gulpfile .../unit-testing-node/gulpfile.js
[19:23:53] Starting 'test'...


  Integration test
    ✓ should successfully load the application script
    ✓ should not register if the config file is invalid
    ✓ should create a GitHub issue given a valid reaction (61ms)
    ✓ should fail to create a GitHub issue
    ✓ should ignore a message receiving an unknown reaction


  5 passing (276ms)

[19:23:54] Finished 'test' after
```

Now that you're finished, compare your solutions to the code in
[`solutions/06-integration/scripts/slack-github-issues.js`]({{ site.baseurl }}/solutions/06-integration/scripts/slack-github-issues.js)
[`solutions/06-integration/test/integration-test.js`]({{ site.baseurl }}/solutions/06-integration/test/integration-test.js).

At this point, `git commit` your work to your local repo. After you do, copy
the `integration-test.js` file from `solutions/06-integration/test` into
`exercises/test` to see if your implementation passes. If a test case fails,
review the section of this chapter pertaining to the failing test case, then
try to update your code to make the test pass.
