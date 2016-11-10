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
			  Bucket: 'seerid.html', // required 
			  Key: key
			};
			s3.deleteObject(params, function(err, data) {
			  if (err) console.log(err, err.stack); // an error occurred
			  else     console.log(data);           // successful response
			});
};
///////////////////////////////////////////////////////////
		
router.upload_ocr_file=function(file_name,key,next){
	var s3obj = new AWS.S3({params: {Bucket: 'seerid.html', Key: key}});
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
		Bucket: config.bucket, // required 
		Key: key
	};
	s3.deleteObject(params, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else     console.log(data);           // successful response
	});
};

router.upload_cafe_image=function(file_name,key,success,fail){
	var s3obj = new AWS.S3({params: {Bucket: config.bucket, Key: key}});
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


module.exports = router;
