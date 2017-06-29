'use strict';

var path = require('path');
var favicon = require('serve-favicon');
var compress = require('compression');
var cors = require('cors');
var helmet = require('helmet');
var bodyParser = require('body-parser');

var feathers = require('feathers');
var configuration = require('feathers-configuration');
var hooks = require('feathers-hooks');
var rest = require('feathers-rest');
var socketio = require('feathers-socketio');

var handler = require('feathers-errors/handler');
var notFound = require('feathers-errors/not-found');

var middleware = require('./middleware');
var services = require('./services');
var appHooks = require('./app.hooks');

var app = feathers();

// Load app configuration
app.configure(configuration());
// Enable CORS, security, compression, favicon and body parsing
app.use(cors());
app.use(helmet());
app.use(compress());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(favicon(path.join(app.get('public'), 'favicon.ico')));
// Host the public folder
app.use('/', feathers.static(app.get('public')));

// Set up Plugins and providers
app.configure(hooks());
app.configure(rest());
app.configure(socketio());

// Configure other middleware (see `middleware/index.js`)
app.configure(middleware);
// Set up our services (see `services/index.js`)
app.configure(services);
// Configure a middleware for 404s and the error handler
app.use(notFound());
app.use(handler());

app.hooks(appHooks);

module.exports = app;
//# sourceMappingURL=app.js.map