'use strict';

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = function () {
  return function (hook) {
    var message = hook.type + ': ' + hook.path + ' - Method: ' + hook.method;

    if (hook.type === 'error') {
      message += ': ' + hook.error.message;
    }

    _winston2.default.info(message);
    _winston2.default.debug('hook.data', hook.data);
    _winston2.default.debug('hook.params', hook.params);

    if (hook.result) {
      _winston2.default.debug('hook.result', hook.result);
    }

    if (hook.error) {
      _winston2.default.error(hook.error);
    }
  };
}; // A hook that logs service method before, after and error
//# sourceMappingURL=logger.js.map