let express = require('express');
let router = express.Router();
let http = require('http');
let https = require("https");
let gcm = require('node-gcm');
let nodemailer = require("nodemailer");
let config = require('../config');
let Scheduler = require('redis-scheduler');
let scheduler = new Scheduler();

router.sendSMS=function(content,receivers){
	console.log("comes sendSMS : "+content);
	console.log("phone number : "+receivers);

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


router.sendLMS=function(data){
   console.log("comes sendLMS : "+JSON.stringify(data));

   var credential = 'Basic '+new Buffer(config.SMS.APPID+':'+config.SMS.APIKEY).toString('base64');

   var data = {
     "sender"     : config.SMS.SENDER,
     "receivers"  : data.receivers,
     "subject"    : data.subject,
     "content"    : data.content
   }
   var body = JSON.stringify(data);
	
	console.log(body);

   var options = {
     host: 'api.bluehouselab.com',
     port: 443,
     path: '/smscenter/v1.0/sendlms',
     headers: {
       'Authorization': credential,
       'Content-Type': 'application/json; charset=utf-8',
       'Content-Length': Buffer.byteLength(body)
     },
     method: 'POST'
   };

	console.log(options);
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


router.setRedisSchedule = function(keyName,phone,SMS,next){
	console.log("start setRedisSchedule:"+keyName);
	scheduler.schedule({ key: keyName, expire: 30000, handler: function(){ // send SMS 30 seconds later
		console.log("start SMS event"+SMS.content);
			//router.sendSMS(SMS.title+" "+SMS.content,[phone]); kalen's modification. do not send SMS for waitee order. 
		}}, function(err){
			if (err){
				console.error(err);
				next(err);
			}else{
				console.log('scheduled successfully!');
				next(null,"success");
			}
		});
}

router.setRedisScheduleLMS = function(keyName,phone,SMS,expireTime,next){
   console.log("start setRedisSchedule:"+keyName);
   scheduler.schedule({ key: keyName, expire: expireTime, handler: function(){
      console.log("start SMS event"+SMS.content);
         let data = {};
         data.subject = SMS.title;
         data.content = SMS.content;
         data.receivers = [phone];
         router.sendLMS(data);
      }}, function(err){
         if (err){
            console.error(err);
            next(err);
         }else{
            console.log('scheduled successfully!');
            next(null,"success");
         }
      });
}

router.sendGCM=function(API_KEY,MSG,pushId, platform,sound, next){

   let sender = new gcm.Sender(API_KEY);

   console.log("MSG content:"+JSON.stringify(MSG));

   let message;

   if(platform === "ios"){
      message = {
			"to" : pushId[0],
			priority: 'high',
         collapseKey: 'takit',
         timeToLive: 3,
         "content_available": true,
         data: {
            custom: MSG.custom,
            GCMType: MSG.GCMType,
            notId:MSG.messageId
         },
         notification: {
           title: MSG.content,
           body: MSG.title,
			  sound:"appbeep.wav",
			  badge : "0"
         }
      };
		var body = JSON.stringify(message);
		console.log(body);
   	var options = {
    	 	host: 'android.googleapis.com',
   		port: 443,
     		path: '/gcm/send',
     		headers: {
       		'Authorization': 'key='+API_KEY,
       		'Content-Type': 'application/json; charset=utf-8',
       		'Content-Length': Buffer.byteLength(body)
     		},
     		method: 'POST'
   	};
		
		console.log(options);
   	var req = https.request(options, function(res){
     		console.log(res.statusCode);
     		var body = "";
     		res.on('data', function(d) {
       		body += d;
     		});
     		res.on('end', function(d) {
      		if(res.statusCode==200){
         		console.log(JSON.parse(body));
         		next(null,"success"); 
      		}else{
         		console.log(body);
         		console.log(null,"gcm:400");
      		}
     		});
   	});

		req.write(body);
   	req.end();
   	req.on('error', function(e){
      	console.error(e);
      	next(null,"gcm:400");
   	});
   }else{
      message = new gcm.Message({
         priority: 'high',
			collapseKey: 'takit',
         timeToLive: 3,
         data : {
            title : MSG.title,
            message : MSG.content,
            GCMType : MSG.GCMType,
            custom  : MSG.custom,
            "content-available": 1,
            notId: MSG.messageId,
            sound:sound,
         }
      });

		sender.send(message, {"registrationTokens":pushId}, 4, function (err, result) {
        if(err){
           console.log("err sender:"+JSON.stringify(err));
           next(null,"gcm:"+err);
        }else{
           console.log("success sender:"+JSON.stringify(result));
           next(null,result);
        }
     });
	}
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
