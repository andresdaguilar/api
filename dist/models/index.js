'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

var _mongooseAutopopulate = require('mongoose-autopopulate');

var _mongooseAutopopulate2 = _interopRequireDefault(_mongooseAutopopulate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var articleSchema = new _mongoose.Schema({
    title: String,
    author: String,
    lede: String,
    body: String,
    translations: [{
        title: String,
        lede: String,
        body: String,
        language: String
    }],
    date: { type: Date, default: Date.now }
});
articleSchema.plugin(_mongooseAutopopulate2.default);

var categorySchema = new _mongoose.Schema({
    name: String,
    translations: [{
        language: String,
        name: String
    }]
});

var countrySchema = new _mongoose.Schema({
    name: String,
    translations: [{
        language: String,
        name: String
    }],
    content: [{
        category: { type: _mongoose.Schema.Types.ObjectId, ref: 'Category', autopopulate: true, required: true },
        articles: [{ type: _mongoose.Schema.Types.ObjectId, ref: 'Article', autopopulate: { 'select': ['title', 'lede', 'translations.lede', "translations.language", "translations.title"] } }]
    }]
});
countrySchema.plugin(_mongooseAutopopulate2.default);

var countryCategorySchema = new _mongoose.Schema({
    category: { type: _mongoose.Schema.Types.ObjectId, ref: 'Category', autopopulate: true, required: true },
    country: { type: _mongoose.Schema.Types.ObjectId, ref: 'Country', autopopulate: true, required: true },
    articles: [{ type: _mongoose.Schema.Types.ObjectId, ref: 'Article', autopopulate: true }],
    index: Number
});
countryCategorySchema.plugin(_mongooseAutopopulate2.default);

var Article = function Article(db) {
    return db.model('Article', articleSchema);
};
var Category = function Category(db) {
    return db.model('Category', categorySchema);
};
var Country = function Country(db) {
    return db.model('Country', countrySchema);
};
var CountryCategory = function CountryCategory(db) {
    return db.model('CountryCategory', countryCategorySchema);
};

exports.default = function (db) {
    return {
        Article: Article(db),
        Category: Category(db),
        Country: Country(db),
        CountryCategory: CountryCategory(db)
    };
};
//# sourceMappingURL=index.js.map