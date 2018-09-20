var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var moment=require('moment');
var join = path.join;
var exec = require('child-process-promise').exec;
//var s3=require('./s3');
//var mariaDB=require('./mariaDB');
var config = require('../config');

var infile_path;
var outfile_path;
var ocr_command;


router.Response = function(result){
   this.result = result;
   this.version = config.VERSION;
}

router.Response.prototype.getVersion = function(migration,requestVersion){
	if(requestVersion === null){
		return config.VERSION;
	}

	if(migration){
      if(requestVersion === config.VERSION || requestVersion === config.OLD_VERSION){
         return requestVersion;  //새버전과 바로 이전 버전 중 하나라도 같으면 현재 requestVersion return    
      }else{
         return config.OLD_VERSION; // 더 옛날 버전일 경우 , 바로 이전 버전으로 return 하여 update 요청 하게 함.
      }
   }else{
      return config.VERSION;
   }
}

router.Response.prototype.setVersion = function(migration,requestVersion){
   this.version = this.getVersion(migration,requestVersion);
}

router.FailResponse = function(error){
	this.result = "failure";
   this.error = error;
	this.version = config.VERSION;
};
router.FailResponse.prototype = new router.Response("failure");


router.SuccResponse=function(){
	this.result = "success";
	this.version = config.VERSION;
};
router.SuccResponse.prototype=new router.Response("Success");
// version이 이동중이면(ios 중인 중인 경우)  migration = 1, 아니면 0  

/*router.prototype.setVersion = function(migration,requestVersion){
	this.version = this.getVersion(migration,requestVersion);
}*/

//let response = new router.SuccResponse();
//response.setVersion(1,"0.01");
//console.log(test);


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.set_infile_path=function(path){
	infile_path=path;
};

router.set_outfile_path=function(path){
	outfile_path=path;
};

router.set_command=function(command){
	ocr_command=command;
};

function existsSync(filename) {
	  try {
	    fs.accessSync(filename);
	    return true;
	  } catch(ex) {
	    return false;
	  }
}

module.exports = router;
