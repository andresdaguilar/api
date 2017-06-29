'use strict';

var _models2 = require('../models');

var _models3 = _interopRequireDefault(_models2);

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _feathers = require('feathers');

var _feathers2 = _interopRequireDefault(_feathers);

var _google = require('./google');

var _google2 = _interopRequireDefault(_google);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var service = require('feathers-mongoose');

module.exports = function () {
  var app = this; // eslint-disable-line no-unused-vars
  var db = _mongoose2.default.createConnection(process.env.DATABASE_URL || 'mongodb://localhost/content');

  var _models = (0, _models3.default)(db),
      Article = _models.Article,
      Category = _models.Category,
      Country = _models.Country,
      CountryCategory = _models.CountryCategory;

  var driveService = _google2.default.driveService;


  app.get('/api/preview-html/:id', function (rq, rs) {
    return driveService.get(rq.params.id).then(function (o) {
      return rs.render('preview.mustache', { inner: o });
    });
  });
  app.use('/api/drive', driveService);
  app.use('/api/articles', service({ Model: Article }));
  app.use('/api/categories', service({ Model: Category }));
  app.use('/api/countries', service({ Model: Country }));
  app.use('/api/country-categories', service({ Model: CountryCategory }));
};
//# sourceMappingURL=index.js.map