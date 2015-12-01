var Consumer = require('sqs-consumer');
var AlchemyAPI = require('alchemy-api');
var url = '';
var MongoClient = require('mongodb').MongoClient;
var AWS = require('aws-sdk');
AWS.config.apiVersions = {
  sqs: '2012-11-05',
  // other service API versions
};
AWS.config.update({accessKeyId: '', secretAccessKey: ''});
var sns = new AWS.SNS({region:'us-east-1'});
// var params = {
//   Name: 'TweetsToShow' /* required */
// };
// sns.createTopic(params, function(err, data) {
//   if (err) console.log(err, err.stack); // an error occurred
//   else
//   {
//     console.log("Topic created " + data.TopicArn);
//     var subscribeparams = {
//       Protocol: 'http', /* required */
//       TopicArn: data.TopicArn, /* required */
//       Endpoint: 'http://default-environment-cmynnybqp8.elasticbeanstalk.com/receive'
//     };
//     sns.subscribe(subscribeparams, function(err, data) {
//       if (err) console.log(err, err.stack); // an error occurred
//       else     console.log("Sent subscribe request " + data.SubscriptionArn );           // successful response
//     });
//   }          // successful response
// });

MongoClient.connect(url, function(err, db) {
console.log("Connected to Mongo");
var app = Consumer.create({
  queueUrl: '',
  handleMessage: function (message, done) {
    console.log("Recieved this " + message.Body);
    var body = JSON.parse(message.Body);
    console.log("Recieved this " + body.text);
    // do some work with `message`
    var alchemy = new AlchemyAPI('');
    alchemy.sentiment(body.text, {}, function(err, response) {
      if (err) throw err;
      // See http://www.alchemyapi.com/api/ for format of returned object
      var sentiment = response.docSentiment;
      console.log("Got sentiment");
      console.log(sentiment);
      if(sentiment)
      {
      db.collection('tweetRecords').updateOne(
        { "tweet_id" : body.id },
        {
          $set: { "sentiment": sentiment.type }
        }, function(err, results) {
        console.log("Succesfully updated mongo" + results);
     });
      var outputPoint = {lat: body.lat,lng: body.lng, text : body.text, sentiment:sentiment.type};
      console.log(JSON.stringify(sentiment));
      var params = {
        Message: JSON.stringify(outputPoint), /* required */
        Subject: 'new tweet has arrived',
        TargetArn: ''
      };
      sns.publish(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log("Publish happened" + data);           // successful response
      });
    }
    });

    done();
  }
});

app.on('error', function (err) {
  console.log(err.message);
});

app.start();

});
