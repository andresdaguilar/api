import models from '../models';
import mongoose from 'mongoose';
import feathers from 'feathers';
import googleServices from './google';
import http from 'http';
const request = require('request-promise');
const mime = require('mime');

const service = require('feathers-mongoose');
import Jimp from 'jimp';

module.exports = function () {
  const app = this; // eslint-disable-line no-unused-vars
  const db = mongoose.createConnection(process.env.DATABASE_URL || 'mongodb://localhost/content')
  const { Article, Category, Country, CountryCategory } = models(db);
  const { driveService } = googleServices;

  app.get('/api/preview-html/:id', (rq, rs) => {
    return driveService.get(rq.params.id).then((o) => rs.render('preview.mustache', { inner: o }))
  });
  app.get('/api/parse-image/', (rq, rs) => {
    Jimp.read(rq.query.url, function (err, image) {
      if (err) throw err;

      if ((image.bitmap.width / image.bitmap.height) < Math.sqrt(5)) {
        image = image.crop(0, 0, image.bitmap.width, image.bitmap.width /  Math.sqrt(5));
      } else {
        image = image.scaleToFit(image.bitmap.width, image.bitmap.width /  Math.sqrt(5));
      }

      image
        //.resize(256, 256)            // resize
        .quality(50)                 // set JPEG quality
        .getBuffer('image/jpeg', (a, b) => {

          rs.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': b.length
          });
          rs.end(b);

        }); // save
    });
  });
  app.use('/api/drive', driveService);
  app.use('/api/articles', service({ Model: Article }));
  app.use('/api/categories', service({ Model: Category }));
  app.use('/api/countries', service({ Model: Country }));
  app.use('/api/country-categories', service({ Model: CountryCategory }));
};
