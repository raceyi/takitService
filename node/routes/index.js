var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var moment=require('moment');
var join = path.join;
var exec = require('child-process-promise').exec;
var s3=require('./s3');
var mariaDB=require('./mariaDB');

var infile_path;
var outfile_path;
var ocr_command;

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

function resultOCR(infile,outfile,req,res){
    function takitIdFound(){
    	console.log("!takitId found!");
		// Synchronous read
		var data = fs.readFileSync(txtfile);
		var takitId=data.toString().trim();
		console.log("takitId: " + takitId);
		fs.unlink(txtfile, function(err) {
	     	   if (err) {
	     	       return console.error(err);
	     	   }
	     	   console.log(outfile+"File deleted successfully!");
	    });
	    ///////////////////////////////////////////////////////////////////
	    //Check the validity of , check takitId exists in DB
		//please define s3 key as user id & takitId & time
        //////////////////////////////////////////////////////////////////
		var isoDate = new Date().toISOString();
		if(req.session.uid){
			console.log("check req.session.uid:"+req.session.uid);
	        s3.upload_ocr_file(infile,"takit/"+path.basename(infile),function(){
	        	dynamoDB.updateUserInfoShopList(req.session.uid,takitId,"takitId/"+path.basename(infile),isoDate);
	        });
 		}else
			console.log("invalid uid. session is invalid");
		///////////////////////////////////////////////////////////////////	
		// Please send shop info: res.send(takitId);
        var body={};
        body.result="takitIdFound";
        body.takitId=takitId;	
        body.s3key="takitId/"+path.basename(infile);
        body.visited=isoDate;
        res.end(JSON.stringify(body));
    }	
    function removeFiles(){
	    fs.unlink(outfile, function(err) {
	 	   if (err) {
	 		  console.error(err); 
	 	   }else{
	 		   console.log(outfile+" File deleted successfully!");
	 	   }
	    });
	    fs.unlink(infile, function(err) {
		   if (err) {
		       console.error(err);
		   }else{
		   console.log(infile+" File deleted successfully!");
		   }
	    });
    }
	var txtfile=infile+".txt";

	fs.stat(txtfile, function(err, stats){
		   if (err){
		        console.log("err:"+JSON.stringify(err));
		    	s3.upload_ocr_file(infile,"failure/"+path.basename(infile));
		     	var body={};
		        body.result="no takitId area found";
		        res.end(JSON.stringify(body));
		   }else{
		        console.log('stats:'+JSON.stringify(stats));
		        takitIdFound();
		   }
		   removeFiles();    
		  }
	);
	
}

function runOCR(infile,outfile,req,res){
	console.log("[runOCR]"+ocr_command+" "+infile+" "+outfile);
	exec(ocr_command+" "+infile+" "+outfile)
    .then(function (result) {
        var stdout = result.stdout;
        var stderr = result.stderr;
       // console.log('stdout: ', stdout);
        console.log('stderr: ', stderr);
        resultOCR(infile,outfile,req,res);
    })
    .fail(function (err) {
        console.error('fail... ERROR: ', err);
    	resultOCR(infile,outfile,req,res); // please change FindSeerId for result.
    })
    .progress(function (childProcess) {
        console.log('childProcess.pid: ', childProcess.pid);
    });
}

router.ocr_submit = function(req, res, next){
	    ////////////////////////////////
	    // test code
		//var img={name:"SeerIDPicture.jpg",path:"/Users/kalenlee/Downloads/SeerIDPicture.jpg"};
    	////////////////////////////////
    	var img = req.file.path; // full name
		var currTime = moment.utc().format("YYYY-MM-DD-HH-mm-ss-SSS");
	    console.log("currTime:"+currTime);
	    var infile=join(infile_path,req.session.uid+'_'+currTime+".jpg");
	    var outfile=join(outfile_path,req.session.uid+'_'+currTime+".jpg");
	    console.log(" infile:"+infile+" outfile:"+outfile);
	    fs.rename(img, infile, function(err){
		      if (err){ 
		    	  console.log("fail to rename ocr image file. "+JSON.stringify(err)); 
		    	  res.statusCode=500;// internal server error
		    	  res.end({error:JSON.stringify(err)}); // Please change error message later.
		      } // system error...
		      runOCR(infile,outfile,req,res);
		});
};

router.shopEnter=function(req, res, next){
	if(req.session.uid){
		console.log("check req.session.uid:"+req.session.uid+"shopList"+req.body.shopList);
       		mariaDB.updateShopList(req.session.uid,req.body.shopList,function(err,result){
        		if(!err){
				var body={"result":"success"};
				res.end(JSON.stringify(body));
	        	}
		});
        }
};

module.exports = router;
