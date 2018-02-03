const express = require('express');

const request = require('request');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const async = require('async');
const mariaDB = require('./mariaDB');
const mongoDB = require('./mongoDB');
const http = require('http');
const https = require('https');
const config = require('../config');
const noti = require('./notification');
const index = require('./index');
const redis = require("redis");
const redisCli = redis.createClient();
const router = express.Router();
const fs=require('fs');

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

      noti.sendGCM(config.SERVER_API_KEY,GCM,[userInfo.pushId],userInfo.platform,"takit",callback);
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
		sessionInfo.deviceUuid = req.body.uuid;

		console.log("device info:"+req.body.uuid);

      mariaDB.updateSessionInfo(sessionInfo,callback);

   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         console.log(result);
         delete userInfo.password;
         delete userInfo.salt;
         delete userInfo.pushId;
         delete userInfo.userId;
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.userInfo=userInfo;
         res.send(JSON.stringify(response));
			
      }
   });
}


function checkSession(userInfo,sessionId,deviceUuid,next){
   console.log("checkSession");
	console.log("device info:"+deviceUuid);

	console.log("userInfo deviceInfo:"+userInfo.deviceUuid);
   async.waterfall([function(callback){
      if(userInfo.sessionId===null || userInfo.sessionId === sessionId || userInfo.deviceUuid === deviceUuid || userInfo.deviceUuid === null){ //이전 session과 현재 session비교
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
                  console.log("beforeUid:"+beforeSession.uid);
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
		sessionInfo.deviceUuid = deviceUuid;

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
   console.log("facebooklogin:"+JSON.stringify(req.body));

   let userInfo = {};
   let sessionId = "sess:"+req.sessionID //now sessionID

   async.waterfall([function(callback){
      mariaDB.existUser(req.body.referenceId,callback);
   },function(result,callback){
      userInfo=result;
      console.log("existUser function result:");
      console.log("id:"+userInfo.userId);

      // save user id in session
      req.session.uid=userInfo.userId;

      //checkSession(userInfo,sessionId,req.body.uuid,callback);
		callback(null,"success");
   }],function(err,result){
      if(err){
         console.log(err);
		 let response = new index.FailResponse("invalidId");
		 response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         delete userInfo.password;
         delete userInfo.salt;
         delete userInfo.userId;
         delete userInfo.pushId;
         delete userInfo.countryCode
		 let response = new index.SuccResponse();
		 response.setVersion(config.MIGRATION,req.version);
		 response.userInfo=userInfo;
         response.userInfo.recommendShops=mariaDB.getRecommendShops();
         res.send(JSON.stringify(response));
      }
   });
};

router.kakaoLogin=function(req,res){//referenceId 확인해서 로그인.

   console.log("kakaoLogin request params:"+JSON.stringify(req.body));

   let userInfo = {};
   let sessionId = "sess:"+req.sessionID //now sessionID

   console.log(req.sessionID);

   async.waterfall([function(callback){
      mariaDB.existUser(req.body.referenceId,callback);
   },function(result,callback){
      userInfo=result;
      console.log("existUser function result:");
      console.log("id:"+userInfo.userId);

      // save user id in session
      req.session.uid=userInfo.userId;

      //checkSession(userInfo,sessionId,req.body.uuid,callback);
		callback(null,"success");
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse("invalidId");
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         delete userInfo.password;
         delete userInfo.salt;
         delete userInfo.userId;
         delete userInfo.pushId;
         delete userInfo.countryCode
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.userInfo=userInfo;
            response.userInfo.recommendShops=mariaDB.getRecommendShops(); 
			console.log(JSON.stringify(response));
         res.send(JSON.stringify(response));
      }
   });
}

router.emailLogin=function(req,res){

   let userInfo = {};
   let sessionId = "sess:"+req.sessionID; //now sessionID

   console.log("sessionId:"+sessionId);
   console.log("req.body:"+JSON.stringify(req.body));

   async.waterfall([function(callback){
      mariaDB.existEmailAndPassword(req.body.email,req.body.password,callback);
   },function(result,callback){
		
      // save user id in session
      userInfo = result;
      req.session.uid=userInfo.userId;
      console.log("login-id:"+userInfo.userId);

		if(userInfo.userId == 87){//tourmode 일 때
			callback(null,"tourMode");		
		}else{
      	//checkSession(userInfo,sessionId,req.body.uuid,callback);
			callback(null,"success");
		}
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse("invalidId");
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         delete userInfo.password;
         delete userInfo.salt;
         delete userInfo.userId;
         delete userInfo.pushId;
         delete userInfo.countryCode
         console.log(result);
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.userInfo=userInfo;		
            response.userInfo.recommendShops=mariaDB.getRecommendShops(); 
            console.log(JSON.stringify(userInfo));
            //console.log(JSON.stringify(response.recommendShops));
         res.send(JSON.stringify(response));
      }
   })
};

function validityCheck(email,phone){
    console.log("come validityCheck function");
	var emailPat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
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

		/*let password=null;
   		if(req.body.hasOwnProperty('password') && req.body.password !==null){
         	password=req.body.password;
        	}

            let referenceId=null;
        	if(req.body.hasOwnProperty('referenceId') && req.body.referenceId !==null){
         	referenceId=req.body.referenceId;
        	}
		*/
			mariaDB.insertUser(req.body,function(err,result){
       	    /* mariaDB.insertUser(referenceId,password,req.body.name,req.body.email,req.body.country, req.body.phone,0,function(err,result){ */
        	console.log("mariaDB next function."+JSON.stringify(result));
            if(err){
				console.log(JSON.stringify(err));
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
         		res.send(JSON.stringify(response));

            }else{
					let response = new index.Response();
					response.setVersion(config.MIGRATION,req.version);
            	if(result === "duplication"){
               	  response.result = result;
                  res.send(JSON.stringify(response));
               }else{
						response.result = "success";
               	  response.email=req.body.email;
                  req.session.uid=result;
                  response.recommends= mariaDB.getRecommendShops(); 
                  console.log(req.session.uid);
                  console.log('send result'+JSON.stringify());
               	res.send(JSON.stringify(response));
               }
            }
        });
	}else{
		let response = new index.Response("Invalid email or phone");
		response.setVersion(config.MIGRATION,req.version);
		res.send(JSON.stringify(response));
		
	}

};

router.logout=function(req,res){
   console.log("logout start!!");
   mariaDB.removeSessionInfo(req.session.uid,null,null,null,function(err,result){
      if(err){
			let response = new index.FailResponse(err);
         response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         req.session.destroy(function(err){
            if(err){
               console.log(err);
					let response = new index.FailResponse(err);
					response.setVersion(config.MIGRATION,req.version);
         		res.send(JSON.stringify(response));
            }else{
               console.log("destroy success");
					let response = new index.SuccResponse();
					response.setVersion(config.MIGRATION,req.version);
         		res.send(JSON.stringify(response));
            }
         });
      }
   });
};

/*router.getUserPaymentInfo=function(req,res){
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
};*/


//회원탈퇴 
router.unregister=function(req,res){
	console.log("accountWithdrawal function ");
	console.log(req.session.uid);
	mariaDB.deleteUserInfo(req.session.uid,function(err,result){
		if(err){
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
			res.send(JSON.stringify(response));
		}else{
			req.session.destroy(function(err){
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
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
						let response = new index.FailResponse(err);
						response.setVersion(config.MIGRATION,req.version);
         			res.send(JSON.stringify(response));
					}else{
						let response = new index.SuccResponse();
						response.setVersion(config.MIGRATION,req.version);
         			res.send(JSON.stringify(response));
					}
				});
				
			}
		});
	}else{
		let response = new index.FailResponse("hasn't phone number");
		response.setVersion(config.MIGRATION,req.version);
      res.send(JSON.stringify(response));
	}
	
}

router.checkSMSCode=function(req,res){
	console.log(req.body);
	
	redisCli.hget('SMSCerti',req.body.phone,function(err,result){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log(result);
			if(result === req.body.code){
				console.log("check code success");
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
			}else{
				console.log("checkcode failure");
				let response = new index.Response("invalid code");
				response.setVersion(config.MIGRATION,req.version);
				res.send(JSON.stringify(response));
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
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
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
							let response = new index.FailResponse(err);
							response.setVersion(config.MIGRATION,req.version);
         				res.send(JSON.stringify(response));
						}else{
							//3) random 패스워드 email로 보냄
							let subject="임시 비밀번호";
							let content=req.body.email+"님의 임시 비밀번호는 "+newPwd+" 입니다.";
							
							noti.sendEmail(req.body.email,subject,content,function(err,result){
								if(err){
									console.log(err);
									let response = new index.FailResponse(err);
									response.setVersion(config.MIGRATION,req.version);
         						res.send(JSON.stringify(response));
								}else{
									let response = new index.SuccResponse();
									response.setVersion(config.MIGRATION,req.version);
         						res.send(JSON.stringify(response));
		
								}
							});
						}
					});
				}else{
					console.log("phone failure");
					console.log(userInfo.phone);
					let response = new index.FailResponse(err);
					response.setVersion(config.MIGRATION,req.version);
         		res.send(JSON.stringify(response));
				}
			}
		});
			
			
	}else{
		let response = new index.FailResponse("email or phone is null");
		response.setVersion(config.MIGRATION,req.version);
      res.send(JSON.stringify(response));
	}
}

