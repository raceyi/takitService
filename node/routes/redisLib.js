var express = require('express');
var router = express.Router();
var redis = require("redis");
var request = require('request');
var client = redis.createClient();
var d3=require('d3-queue');


// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

//client.on("connect", function (err) {
//    console.log("Error " + err);
//});

router.setRedisAll=function(key,datas,next){//order_no와 내용 
	//var key = "user_"+order_no;
	client.hmset(key,datas,redis.print);
	next(null);
};

router.setRedisOne=function(key,field,value,next){
	client.hmset(key,field,value,redis.print);
	next(null);
}

router.getRedisAll=function(key,next){
	client.hgetall(key,function(err,reply){
		next(null,reply);
	});
};

router.getRedisOne=function(key,field,next){
	client.hmget(key,field,function(err,reply){
		next(null,reply)
	});
}


router.getKeys=function(keyword,next){
	if(keyword == null || keyword == undefined){
		keyword = "*"
	}
	client.keys(keyword,function(err,reply){ //
		console.log("getKeys comes");
		next(null,reply);
	});
}


module.exports = router;
