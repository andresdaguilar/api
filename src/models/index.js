import mongoose, { Schema } from 'mongoose';
import autopopulate from 'mongoose-autopopulate'

var articleSchema = new Schema({
    title: String,
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
articleSchema.plugin(autopopulate);

var categorySchema = new Schema({
    name: String,
    translations: [{
        language: String,
        name: String,
    }]
});

var countrySchema = new Schema({
    name: String,
    translations: [{
        language: String,
        name: String,
    }],
    content: [{
        category: { type: Schema.Types.ObjectId, ref: 'Category', autopopulate: true, required: true },
        articles: [{ type: Schema.Types.ObjectId, ref: 'Article', autopopulate: { 'select': ['title', 'lede', 'translations.lede', "translations.language", "translations.title"] } },],
    }]
});
countrySchema.plugin(autopopulate);


var countryCategorySchema = new Schema({
    category: { type: Schema.Types.ObjectId, ref: 'Category', autopopulate: true, required: true },
    country: { type: Schema.Types.ObjectId, ref: 'Country', autopopulate: true, required: true },
    articles: [{ type: Schema.Types.ObjectId, ref: 'Article', autopopulate: true },],
    index: Number,
});
countryCategorySchema.plugin(autopopulate);

const Article = (db) => db.model('Article', articleSchema);
const Category = (db) => db.model('Category', categorySchema);
const Country = (db) => db.model('Country', countrySchema);
const CountryCategory = (db) => db.model('CountryCategory', countryCategorySchema);

export default (db) => ({
    Article: Article(db),
    Category: Category(db),
    Country: Country(db),
    CountryCategory: CountryCategory(db),
});