//회원정보 수정
router.modifyUserInfo = function(req,res){
   console.log("modifyUserInfo function start!!");

   const userInfo ={};
   userInfo.email = req.body.email;
	userInfo.oldPassword = req.body.oldPassword;
   userInfo.password = req.body.newPassword;
   userInfo.phone = req.body.phone;
   userInfo.name = req.body.name;
   userInfo.userId = req.session.uid;
	userInfo.receiptIssue = req.body.receiptIssue;
	userInfo.receiptId = req.body.receiptId;
	userInfo.receiptType = req.body.receiptType;
	userInfo.taxIssueEmail=req.body.taxIssueEmail;
	userInfo.taxIssueCompanyName=req.body.taxIssueCompanyName;	


	console.log(JSON.stringify(userInfo));

   if(req.body.oldPassword !== undefined){
		console.log("has oldPassword");
      mariaDB.getUserInfo(req.session.uid,function(err,result){
         if(err){
            console.log(err);
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
         }else{
            console.log("getUserInfo success");
				let secretOldPwd = crypto.createHash('sha256').update(req.body.oldPassword+result.salt).digest('hex');
				if(req.body.newPassword !== undefined){
					userInfo.password = req.body.newPassword;
				}else{
					userInfo.password = req.body.oldPassword;
				}
	
            if(secretOldPwd === result.password){
               mariaDB.updateUserInfo(userInfo,function(err,result){
                  if(err){
                     console.log(err);
							let response = new index.FailResponse(err);
							response.setVersion(config.MIGRATION,req.version);
         				res.send(JSON.stringify(response));
                  }else{
                     console.log("modify UserInfo:"+JSON.stringify(result));
							let response = new index.SuccResponse();
							response.setVersion(config.MIGRATION,req.version);
         				res.send(JSON.stringify(response));
                  }
               });
            }else{
					let response = new index.FailResponse("incorrect oldPassword");
         		res.send(JSON.stringify(response));
				}
         }
      });
   }else if(req.body.newPassword === undefined && req.body.oldPassword === undefined){ //비밀번호 정보 없는 kakao, facebook등
		console.log("has not oldPassword");
      mariaDB.updateUserInfo(userInfo,function(err,result){
         if(err){
            console.log(err);
				let response = new index.FailResponse("hasn't oldPassword");
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
         }else{
            console.log("modify UserInfo:"+JSON.stringify(result));
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
         }
      });
   }
}


