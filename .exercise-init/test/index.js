(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

describe('Config', function() {
  it('should validate a valid configuration', function() {
  });
});

},{}],2:[function(require,module,exports){
'use strict';

describe('GitHubClient', function() {
  it('should successfully file an issue', function() {
  });
});

},{}],3:[function(require,module,exports){
'use strict';

describe('Integration test', function() {
  it('should successfully load the application script', function() {
  });
});

},{}],4:[function(require,module,exports){
'use strict';

describe('Logger', function() {
  it('should prefix info messages with the script name', function() {
  });
});

},{}],5:[function(require,module,exports){
'use strict';

describe('Middleware', function() {
  describe('parseMetadata', function() {
    it('should parse GitHub request metadata from a message', function() {
    });
  });

  describe('findMatchingRule', function() {
    it('should find the rule matching the message', function() {
    });
  });

  describe('execute', function() {
    it('should successfully parse a message and file an issue', function(done) {
      done();
    });
  });
});

},{}],6:[function(require,module,exports){
'use strict';

describe('Rule', function() {
  it('should contain all the fields from the configuration', function() {
  });
});

},{}],7:[function(require,module,exports){
'use strict';

describe('SlackClient', function() {
  describe('getReactions', function() {
    it('should make a successful request', function() {
    });
  });
});

},{}],8:[function(require,module,exports){
'use strict';

require('./config-test.js');
require('./github-client-test.js');
require('./integration-test.js');
require('./logger-test.js');
require('./middleware-test.js');
require('./rule-test.js');
require('./slack-client-test.js');

},{"./config-test.js":1,"./github-client-test.js":2,"./integration-test.js":3,"./logger-test.js":4,"./middleware-test.js":5,"./rule-test.js":6,"./slack-client-test.js":7}]},{},[8]);
