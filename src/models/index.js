import mongoose, { Schema } from 'mongoose';
import autopopulate from 'mongoose-autopopulate'

var articleSchema = new Schema({
    title: String,
    slug: { type: String, unique: true },
    author: String,
    lede: String,
    hero: String,
    body: String,
    translations: [{
        title: String,
        lede: String,
        body: String,
        language: String
    }],
    date: { type: Date, default: Date.now },
});

var categorySchema = new Schema({
    name: String,
    slug: { type: String, unique: true },
    translations: [{
        language: String,
        name: String,
    }]
});

var locationSchema = new Schema({
    name: String,
    slug: { type: String, unique: true },
    translations: [{
        language: String,
        name: String,
    }]
});

var countrySchema = new Schema({
    name: String,
    slug: { type: String, unique: true },
    translations: [{
        language: String,
        name: String,
    }],
    content: [{
        category: { type: Schema.Types.ObjectId, ref: 'Category', },
        articles: [{ type: Schema.Types.ObjectId, ref: 'Article', },],
    }],
    locations: [{
        location: { type: Schema.Types.ObjectId, ref: 'Location', },
        content: [{
            category: { type: Schema.Types.ObjectId, ref: 'Category', },
            articles: [{ type: Schema.Types.ObjectId, ref: 'Article', },],
        }]
    }]
});

var populateCountry = function(next) {
  this.populate('content.category');
  this.populate('content.articles', ['slug', 'title', 'lede', 'translations.lede', "translations.language", "translations.title"]);

  this.populate('locations.location');
  this.populate('locations.content.category');
  this.populate('locations.content.articles', ['slug', 'title', 'lede', 'translations.lede', "translations.language", "translations.title"]);

  next();
};

countrySchema.
  pre('findOne', populateCountry).
  pre('find', populateCountry);


var countryCategorySchema = new Schema({
    category: { type: Schema.Types.ObjectId, ref: 'Category', autopopulate: true, required: true },
    country: { type: Schema.Types.ObjectId, ref: 'Country', autopopulate: true, required: true },
    articles: [{ type: Schema.Types.ObjectId, ref: 'Article', autopopulate: true },],
    index: Number,
});
countryCategorySchema.plugin(autopopulate);

const Article = (db) => db.model('Article', articleSchema);
const Category = (db) => db.model('Category', categorySchema);
const Location = (db) => db.model('Location', locationSchema);
const CountryCategory = (db) => db.model('CountryCategory', countryCategorySchema);
const Country = (db) => db.model('Country', countrySchema);

export default (db) => ({
    Article: Article(db),
    Category: Category(db),
    CountryCategory: CountryCategory(db),
    Location: Location(db),
    Country: Country(db),
});