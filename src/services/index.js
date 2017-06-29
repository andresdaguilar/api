import models from '../models';
import mongoose from 'mongoose';
import feathers from 'feathers';
import googleServices from './google';
const service = require('feathers-mongoose');

module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  const db = mongoose.createConnection(process.env.DATABASE_URL || 'mongodb://localhost/content')
  const { Article, Category, Country, CountryCategory } = models(db);
  const { driveService} = googleServices;

  app.get('/api/preview-html/:id', (rq, rs) => {
    return driveService.get(rq.params.id).then((o) => rs.render('preview.mustache', {inner: o}))
  });
  app.use('/api/drive', driveService);
  app.use('/api/articles', service({ Model: Article }));
  app.use('/api/categories', service({ Model: Category }));
  app.use('/api/countries', service({ Model: Country }));
  app.use('/api/country-categories', service({ Model: CountryCategory }));
};
