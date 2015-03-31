CollectionDriver = require('./collectionDriver').CollectionDriver;

const users_collection = "users";
var bcrypt = require('bcrypt');
var ObjectID = require('mongodb').ObjectID;

var hashPassword = function(password, callback) {
	bcrypt.genSalt(10, function(err, salt) {
		if (err) { 
			console.log(err);
			callback(err); 
		} else {
			bcrypt.hash(password, salt, function(err, hash) {
				if (err) { 
					console.log(err);
					callback(err); 
				} else {
					callback(null, hash);
				}
			});
		}
	});	
};

User = function (username, email, password) {
	this.username = username;
	this.email = email;
	this.password = password;
};

UsersAPI = function (mongoClient) {
	this.mongoClient = mongoClient;
	this.db = this.mongoClient.db(users_collection);
	
	var db = this.db;
	var collectionDriver = new CollectionDriver(db);
	
	collectionDriver.findAll(users_collection, function(err, results) {
		console.log('Users: ');
		console.log(results);
	});
	
	this.register = function(user, callback) {
		collectionDriver.getCollection(users_collection, function(error, the_collection) {
			if ( error ) {
				console.log("Error: " + error);
				callback(error);
			} else {
				the_collection.findOne({ $or: [ {'username':user.username}, {'email':user.email} ] }, function(err, acc) {
					if (err) { callback(err); }
					else if (acc) { 
						if (acc.username == user.username) {
							callback("Username already exists."); 
						} else {
							callback("Email already exists."); 
						}
					} else {
						hashPassword(user.password, function(err, hash) {
							if (err) {
								callback(err);
							} else {
								user.password = hash;
								collectionDriver.save(users_collection, user, function(err, acc) {
									callback(err, acc);
								});
							}
						});
					}
				});
			}
		});
	};
	
	this.login = function(user, callback) {
		collectionDriver.getCollection(users_collection, function(error, the_collection) {
			if ( error ) callback(error);
			else the_collection.findOne({'username':user.username}, function(error, acc) {
				if ( error ) callback(error);
				else if ( !acc ) callback("User does not exist");
				else {
					bcrypt.compare(user.password, acc.password, function(err, res) {
						if (err) { callback(err); }
						else { callback(null, res, acc); }
					});
				}
			});
		});
	};
	
	this.update = function(id, user, callback) {
		collectionDriver.getCollection(users_collection, function(err, the_collection) {
			if ( err ) {
				console.log("Error: " + err);
				callback(err);
			} else {
			
				console.log("ID: " + id);
				var query = {
					$and: [
						{'_id': { $ne: ObjectID(id) } },
						{ $or: [ {'username':user.username}, {'email':user.email} ] }
					]
				};
				
				the_collection.findOne(query, function(err, acc) {
					if (err) { 
						callback(err); 
					} else if (acc) { 
						if (acc.username == user.username) {
							callback("Username already exists."); 
						} else {
							callback("Email already exists."); 
						}
					} else {
						hashPassword(user.password, function(err, hash) {
							if (err) {
								callback(err);
							} else {
								user.password = hash;
								collectionDriver.update(users_collection, user, id, function(error, acc) {
									if ( error ) { callback(error); }
									else { callback(null, acc); }
								});
							}
						});
					}
				});
			}
		});
	};
	
	this.delete = function(_id, callback) {
		collectionDriver.delete(users_collection, _id, function(error, acc) {
			if ( error ) { callback(error); }
			else { callback(null, true); }
		});
	};
};

exports.UsersAPI = UsersAPI;
exports.User = User;