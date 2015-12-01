
var fs = require("fs");
var db;
var insertDocument;
var url = '';
var MongoClient = require('mongodb').MongoClient;
if(typeof require !== 'undefined') XLSX = require('xlsx');
var twitter = require('twitter');
var AWS = require('aws-sdk');
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  // other service API versions
};
AWS.config.update({accessKeyId: '', secretAccessKey: ''});

var sqs = new AWS.SQS({region:'us-east-1'});

// var params = {
//   QueueName: 'TwitterProcessor', /* required */
// };
// sqs.createQueue(params, function(err, data) {
//   if (err) console.log(err, err.stack); // an error occurred
//   else     console.log("Queue created" + data);           // successful response
// });

var twit = new twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
}),
stream = null;


MongoClient.connect(url, function(err, db) {

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