router.successGCM=function(req,res){
   console.log("messageId : "+req.body.messageId);
   redisCli.del(req.session.uid+"_gcm_user_"+req.body.messageId,function(err,result){
      if(err){
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         console.log("!!!!!!!!!!!success gcm 성공!!!!!!" +result);
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
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
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         console.log("getOrdersNotiMode result:"+JSON.stringify(result));
         let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         response.orders = result[1];
         res.send(JSON.stringify(response));
      }
   });
};
router.sleepMode=function(req,res){
    console.log("sleepMode comes!!!!");

    let errCallback= (err)=>{
        console.log(err);
        let response = new index.FailResponse(err);
        response.setVersion(config.MIGRATION,req.version);
        res.send(JSON.stringify(response));
    }
    
    let succCallback = (result)=>{
        console.log(result);
        let response = new index.SuccResponse();
        response.setVersion(config.MIGRATION,req.version);
        res.send(JSON.stringify(response));
    }

	    //SMS Noti 끄기
    async.parallel([function(callback){
        mariaDB.changeSMSNoti(req.session.uid,"off",callback);        
    },function(callback){
        //해당 user의 모든 messageId key 찾기å
        redisCli.keys(req.session.uid+"_gcm_user_*",callback);
    }],function(err,result){
        if(err){
            errCallback(err);
        }else{
            let messageKeys = result[1];

            let idx = 0;
            //messageKeys delete 
            async.whilst(function(){return idx < messageKeys.length;},
            function(callback){
                redisCli.del(messageKeys[idx],callback);
                idx++;
            },function(err,result){
                if(err){
                    errCallback(err);
                }else{
                    succCallback(result);
                }
            });

            if(messageKeys === null || messageKeys === undefined){
                succCallback(messageKeys);
            }
        }
    });     

}

