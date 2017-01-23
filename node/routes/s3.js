var express = require('express');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var fs = require('fs');

var router = express.Router();
var credential_configfile;
let config = require('../config');

/////////////////////////////////////////////////////////
router.delete_takitId_file=function(key){
	var params = {
			  Bucket: config.fileBucket, // required 
			  Key: key
			};
			s3.deleteObject(params, function(err, data) {
			  if (err) console.log(err, err.stack); // an error occurred
			  else     console.log(data);           // successful response
			});
};
///////////////////////////////////////////////////////////
		
router.upload_ocr_file=function(file_name,key,next){
	var s3obj = new AWS.S3({params: {Bucket: config.fileBucket, Key: key}});
	var body = fs.createReadStream(file_name);
	s3obj.upload({Body: body}).
	  on('httpUploadProgress', function(evt) { /* console.log(evt);*/ }).
	  send(function(err, data) { 
		  if(err){
			  console.log("Error uploading data: ", err);
		  }else{ /* save it into dynamoDB if param has takitId */
			  console.log("s3 upload successfully");
			  if(next)
				  next();
		  }
	  });
};

router.remove_menu_image=function(key,success,fail){
	var params = {
		Bucket: config.imgBucket, // required 
		Key: key
	};
	s3.deleteObject(params, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else     console.log(data);           // successful response
	});
};

router.upload_cafe_image=function(file_name,key,success,fail){
	var s3obj = new AWS.S3({params: {Bucket: config.imgBucket, Key: key}});
	var body = fs.createReadStream(file_name);
	s3obj.upload({Body: body}).
	  on('httpUploadProgress', function(evt) { /* console.log(evt);*/ }).
	  send(function(err, data) { 
		  if(err){
			  console.log("Error uploading data: ", err);
			  if(fail)
				  fail();
		  }else{ 
			  console.log("s3 upload successfully");
			  if(success)
				  success();
		  }
	  });
};

router.set_configfile=function(file){
	credential_configfile=file;
	AWS.config.loadFromPath(credential_configfile);
	AWS.config.update({
		  region: "ap-northeast-2"
	});
};
/*
router.set_configfile("/Users/kalenlee/.aws/s3.config.json");


var s3obj = new AWS.S3({params: {Bucket: 'seerid.cafe.image', Key: 'undefined_undefined'}});
s3obj.delete(function(err, data) {
	  if (err){ 
		  console.log(err, err.stack); // an error occurred
		  if(fail)
			  fail(err);
	  }else{ 
		  console.log(data);           // successful response
		  if(success)
			  success();
	  }
});

AWS.config.credentials.get(function (err) {
	        if (err) {
	        	console.log('err:'+err);
	        }
	        else{
	        	console.log('success:'+JSON.stringify(AWS.config.credentials));
	        	var params = {
	        			  Bucket: 'seerid.cafe.image', // required 
	        			  Key: 'undefined_undefined'
	        			};
	        			s3.deleteObject(params, function(err, data) {
	        			  if (err) console.log("deleteObject:"+err, err.stack); // an error occurred
	        			  else     console.log(data);           // successful response
	        			});
	        }
	    });

var params = {
		  Bucket: 'seerid.cafe.image', // required 
		  Key: 'undefined_undefined'
		};
		s3.deleteObject(params, function(err, data) {
		  if (err) console.log("deleteObject:"+err, err.stack); // an error occurred
		  else     console.log(data);           // successful response
		});
*/		
//router.upload_ocr_file("/Users/kalenlee/Downloads/festivalLayout.jpg","node_test");

module.exports = router;
