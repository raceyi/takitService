let express = require('express');
let router = express.Router();
let http = require('http');
let https = require("https");
let gcm = require('node-gcm');
let nodemailer = require("nodemailer");
let config = require('../config');

router.sendSMS=function(content,receivers){

	var credential = 'Basic '+new Buffer(config.SMS.APPID+':'+config.SMS.APIKEY).toString('base64');

	var data = {
	  "sender"     : config.SMS.SENDER,
	  "receivers"  : receivers,
	  "content"    : content
	}
	var body = JSON.stringify(data);

	var options = {
	  host: 'api.bluehouselab.com',
	  port: 443,
	  path: '/smscenter/v1.0/sendsms',
	  headers: {
	    'Authorization': credential,
	    'Content-Type': 'application/json; charset=utf-8',
	    'Content-Length': Buffer.byteLength(body)
	  },
	  method: 'POST'
	};
	var req = https.request(options, function(res) {
	  console.log(res.statusCode);
	  var body = "";
	  res.on('data', function(d) {
	    body += d;
	  });
	  res.on('end', function(d) {
	  	if(res.statusCode==200){
			console.log(JSON.parse(body));

	  	}else{
			console.log(body);
		}
	  });
	});
	req.write(body);
	req.end();
	req.on('error', function(e) {
		console.error(e);
	});
}

router.sendGCM=function(API_KEY,title,content, custom, GCMType, messageId, pushId,next){

	let sender = new gcm.Sender(API_KEY);

	console.log("content:"+content);

	const message = new gcm.Message({
		//priority: 'high',
	    collapseKey: 'takit',
	    contentAvailable: true,
	    delayWhileIdle: false,
	    timeToLive: 3,
	    data: {
			sound:'default',
	      custom: custom,
			GCMType: GCMType,
			messageId:messageId
	    },
	    notification: {
	        title: title,
	        body: content
	    }
	});

	console.log("title:"+title);
	console.log("content:"+content);
	console.log("custom:"+custom);
	console.log("pushId:"+pushId);



	sender.send(message, {"registrationTokens":pushId}, 4, function (err, result) {
		if(err){
			console.log("err sender:"+JSON.stringify(err));
			next(err);
		}else{
			console.log("success sender:"+JSON.stringify(result));
			next(null,result);
		}
	});
}


router.sendEmail=function(email,subject,content, next){
	const smtpTransport = nodemailer.createTransport({
		host: 'smtp.worksmobile.com',
		port: 465,
		secure: true, // use SSL
		//tls : ssl_options
		auth : {
			user:config.smtpId,
			pass:config.smtpPwd
		}
	});

	const mailOptions = {
		from: config.smtpId,
		to: email,
		subject: subject,
		text: content
	};

	smtpTransport.sendMail(mailOptions, function(err, response){
		if(err){
			console.log(err);
			next(err);
		}else{
			console.log("Message sent: " + JSON.stringify(response));
			next();
		}
	});
}


module.exports = router;