router.wakeMode=function(req,res){
   console.log("wakeMode on!!!!");

   mariaDB.changeSMSNoti(req.session.uid,"on",function(err,result){
      if(err){
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         console.log("SMS noti on success");
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }
   });
};

router.getDiscountRate = function(req,res){
   console.log("getDiscountRate function");

   mariaDB.getDiscountRate(req.body.takitId,function(err,discountRate){
      if(err){
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         console.log("SMS noti on success");
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.discountRate=discountRate;
         res.send(JSON.stringify(response));
      }
   });
}

router.shopEnter=function(req, res, next){
   if(req.session.uid){
      console.log("check req.session.uid:"+req.session.uid+"shopList"+req.body.shopList);
            mariaDB.updateShopList(req.session.uid,req.body.shopList,function(err,result){
            if(!err){
					let response = new index.SuccResponse();
					response.setVersion(config.MIGRATION,req.version);
         		res.send(JSON.stringify(response));
            }
      });
        }
};

router.getKeywordShops=(req,res)=>{
    console.log("shopUsers.getSejongShops:"+JSON.stringify(req.body));
    redisCli.lrange('keywordShops',0,20,(err,result)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log("getKeywordShops success:"+JSON.stringify(result));
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            response.keywordShops=result;
            res.send(JSON.stringify(response));
        }
    })
}

router.getKeywordShopInfos=(req,res)=>{
    console.log("shopUsers.getKeywordShopInfos:"+JSON.stringify(req.body));
    mariaDB.selectKeywordShopInfos(req.body,(err,shopInfos)=>{
        if(err){
			let response = new index.FailResponse(err);
		    response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log("users.getKeywordShopInfos success:"+JSON.stringify(shopInfos));
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.shopInfos=shopInfos;
            res.send(JSON.stringify(response));
        }
    })
}

router.getFavoriteShops=(req,res)=>{
    console.log("users.getFavoriteShops:"+JSON.stringify(req.body));
    mariaDB.selectFavoriteShops(req.session.uid,(err,shopInfos)=>{
        if(err){
            console.log("err:"+err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log(shopInfos);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            console.log("-----shopInfos:"+JSON.stringify(shopInfos));
            response.shopInfos = shopInfos;
            res.send(JSON.stringify(response));
        }
    });
}

router.getCoupons=(req,res)=>{
    mongoDB.findCoupons(req.body,(err,coupons)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            response.coupons = coupons;
            res.send(JSON.stringify(response));
        }
    })
}

router.downloadCoupon = (req,res)=>{
    let body = {};
    body.userId = req.session.uid;
    body.couponList = req.body.couponList;

    //userInfo에 couponList 저장
    mariaDB.updateCouponList(body,(err,result)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log(result);
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.getMenu = (req,res)=>{
    mariaDB.selectOneMenu(req.body,(err,menu)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log(menu);
            let response = new index.SuccResponse();
            response.menu = menu;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.searchTakitId=(req,res)=>{
    mariaDB.selectTakitId(req.body,(err,shopInfo)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{

            let response = new index.SuccResponse();
            response.shopInfo = shopInfo;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.searchShop=function(req,res){
    mariaDB.searchShop(req.body.keyword,(err,shopInfo)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{

            let response = new index.SuccResponse();
            response.shopInfo = shopInfo;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.getEvents=(req,res)=>{
    redisCli.lrange('events',0,4,(err,events)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.events = events;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.enterMenuDetail=(req,res)=>{
    console.log("enterMenuDetail:"+JSON.stringify(req.body));

    async.parallel([(callback)=>{
        mariaDB.selectOneMenu(req.body,callback);
    },(callback)=>{
        mariaDB.getBalanceCash(req.body.cashId,callback);
    },(callback)=>{
        mariaDB.getShopInfo(req.body.takitId,callback);
    }],(err,result)=>{
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.menu = result[0];
            response.balance = result[1];
            response.shopInfo = result[2];
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

/*
router.resetCashConfirmCount = function (req,res){
    console.log("resetCashConfirmCount:"+JSON.stringify(req.body));
    mariaDB.updateConfirmCount(req.body.cashId,0,function(err,result){
        if(err){
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}
*/

module.exports = router;
