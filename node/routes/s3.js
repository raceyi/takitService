let express = require('express');
let router = express.Router();

let AWS = require('aws-sdk');
//let s3 = new AWS.S3();

AWS.config.loadFromPath('./s3.config.json');
let s3 = new AWS.S3();

let fs = require('fs');
let async = require('async');

let config = require('../config');
let mariaDB = require('./mariaDB');
let index = require('./index');

let multer = require('multer');

let storage =   multer.diskStorage({
      destination: function (req, file, callback) {
        callback(null, './uploads');
      },
      filename: function (req, file, callback) {
        callback(null, req.session.uid+"_"+file.originalname);
      }
});

let upload = multer({
      storage: storage,
      limits: {fileSize: 10000000, files:1},
    }).single('file');

/*
router.uploadMenuImage = (req,res)=>{
	console.log("router.uploadMenuImage start");
    async.waterfall([(callback)=>{
		upload(req,res,callback);
    },(callback)=>{
		console.log(callback);
		console.log(req.body);
		mariaDB.selectImagePath(req.body.takitId,req.body.fileName,callback);
    },(result,callback)=>{
        let data = { fileName : req.body.takitId+"_"+req.body.fileName,
                     bucket:config.fileBucket,
                     key : config.s3Key }
        router.uploadS3(data,callback);
    }],(err,result)=>{
        if(err){
            console.log("err:"+err);
            let response = new index.FailResponse(err);
			console.log(response);
            response.setVersion(config.MIGRATION,req.version);
			console.log(response);
            res.send(JSON.stringify(response));
        }else{
            console.log(result);
            let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    })
}
*/
router.uploadS3=function(data,next){
    console.log("data.bucket:"+data.bucket);
   
    var keyName=data.fileName;
    if(data.fileName.includes("?")){   //remove ? from keyName
        var substrs=keyName.split("?");
        keyName=substrs[0]+substrs[1];
    }
    console.log("keyName:"+keyName);

	let s3obj = new AWS.S3({params: {Bucket: data.bucket, Key: keyName}}); //Key: data.fileName}});

	console.log(data.fileName);
	fs.readFile('./uploads/'+data.fileName,(err,file)=>{
		if(err){
			console.log(err);
			next(err);
		}else{
			//let file = fs.readFile(data.fileName);
			s3obj.upload({ Body: file
    		}).on('httpUploadProgress', function(evt) { 
      		// console.log(evt); 
    		}).send(function(err, data) { 
		  		if(err){
			  		console.log("Error uploading data: ", err);
              		next(err);
		  		}else{ 
			  		console.log("s3 upload successfully");
                    next(null,keyName);
		  		}
	  		});
		}
	});
};

/*
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
	  on('httpUploadProgress', function(evt) {}).
	  send(function(err, data) { 
		  if(err){
			  console.log("Error uploading data: ", err);
		  }else{ // save it into dynamoDB if param has takitId 
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
	  on('httpUploadProgress', function(evt) {  }).
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
*/
router.setConfigFile=function(credentialFile){
	myConfig = new AWS.Config();
	myConfig.loadFromPath(credentialFile);
	//myConfig.update({
	//	  region: "ap-northeast-2"
	//});
};

//router.setConfigFile("./s3.config.json");
/*
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
