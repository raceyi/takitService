const express = require('express');
const router = express.Router();
const request = require('request');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const async = require('async');
const mariaDB = require('./mariaDB');
const http = require('http');
const https = require('https');
const config = require('../config');
const noti = require('./notification');

const redis = require("redis");
const redisCli = redis.createClient();

var FACEBOOK_APP_ID;
var FACEBOOK_APP_SECRET;
var FACEBOOK_APP_TOKEN;

const maxShopAtATime=30; // Please test it later. This value should equal to the maxSaveShop in client side

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


router.getAppToken=function( ){
	var uri="https://graph.facebook.com/oauth/access_token?client_id="+FACEBOOK_APP_ID+"&client_secret="+FACEBOOK_APP_SECRET+"&grant_type=client_credentials";
	request(uri, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			console.log(JSON.stringify(response.body)); // Show the HTML for the Google homepage.
			var appToken=response.body.substring("access_token=".length,response.body.length);
			console.log("app_token:"+appToken);
			FACEBOOK_APP_TOKEN=appToken;
		}
	});
};


router.setAppId=function(appId){
	FACEBOOK_APP_ID=appId;
};

router.setAppSecret=function(appSecret)
{
	FACEBOOK_APP_SECRET=appSecret;
};


function checkFacebookToken(appToken,token,success,fail){
	 var validateUri="https://graph.facebook.com/debug_token?input_token="+appToken+"&access_token="+token;
	 console.log(validateUri);
	 request(validateUri, function (error, response, body) {
		 if (!error && response.statusCode === 200) {
			 if(success)
				 success();
		 }else{
			 if(fail){
				 fail(response);
			 }
		 }
	 });
}


router.facebooklogin = function(req, res){
	var data = req.body;
	console.log("facebooklogin:"+JSON.stringify(req.body));

	/*var validateUri="https://graph.facebook.com/debug_token?input_token="+FACEBOOK_APP_TOKEN+"&access_token="+req.body.token;
	console.log(validateUri);
	console.log("validuri success");
	
	request(validateUri, function (error, response, body) {
		console.log("facebook login request 11111");
		if (!error && response.statusCode === 200) {
			console.log("request no error");
			console.log(JSON.stringify(req.body));
			// Please check facebook id exists in DB.
	*/	
			mariaDB.existUser(req.body.referenceId,function(err,userInfo){
			console.log("existUser function result:");
				
				if(!err){
					var body={};
					console.log("id:"+userInfo.userId);
				 	
					body.result="success";
				    // save user id in session
					req.session.uid=userInfo.userId;
					console.log("faceboologin session uid:"+typeof req.session.uid ==='string');
					//console.log("facebooklogin-id:"+result.userId);
					
					delete userInfo.password;
					delete userInfo.salt;
					delete userInfo.userId;
					delete userInfo.pushId;
					delete userInfo.countryCode;
	
					body.userInfo=userInfo; 
					
					console.log("facebook login:"+JSON.stringify(body));
					res.end(JSON.stringify(body));
				 
				}else{
					console.log("existUser err : "+err);
            	res.end(JSON.stringify({result:"invalidId"}));
            }
		 	});

		/*}else{ 
			console.log("err : "+error);
			console.log("response : " +JSON.stringify(response));
			res.statusCode=response.statusCode;//401
			// please send error reason if access token is invalid or if user not found.
			res.end(JSON.stringify(response.body));
		}
	});*/
};


router.kakaoLogin=function(req,res){//referenceId 확인해서 로그인.
	
	console.log("kakaoLogin request"+JSON.stringify(req.body));
	
	mariaDB.existUser(req.body.referenceId,function(err,userInfo){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"invalidId"}));
		}else{
			const body={};
			body.result="success";
		    // save user id in session
			req.session.uid = userInfo.userId;
					
			delete userInfo.password;
      	delete userInfo.salt;
         delete userInfo.userId;
      	delete userInfo.pushId;
      	delete userInfo.countryCode;

         body.userInfo=userInfo;
			console.log(JSON.stringify(body))
			res.end(JSON.stringify(body));
		}
	});
}


