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

router.preventMultiLogin=function(req,res){
   console.log("preventMultiLogin start!");

   let userInfo = {};
   async.waterfall([function(callback){
      mariaDB.getUserInfo(req.session.uid,callback);
   },function(result,callback){
      userInfo=result;
      let GCM = {};
      GCM.title = "다른 기기에서 로그인하여 로그아웃 됩니다.";
      GCM.content = "본인이 아닐 시 고객센터에 문의 해주세요.";
      GCM.GCMType = "multiLogin";
      GCM.custom = null;

      noti.sendGCM(config.SERVER_API_KEY,GCM,[userInfo.pushId],userInfo.platform,callback);
   },function(result,callback){
		console.log(userInfo.sessionId);
		redisCli.del(userInfo.sessionId,callback);
	},function(result,callback){
		console.log("del result:"+result);
      let nowTime = new Date();
      let beforeLastTime = new Date(userInfo.lastLoginTime); // UTC time. +32400000 -> localTime
                                                                  //usrInfo.lastLoginTime 그대로 넣으면 로컬시
      let timeDiff = nowTime.getTime()-beforeLastTime.getTime()+32400000; //마지막 로그인 시간과 새로 로그인 하는 시간 차이

      let sessionInfo = {};

      if(timeDiff <= 300000){ //마지막 로그인한지 5분이내에 다른기기에서 로그인 시도 했으면 count 증가
         sessionInfo.multiLoginCount = userInfo.multiLoginCount+1;
      }else{
         sessionInfo.multiLoginCount = 1;
      }

      sessionInfo.sessionId = "sess:"+req.sessionID //now sessionID
      sessionInfo.lastLoginTime = nowTime.toISOString();
		sessionInfo.userId = req.session.uid;
		
      mariaDB.updateSessionInfo(sessionInfo,callback);
   
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         console.log(result);
         delete userInfo.password;
         delete userInfo.salt;
         delete userInfo.pushId;
         delete userInfo.userId;

         res.send(JSON.stringify({"result":"success","userInfo":userInfo}));
      }
   });
}

function checkSession(userInfo,sessionId,next){
   console.log("checkSession");
   async.waterfall([function(callback){
      if(userInfo.sessionId===null || userInfo.sessionId === sessionId){ //이전 session과 현재 session비교
         callback(null,"correct session");
      }else{
         console.log("sessionId:"+userInfo.sessionId);
         async.waterfall([function(callback){
            redisCli.get(userInfo.sessionId,callback); //이전 session get해서 uid있으면 살아있는 세션
         },function(result,callback){
            if(result === null){
               callback(null,"session store is null");
            }else{
               let beforeSession = JSON.parse(result);
               if(beforeSession.hasOwnProperty('uid') && beforeSession.uid === userInfo.userId){
                  callback("multiLogin");
               }else{
                  callback(null,"killed session");
               }
            }
         }],callback);
      }
   },function(result,callback){ //새로운 session 정보 및 login 시간 업데이트
      console.log(result);
      let sessionInfo = {};
      sessionInfo.userId = userInfo.userId;
      sessionInfo.sessionId = sessionId
      sessionInfo.multiLoginCount = 1;
      sessionInfo.lastLoginTime = new Date().toISOString();

      mariaDB.updateSessionInfo(sessionInfo,callback);


   }],function(err,result){
      if(err){
         console.log(err);
         next(err);
      }else{
         console.log(result);
         next(null,result);
      }
   });
}



