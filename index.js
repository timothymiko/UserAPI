// 
//  TODO:
//		1. Prevent duplicate usernames and emails
//
// 	If having issues with mongodb, run the following command: 'ps wuax | grep mongo'
//	Then find the mongodb process id and run 'kill #'
//


// 
// SETUP
// 
MongoClient = require('mongodb').MongoClient,
Server = require('mongodb').Server,
User = require('./users').User,
UsersAPI = require('./users').UsersAPI;

// define some variables
var https = require('https'),
	fs = require('fs'),
	express = require('express'),
	bodyParser = require('body-parser'),
	session = require('express-session'),
	MongoStore = require('connect-mongo')(session);
	cookieParser = require('cookie-parser');

var hskey = fs.readFileSync('./ssl/datonicgroup-test-key.pem'),
	hscert = fs.readFileSync('./ssl/datonicgroup-test-cert.pem');

var options = { key: hskey, cert: hscert };

var mongoHost = 'localHost',
	mongoPort = 27017,
	mongoClient = new MongoClient(new Server(mongoHost, mongoPort));

var app = express();
// var redisClient = redis.createClient();
var usersApi;

// setup a handle to mongodb
mongoClient.open(function(err, mongoClient) {
  if (!mongoClient) {
      console.error("Error! Exiting... Must start MongoDB first");
      process.exit(1);
  }
  usersApi = new UsersAPI(mongoClient);
});

var authenticate = function(req, res, next) {
	if (req.session.user_id) { next(); }
	else { res.status(401).end(); }
};

// set up express server
app.set('port', process.env.PORT || 3000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
	resave: false, // don't save session if unmodified
	saveUninitialized: true, // don't create session until something stored
	secret: 'LIUHKJQ2H34KJHASFE9080234KJ12390182FASD8FQ09330U',
	store: new MongoStore({
		host: 'localhost',
		port: 27017,
		db: 'user-sessions',
		ttl: 14 * 24 * 60 * 60 // = 14 days.
	}),
	cookie: { secure: true }
}));

//
// ENDPOINTS
// 
app.get('/', function(req, res) {
    res.send('HEY! Your HTTPS Express Node.js server is working!');
});

// user endpoints
app.post('/users/register', function(req, res) {
	var user = new User(req.body.username, req.body.email, req.body.password);
	usersApi.register(user, function(err, acc) {
		if (err) { 
			if ( typeof err == "string" && (err == "Email already exists." || err == "Username already exists.") ) {
				res.status(409).send(err);
			} else {
				res.status(400).end();
			}
		} else { 
			console.log('User successfully registered: ', acc);
			var results = {
				username: acc.username,
				email: acc.email
			};
			res.status(201).send(results);
		}
	});
});
app.get('/users/login', function(req, res) {
	var user = new User(req.query.username, "", req.query.password);
	usersApi.login(user, function(err, result, acc) {
		if (err) { res.status(400).send(err); } 
		else if ( !result ) { res.status(401).end(); }
		else {
			var results = {
				username: acc.username,
				email: acc.email
			};
			
			req.session.regenerate(function(err){
				if (!err) {
					req.session.user_id = acc._id;
					console.log('User login: ', results.username);
					console.log('Session data: ', req.session);
					res.status(200).send(results);
				}
			});
		}
	});
});
app.put('/users/update', function(req, res) {
	authenticate(req, res, function() {
		var user = new User(req.body.username, req.body.email, req.body.password);
		usersApi.update(req.session.user_id, user, function(err, acc) {
			if (err) { 
				if ( typeof err == "string" && (err == "Email already exists." || err == "Username already exists.") ) {
					res.status(409).send(err);
				} else {
					res.status(400).end();
				}
			} else { 
				console.log('User updated: ' + acc);
				req.session.user_id = acc._id;
				res.status(200).end(); 
			}
		});
	});
});
app.post('/users/logout', function(req, res) {
	authenticate(req, res, function() {
		console.log('User logged out: ', req.session.username);
		req.session.destroy(function(err) {
			res.status(200).end(); 
		});
	});
});
app.delete('/users/delete', function(req, res) {
	authenticate(req, res, function() {
		var username = req.session.username;
		usersApi.delete(req.session.user_id, function(err, result) {
			if ( err ) { res.status(400).send(err); }
			else { 
				console.log('User deleted: ', username);
				// remove cookie to prevent user from causing issues
				req.session.destroy(function(err) {
					res.status(200).end(); 
				});
			}
		});
	});
});

// 
// run the server
// 
https.createServer(options, app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});