function validityCheck(email,phone){
    console.log("come validityCheck function");
	var emailPat = /[^\s]+@[^\.\s]+\.[^\s]+/;
    var emailCheck = false;

    // 1. email validity check
    //
    if(emailPat.test(email)){
        emailCheck=true;
    }

    var phonePat = /\d{10,}/;
    var phoneCheck = false;

    // 2. phone validity check
    if(phonePat.test(phone)){
    	phoneCheck=true;
    }

    // 3. email과 phone 모두 유효성 확인되면 true return
    if(emailCheck & phoneCheck){
        return true;
    }else{
        return false;
    }

}

router.signup=function(req,res){

	console.log("req.body:"+JSON.stringify(req.body));

	if(validityCheck(req.body.email,req.body.phone)){
		console.log("email and phone is valid");
		let password=null;
   		if(req.body.hasOwnProperty('password') && req.body.password !==null){
         	password=req.body.password;
        	}

      let referenceId=null;
        	if(req.body.hasOwnProperty('referenceId') && req.body.referenceId !==null){
         	referenceId=req.body.referenceId;
        	}

       	mariaDB.insertUser(referenceId,password,req.body.name,req.body.email,req.body.country, req.body.phone,0,function(err,result){
        	console.log("mariaDB next function."+JSON.stringify(result));
            const body={};
            if(err){
            	body.result="failure";
               body.error=err;
               console.log(JSON.stringify(body));
               res.end(JSON.stringify(body));

            }else{
            	if(result === "duplication"){
               	body.result = result;
                  res.end(JSON.stringify(body));
               }else{
               	body.result="success";
                	body.email=req.body.email;
                  req.session.uid=result;

                  console.log(req.session.uid);
                  console.log('send result'+JSON.stringify(body));
               	res.end(JSON.stringify(body));
               }
            }
        });
	}else{
		res.send(JSON.stringify({"result":"Invalid email or phone"}));
		
	}

};

router.emailLogin=function(req,res){
	mariaDB.existEmailAndPassword(req.body.email,req.body.password,function(err,userInfo){
    	const body={};
    	
    	if(err){
			console.log(err);
      	body.result="invalidId";
      	res.send(JSON.stringify(body));
    	}else{
      	body.result="success";
        	// save user id in session

      	req.session.uid=userInfo.userId;
      	console.log("login-id:"+userInfo.userId);
      		
         delete userInfo.password;
         delete userInfo.salt;
         delete userInfo.userId;
         delete userInfo.pushId;
         delete userInfo.countryCode;

         body.userInfo=userInfo;

      	res.send(JSON.stringify(body));
      }	  
	});
};

router.logout=function(req,res){
	req.session.destroy(function(err){
		if(err){ 
			console.log(err);
			res.end(JSON.stringify({"result":"failure"}));
		}else{
			console.log("destroy success");
			res.end(JSON.stringify({"result":"success"}));
		}
	});
};

router.getUserPaymentInfo=function(req,res){
	if(!req.session.uid){
		console.log("invalid session. Please login");
		res.status(401);
		res.end("login Required");
	}else{
		mariaDB.getUserPaymentInfo(req.session.uid,function(userInfo){
			res.end(JSON.stringify(userInfo));
		},function(err){
			res.status(500);
			res.end(JSON.stringify(err));
		});
	}
};

//회원탈퇴 
router.unregister=function(req,res){
	console.log("accountWithdrawal function ");
	console.log(req.session.uid);
	mariaDB.deleteUserInfo(req.session.uid,function(err,result){
		var body={};
		if(err){
			body.result="failure";
			res.end(JSON.stringify(body));
		}else{
			req.session.destroy(function(err){
         	body.result="success";
         	res.send(JSON.stringify(body));       	
        	});
		}
	});
	
};


//random 숫자 생성
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

//청기와랩 API
function sendSMS(content,receivers,next){

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
	  		next();
	  		
	  	}else{
			console.log(body);
	  		next(body);
		}
	  });
	});
	req.write(body);
	req.end();
	req.on('error', function(e) {
		console.error(e);
		next(e);
	});
}

