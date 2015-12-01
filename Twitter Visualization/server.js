// Set up web server, express and socket
var twitter = require('twitter');
var url = '';
var MongoClient = require('mongodb').MongoClient;
var twitter = require('twitter');
var AWS = require('aws-sdk');
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  // other service API versions
};
AWS.config.update({accessKeyId: '', secretAccessKey: ''});

var sqs = new AWS.SQS({region:'us-east-1'});
express = require('express'),
app = express(),

http = require('http'),
server = http.createServer(app),
io = require('socket.io').listen(server);

var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var AlchemyAPI = require('alchemy-api')

//Setup twitter stream api
var twit = new twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
}),
stream = null;




//Use the default port (for beanstalk) or default to 8081 locally
server.listen(process.env.PORT || 8081);
//Setup rotuing for app
app.use(express.static(__dirname + '/twitter'));
MongoClient.connect(url, function(err, db) {
  console.log("Connected to Mongo");
  //assert.equal(null, err);
  //Create web sockets connection.
  io.sockets.on('connection', function (socket) {



    function getTrends(woeid) {
      var params = {id: woeid};
      twit.get('trends/place', params, function(error, tweets, response){
        if (!error) {
          name = [], urls = [];
          trends = tweets[0];
          trends["error"] = false;
          if(socket !== undefined) {
            socket.emit("trends:response", trends);
          }
        } else {
          console.log(error);
          socket.emit("trends:response", {'trends': {'error':true, log:error[0]}})
        }
      });
    }
    socket.on("start tweets", function() {

      if(stream === null) {
        //Connect to twitter stream passing in filter for entire world.
        twit.stream('statuses/filter', {track : 'love, football, tech, apple, bad, terrible'}, function(stream) {
          stream.on('data', function(data) {
            if (data.coordinates){
              console.log("Tweet with location data found");
              db.collection('tweetRecords').insertOne({
                "tweet_id" : data.id,
                "tweet_id_str" : data.id_str,
                "tweet_created_at" : data.created_at,
                "tweet_timestamp" : data.timestamp_ms,
                "tweet_lang" : data.lang,
                "tweet_text" : data.text,
                "geo":data.geo,
                "retweet_count" : data.retweet_count,
                "favourite_count" : data.favorite_count,
                "coordinate":data.coordinates,
                "sentiment": ""
              }
              , function(err, result) {
                if(err)
                {
                  console.log(err);
                  throw err;
                }
              });
              var params = {
                QueueName: 'TwitterProcessor', /* required */
              };
              // sqs.getQueueUrl(params, function(err, queueData) {
              //   if (err) console.log(err, err.stack); // an error occurred
              //   else {
              var outputPoint = {lat: data.coordinates.coordinates[0],lng: data.coordinates.coordinates[1], id : data.id,   text : data.text};
              console.log("Got queue URL " +data);
              var messageparams = {
                MessageBody: JSON.stringify(outputPoint), /* required */
                QueueUrl: '' , /* required */
                DelaySeconds: 0
              };
              sqs.sendMessage(messageparams, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     console.log("Message sent " + data);           // successful response
              });
              //  }         // successful response
              //  });
              //Publish to SQS Queue here


            }
          });
        });
      }

    });

    app.post('/', function (req, res) {
      var bodyarr = []
      req.on('data', function(chunk){
        bodyarr.push(chunk);
      })
      req.on('end', function(){
        var result = bodyarr.join();
        var jsonVariable = JSON.parse(result);
        console.log(jsonVariable);
        console.log("Publishing to map here -" + jsonVariable.Message);
        socket.broadcast.emit("keyword-twitter-stream-data", jsonVariable.Message);
        //Send out to web sockets channel.
        socket.emit('keyword-twitter-stream-data', jsonVariable.Message);
      })
      res.send('POST request to homepage');

    });
    socket.on("trend:request", function(keyword) {
      getTrends(keyword.woeid);

    });


    socket.on("start tweets with keyword", function(keyword) {
      var capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      console.log(capitalizedKeyword);
      var cursor;
      if(keyword == "all")
      {
        cursor = db.collection('tweetRecords').find().limit(3000);
        cursorPositive = db.collection('tweetRecords').find({"sentiment" : "positive"}).count(function(err,positiveCount){
          console.log("Positive" + positiveCount);
          cursorNegative = db.collection('tweetRecords').find({"sentiment" : "negative"}).count(function(err,negativeCount){
            console.log("Negative" + negativeCount);
            var tweetCount = {"positive": positiveCount,"negative": negativeCount};
            console.log("Emitting count here");
            socket.emit('change-bg-color' , tweetCount);
          });
        });

      }
      else {
        cursor = db.collection('tweetRecords').find( { $or: [ { "tweet_text" :  new RegExp(keyword) } , {"tweet_text" :  new RegExp(capitalizedKeyword)} ] }).limit(3000);
        cursorPositive = db.collection('tweetRecords').find( { $and: [ { $or: [ { "tweet_text" :  new RegExp(keyword) } , {"tweet_text" :  new RegExp(capitalizedKeyword)} ] }, {"sentiment" : "positive"} ]}).count(function(err,positiveCount){
          console.log("Positive" + positiveCount);
          cursorNegative = db.collection('tweetRecords').find( { $and: [ { $or: [ { "tweet_text" :  new RegExp(keyword) } , {"tweet_text" :  new RegExp(capitalizedKeyword)} ] }, {"sentiment" : "negative"} ]}).count(function(err,negativeCount){
            console.log("Negative" + negativeCount);
            var tweetCount = {"positive": positiveCount,"negative": negativeCount};
            console.log("Emitting count here");
            socket.emit('change-bg-color' , tweetCount);
          });
        });
      }
      cursor.each(function(err, doc) {
        assert.equal(err, null);
        if (doc != null) {
          // console.log("Entered cursor");
          // console.log(doc.tweet_text);
          if(doc.coordinate !== null)
          {
            var outputPoint = {"lat": doc.coordinate.coordinates[0],"lng": doc.coordinate.coordinates[1],"text" : doc.tweet_text, "sentiment":doc.sentiment};
            socket.broadcast.emit("keyword-twitter-stream", outputPoint);
            //Send out to web sockets channel.
            socket.emit('keyword-twitter-stream', outputPoint);
          }
        }

      });
    });



    console.log("Emitting connected");
    socket.emit("connected");
  });
});

function getTrends(woeid) {
  var params = {id: woeid};
  client.get('trends/place', params, function(error, tweets, response){
    if (!error) {
      name = [], urls = [];
      trends = tweets[0];
      trends["error"] = false;
      if(curSocket !== undefined) {
        curSocket.emit("trends:response", trends);
      }
    } else {
      console.log(error);
      curSocket.emit("trends:response", {'trends': {'error':true, log:error[0]}})
    }
  });
}