router.facebookLogin = function(req, res){
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


router.logout=function(req,res){
   console.log("logout start!!");
   mariaDB.updatePushId(req.session.uid,null,null,function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         req.session.destroy(function(err){
            if(err){
               console.log(err);
               res.send(JSON.stringify({"result":"failure","error":err}));
            }else{
               console.log("destroy success");
               res.send(JSON.stringify({"result":"success"}));
            }
         });
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
					let newPwd = crypto.randomBytes(3).toString('hex');
					
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

router.modifyUserInfo = function(req,res){
   console.log("modifyUserInfo function start!!");

   const userInfo ={};
   userInfo.email = req.body.email;
   userInfo.password = req.body.newPassword;
   userInfo.phone = req.body.phone;
   userInfo.name = req.body.name;
   userInfo.userId = req.session.uid;
	
	console.log(JSON.stringify(userInfo));

   if(req.body.hasOwnProperty('oldPassword') && req.body.oldPassword !== ""){
		console.log("has oldPassword");
      mariaDB.getUserInfo(req.session.uid,function(err,result){
         if(err){
            console.log(err);
            res.send(JSON.stringify({"result":"failure", "error":err}));
         }else{
            console.log("getUserInfo success");
				let secretOldPwd = crypto.createHash('sha256').update(req.body.oldPassword+result.salt).digest('hex');
				
            if(secretOldPwd === result.password){
               mariaDB.updateUserInfo(userInfo,function(err,result){
                  if(err){
                     console.log(err);
                     res.send(JSON.stringify({"result":"failure","error":err}));
                  }else{
                     console.log("modify UserInfo:"+JSON.stringify(result));
                     res.send(JSON.stringify({"result":"success"}));
                  }
               });
            }else{
					res.send(JSON.stringify({"result":"failure","error":"incorrect oldPassword"}));
				}
         }
      });
   }else{
		console.log("has not oldPassword");
      mariaDB.updateUserInfo(userInfo,function(err,result){
         if(err){
            console.log(err);
            res.send(JSON.stringify({"result":"failure","error":"hasn't oldPassword"}));
         }else{
            console.log("modify UserInfo:"+JSON.stringify(result));
            res.send(JSON.stringify({"result":"success"}));
         }
      });
   }
}


router.successGCM=function(req,res){
   console.log("messageId : "+req.body.messageId);
   redisCli.del(req.session.uid+"_gcm_user_"+req.body.messageId,function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log("!!!!!!!!!!!success gcm 성공!!!!!!" +result);
         res.send(JSON.stringify({"result":"success"}));
      }
   })
}

/// 주문 알림 모드 -> user가 24시간 내의 주문 있으면, 앱 계속 실행 중이도록! 
router.orderNotiMode=function(req,res){
   console.log("comes orderNotiMode!!!");
   /*1. 24시간 내의 주문을 보내주어야 함.
      'paid', 'checked'*/
	async.parallel([function(callback){
      mariaDB.changeSMSNoti(req.session.uid,"on",callback);
   },function(callback){
      console.log("SMS noti on success");
      mariaDB.getOrdersNotiMode(req.session.uid,callback);
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log("getOrdersNotiMode result:"+JSON.stringify(result));
         const response = {};
         response.orders = result[1];
         response.result = "success";
         res.send(JSON.stringify(response));
      }
   });
};

router.sleepMode=function(req,res){
   console.log("sleepMode comes!!!!");

   async.parallel([function(callback){
      //1. SMS Noti 끄기
      mariaDB.changeSMSNoti(req.session.uid,"off",callback);
   },function(callback){
      console.log("SMS noti off success");
      redisCli.keys(req.session.uid+"_gcm_user_*",callback);
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log(JSON.stringify(result));
         for(let i=0; i<result[1].length; i++){
            console.log(result[i]);
            redisCli.del(result[i],function(err,reply){
               if(err){
                  console.log(err);
                  res.send(JSON.stringify({"result":"failure"}));
               }else{
                  console.log(reply);
               }
            });
            res.send(JSON.stringify({"result":"success"}));

         }

         if(result[0] === null || result[0] === undefined){
            res.send(JSON.stringify({"result":"success"}));
         }
      }
   });
}

router.wakeMode=function(req,res){
   console.log("wakeMode on!!!!");

   mariaDB.changeSMSNoti(req.session.uid,"on",function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log("SMS noti on success");
			res.send(JSON.stringify({"result":"success"}));
      }
   });
};

router.getDiscountRate = function(req,res){
   console.log("getDiscountRate function");

   mariaDB.getDiscountRate(req.body.takitId,function(err,discountRate){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         console.log("SMS noti on success");
         res.send(JSON.stringify({"result":"success","discountRate":discountRate}));
      }
   });
}

module.exports = router;