//SMS 인증
router.SMSCertification = function(req,res){
	console.log("SMSCertification function start!!")
	console.log(req.body);
	
	if(req.body.hasOwnProperty('phone') && req.body.phone !== null){
		//random코드 생성
		var code = getRandomInt(100000,999999);
		var SMSContent = "Takit SMS 인증번호 : ("+code+")";
		console.log(SMSContent);
		sendSMS(SMSContent,[req.body.phone],function(err,result){
			if(!err){
				//redis에 code값 저장
				redisCli.hset("SMSCerti",req.body.phone,code,function(err,result){
					if(err){
						console.log(err);
						res.send(JSON.stringify({"result":"failure"}));
					}else{
						res.send(JSON.stringify({"result":"success"}));
					}
				});
				
			}
		});
	}else{
		res.send(JSON.stringify({'result':'failure'}));
	}
	
}

router.checkSMSCode=function(req,res){
	console.log(req.body);
	
	redisCli.hget('SMSCerti',req.body.phone,function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log(result);
			if(result === req.body.code){
				console.log("check code success");
				res.send(JSON.stringify({"result":"success"}));
			}else{
				console.log("checkcode failure");
				res.send(JSON.stringify({"result":"invalid code"}))
			}
		}
	});
	
}

//. 비밀번호 찾기 (password reset)

router.passwordReset=function(req,res){
	console.log(req.body);
	if(req.body.email!== null && req.body.phone !==null){
		//1)user의 email과 phone번호 확인
		mariaDB.existUserEmail(req.body.email,function(err,userInfo){
			if(err){
				res.send(JSON.stringify({"result":"failure"}));
			}else{
				
				if(req.body.phone === userInfo.phone){
					console.log("phone success");
					//2) random 패스워드 DB set
					let newPwd = crypto.randomBytes(4).toString('hex');
					
					const userInfo = {};
					userInfo.password = newPwd;
					userInfo.email=req.body.email;
					mariaDB.updateUserInfo(userInfo,function(err,result){
						if(err){
							res.send(JSON.stringify({"result":"failure"}));
						}else{
							//3) random 패스워드 email로 보냄
							let subject="임시 비밀번호";
							let content=req.body.email+"님의 임시 비밀번호는 "+newPwd+" 입니다.";
							
							noti.sendEmail(req.body.email,subject,content,function(err,result){
								if(err){
									console.log(err);
									res.send(JSON.stringify({"result":"failure"}));
								}else{
									res.send(JSON.stringify({"result":"success"}));
		
								}
							});
						}
					});
				}else{
					console.log("phone failure");
					console.log(userInfo.phone);
					res.send(JSON.stringify({"result":"failure"}));
				}
			}
		});
			
			
	}else{
		res.send(JSON.stringify({"result":"failure"}));
	}
	

}

/// 주문 알림 모드 -> user가 24시간 내의 주문 있으면, 앱 계속 실행 중이도록! 
router.orderNotiMode=function(req,res){
   console.log("comes orderNotiMode!!!");
   /*1. 24시간 내의 주문을 보내주어야 함.
      'paid', 'checked'*/

   mariaDB.getOrdersNotiMode(req.session.uid,function(err,orders){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log("getOrdersNotiMode result:"+JSON.stringify(orders));
         const response = {};
         response.orders = orders;
         response.result = "success";
         res.send(JSON.stringify(response));
      }
   });
};

router.sleepMode=function(req,res){
   console.log("sleepMode comes!!!!");

	//1. SMS Noti 끄기
	mariaDB.changeSMSNoti(req.session.uid,"off",function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log("SMS noti off success");
      }
   });

   redisCli.keys(req.session.uid+"_gcm_*",function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log(result);
         for(let i=0; i<result.length; i++){
            console.log(result[i]);
            redisCli.del(result[i],function(err,reply){
               if(err){
                  console.log(err);
                  res.send(JSON.stringify({"result":"failure"}));
               }else{
                  console.log(reply);
               }
            });

            if(i === result.length-1){
               res.send(JSON.stringify({"result":"success"}));
            }
         }

         if(result[0] === null || result[0] === undefined){
            res.send(JSON.stringify({"result":"success"}));
         }
      }
   });
}

module.exports = router;
