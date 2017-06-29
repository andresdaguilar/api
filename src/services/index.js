import models from '../models';
import mongoose from 'mongoose';
import feathers from 'feathers';
import googleServices from './google';
import _ from 'lodash';
const request = require('request-promise');

const service = require('feathers-mongoose');

module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  const db = mongoose.createConnection(process.env.DATABASE_URL || 'mongodb://localhost/content')
  const { Article, Category, Country, CountryCategory } = models(db);
  const { driveService, utils } = googleServices;

  app.get('/api/preview-html/:id', (rq, rs) => {
    return driveService.get(rq.params.id).then((o) => rs.render('preview.mustache', { inner: o }))
  });
  app.get('/api/preview-doc/:id', (rq, rs) => {
    return utils.generateDocument(rq.params.id).then((d) => {
      let a = new Article(d);
      a.save().then(() => {
        rs.send(a);
      })
    });
  });
  app.get('/api/parse-image/', (rq, rs) => {

  });

  app.get('/api/articles/:id/preview', (rq, rs) => {
    Article.find({slug: rq.params.id}).then((a) => {
      console.log(a);
    rs.render('preview-article.mustache', _.first(a));
    })
  });
  app.use('/api/drive', driveService);
  app.use('/api/articles', service({ Model: Article, id: 'slug' }));
  app.use('/api/categories', service({ Model: Category }));
  app.use('/api/countries', service({ Model: Country }));
  app.use('/api/country-categories', service({ Model: CountryCategory }));
};
