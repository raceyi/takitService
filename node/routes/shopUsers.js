const express = require('express');
const router = express.Router();
const request = require('request');
const mariaDB=require('./mariaDB');
const s3=require('./s3');
const gcm = require('node-gcm');
const config=require('../config');
const index=require('./index');
const redis = require('redis');
const redisCli = redis.createClient();
const async = require('async');
const noti = require('./notification');
let crypto = require('crypto');
let multer = require('multer');
var fs = require('fs');

const legacy = require('legacy-encoding');
var iconv = require('iconv-lite');
const readline = require('readline');
var path = require('path');

var AsyncLock = require('async-lock');
var lock = new AsyncLock();

var FACEBOOK_SHOP_APP_SECRET
var FACEBOOK_SHOP_APP_ID;
var FACEBOOK_SHOP_APP_TOKEN;

router.getShopAppToken=function( ){

var uri="https://graph.facebook.com/oauth/access_token?client_id="+FACEBOOK_SHOP_APP_ID+"&client_secret="+FACEBOOK_SHOP_APP_SECRET+"&grant_type=client_credentials";
	request(uri, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			console.log(JSON.stringify(response.body)); // Show the HTML for the Google homepage.
			var appToken=response.body.substring("access token=".length,response.body.length);
			console.log("app token:"+appToken);
			FACEBOOK_SHOP_APP_TOKEN=appToken;
		}
	});

};


router.setAppIdShop=function(appId){
	FACEBOOK_SHOP_APP_ID=appId;
};

router.setAppSecretShop=function(appSecret)
{
	FACEBOOK_SHOP_APP_SECRET=appSecret;
};



function checkFacebookToken(appToken,token,next){
     var validateUri="https://graph.facebook.com/debug_token?input_token="+appToken+"&access_token="+token;
     console.log(validateUri);
     request(validateUri, function (error, response, body) {
         if (!error && response.statusCode === 200) {
        	next();
         }else{
            next(error);
         }
     });
}

router.loginWithEmail=function(req,res){
    console.log("loginWithEmail "+JSON.stringify(req.body));
    mariaDB.checkShopUserWithEmailAndPassword(req.body.email, req.body.password, function(err,result){
        if(err){
            console.log(err);
            let response = new index.Response("invalidId");
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            console.log("mariaDB.existEmailAndPassword success");
            mariaDB.getOnlyShopUserInfo(result.userId,function(err,shopUserInfo){
                if(err){
                    console.log(err);
                    let response = new index.Response("invalidId");
                    response.setVersion(config.MIGRATION,req.version);
                    res.send(JSON.stringify(response));
                }else{
                    console.log("getShopUserInfo function result:");
                    console.log(shopUserInfo);
                    req.session.uid = shopUserInfo[0].userId;
                    console.log("***************req.session:"+JSON.stringify(req.session));
                     //body.shopUserInfo={};
                    let response = new index.SuccResponse();
                    response.setVersion(config.MIGRATION,req.version);

                 //delete secret info
                 for(let i=0; i<shopUserInfo.length; i++){
                    delete shopUserInfo[i].userId;
                    delete shopUserInfo[i].password;
                    delete shopUserInfo[i].salt;
                    delete shopUserInfo[i].shopPushId;
                 }

                 console.log(shopUserInfo);
                 response.shopUserInfo=shopUserInfo[0];
                 //여러개 shopList 하나로 합치기
                 //let myShopList=[];
                 //for(let i=0; i<shopUserInfo.length; i++){
                 //   let shopList = JSON.parse(shopUserInfo[i].myShopList);
                 //   myShopList[i]=shopList[0];
                 //
                 //}
                 //response.shopUserInfo.myShopList=JSON.stringify(myShopList);
                 console.log(JSON.stringify(response));
                 res.send(JSON.stringify(response));
                }
            });
        }
    });
}


router.emailLogin=function(req,res){
	mariaDB.existEmailAndPassword(req.body.email, req.body.password, function(err,result){
		if(err){
			console.log(err);
			let response = new index.Response("invalidId");
			response.setVersion(config.MIGRATION,req.version);
			res.send(JSON.stringify(response));
		}else{
			console.log("mariaDB.existEmailAndPassword success");
			mariaDB.getShopUserInfo(result.userId,function(err,shopUserInfo){
				if(err){
					console.log(err);
					let response = new index.Response("invalidId");
         		response.setVersion(config.MIGRATION,req.version);
					res.send(JSON.stringify(response));
				}else{
					console.log("getShopUserInfo function result:");
					console.log(shopUserInfo);
					req.session.uid = shopUserInfo[0].userId;
			         //body.shopUserInfo={};
					let response = new index.SuccResponse();
					response.setVersion(config.MIGRATION,req.version);

		         //delete secret info
		         for(let i=0; i<shopUserInfo.length; i++){
		            delete shopUserInfo[i].userId;
		            delete shopUserInfo[i].password;
		            delete shopUserInfo[i].salt;
		            delete shopUserInfo[i].shopPushId;
		         }

					console.log(shopUserInfo);
		         response.shopUserInfo=shopUserInfo[0];

		         //여러개 shopList 하나로 합치기
		         let myShopList=[];
		         for(let i=0; i<shopUserInfo.length; i++){
		            let shopList = JSON.parse(shopUserInfo[i].myShopList);
		            myShopList[i]=shopList[0];

		         }
		         response.shopUserInfo.myShopList=JSON.stringify(myShopList);
		         console.log(JSON.stringify(response));
		         res.send(JSON.stringify(response));
				}
			});
		}
	});
}


//shop 운영 on/ off
router.openShop=function(req,res){
	console.log("start openShop function");
	console.log(req.body);
	mariaDB.updateShopBusiness(req.body.takitId,"on",function(err,result){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log("openShop function success");
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}
	});

};

router.closeShop=function(req,res){
	console.log("start closeShop function");
	mariaDB.updateShopBusiness(req.body.takitId,"off",function(err,result){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log("closeShop function success");
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}
	});
}


//오늘 알림 받는 shop member 지정
router.changeNotiMember=function(req,res){
   console.log("changeNotiMember comes!!!");
   //1. mariaDB에서 이전 noti 받는 member 찾기 (GCMNoti==="on" 인 사람)
	//2.incr redis
	//3.set 스케줄
	//4.send noti
	//4.change noti member
	let shopUserInfo={};
	const GCM = {};
	GCM.title = "주문 알림 멤버 변경"+req.body.takitId;
	GCM.content = req.body.takitId+"의 알림이 다른 멤버로 변경 됩니다. 원하지 않는 경우 웨이티 상점앱을 실행해주세요.";
	GCM.GCMType = "change_manager";
	GCM.custom = {};

	console.log(GCM);	
	async.waterfall([function(callback){
		mariaDB.getShopPushId(req.body.takitId,callback); //현재 알림 멤버의 pushId,userId, ect 찾기
	},function(result,callback){
		shopUserInfo=result;
		redisCli.incr("gcm",callback);
	},function(messageId,callback){
		GCM.messageId = messageId;
		noti.setRedisSchedule(shopUserInfo.userId+"_gcm_shop_"+messageId,shopUserInfo.phone,GCM,callback); ///(keyName,phone,SMS,next){

	},function(result,callback){
		mariaDB.getUserInfo(shopUserInfo.userId,callback)
	},function(userInfo,callback){
		GCM.custom.email=userInfo.email;

		async.parallel([function(callback){
			noti.sendGCM(config.SHOP_SERVER_API_KEY,GCM,[shopUserInfo.shopPushId], shopUserInfo.platform, "changenotifier",callback); //현재 알림 멤버에게 gcm보내줌 
		},function(callback){
			let onMyShopList= JSON.parse(shopUserInfo.myShopList);
			onMyShopList[0].GCMNoti = "on";
			let offMyShopList=JSON.parse(shopUserInfo.myShopList);
			offMyShopList[0].GCMNoti = "off";
			console.log(offMyShopList);
			console.log("off:"+JSON.stringify(offMyShopList));
			mariaDB.updateNotiMember(req.session.uid, req.body.takitId, JSON.stringify(onMyShopList), JSON.stringify(offMyShopList),callback); 
		}],callback);

	}],function(err,result){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log("change Noti Member success result:"+JSON.stringify(result));
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}
	});
};

router.successGCM=function(req,res){
   console.log("messageId : "+req.body.messageId);
   redisCli.del(req.session.uid+"_gcm_shop_"+req.body.messageId,function(err,result){
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


router.sleepMode=function(req,res){
   console.log("shop sleepMode comes!!!!");
   redisCli.keys(req.session.uid+"_gcm_shop_*",function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
         response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else{
         console.log(result);
         for(let i=0; i<result.length; i++){
            console.log(result[i]);
            redisCli.del(result[i],function(err,reply){
               if(err){
                  console.log(err);
						let response = new index.FailResponse(err);
						response.setVersion(config.MIGRATION,req.version);
         			res.send(JSON.stringify(response));
               }else{
                  console.log(reply);
               }
            });

            if(i === result.length-1){
					let response = new index.SuccResponse();
					response.setVersion(config.MIGRATION,req.version);
         		res.send(JSON.stringify(response));
            }
         }

         if(result[0] === null || result[0] === undefined){
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(responsde));
         }
      }
   });
}

router.getShopInfo=function(req,res){
	console.log("---------------------------getShopInfo");

	mariaDB.getShopInfo(req.body.takitId,function(err,shopInfo){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			delete shopInfo.orderNumberCounter;
			delete shopInfo.orderNumberCounterTime;

			console.log("success");
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.shopInfo=shopInfo;
			res.send(JSON.stringify(response));
		}
	});
}

router.refreshInfo=function(req,res){
	console.log("enter refreshInfo shop");

	async.parallel([function(callback){
		mariaDB.getShopUserInfoWithEmail(req.session.uid,callback); //GCMNoti정보 받아오기 위해
	},function(callback){
		mariaDB.getShopInfo(req.body.takitId, callback); //shop on/off 받아오기 위해
	}],function(err,result){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log(result);

			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.shopUserInfo={};
			response.shopInfo = result[1];
			for(let i=0; i<result[0].length; i++){ //getShopUserInfo가 여러개 shop 가지고 있는 user들을 여러명 검색하므로 이 작업 필요
				console.log("for :"+JSON.stringify(result[0][i].takitId));
				if(result[0][i].takitId === req.body.takitId){
					console.log("find correct takitId" + JSON.stringify(result[0]));
					delete result[0][i].password;
					delete result[0][i].salt;
					delete result[0][i].shopPushId;
					response.shopUserInfo = result[0][i];

					break;
				}/*else{
					response.result="failure";
					delete response.shopUserInfo;
				}*/
			}

			console.log("response:"+JSON.stringify(response));
			res.send(JSON.stringify(response));
		}
	});
}

router.getSalesAndSatas = function(req,res){
	// 1. today
	// 2. week
	// 3. month
	// 4. period
		function finalCallback(err,result){
			if(err){
				console.log(err);
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
			}else{
				console.log("getSalesAndSatas success");
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
				response.sales=result[0].sales;
				response.originalSales=result[0].originalSales;
				response.stats=result[1];
                if(req.body.stamp){
                    response.issueStampCount=result[2];
                    response.couponAmount=result[3];
                }
				res.send(JSON.stringify(response));
			}
		}
	
		console.log(req.body);
		if(req.body.option === "period"){
			async.parallel([function(callback){
				mariaDB.getSalesPeriod(req.body.takitId, req.body.startTime, req.body.endTime, callback);
			},function(callback){
				mariaDB.getPeriodStatsMenu(req.body.takitId,req.body.startTime,req.body.endTime,callback);
			},function(callback){
                // stamp정보를 count한다. 
                if(req.body.stamp){
                    mariaDB.getPeriodIssueStamp(req.body.takitId, req.body.startTime, req.body.endTime, callback); 
                }else{
                    callback(null,"done"); 
                } 
            },function(callback){
                // 사용 쿠폰수를 count한다. 
                if(req.body.stamp){
                    mariaDB.getPeriodCouponAmount(req.body.takitId, req.body.startTime, req.body.endTime, callback);  
                }else{
                    callback(null,"done");
                } 
            }],finalCallback);
		}else{
			async.waterfall([function(callback){
				mariaDB.getShopInfo(req.body.takitId,callback);
			},function(shopInfo,callback){
				let startTime = mariaDB.getLocalTimeWithOption(req.body.option,shopInfo.timezone);
				async.parallel([function(callback){
					mariaDB.getSales(req.body.takitId,startTime,callback);
				},function(callback){
					mariaDB.getStatsMenu(req.body.takitId,startTime,callback);
				},function(callback){
                   //stamp정보를 count한다. 
                   if(req.body.stamp)
                       mariaDB.getIssueStamp(req.body.takitId,startTime,callback);
                   else
                       callback(null,"done");
                },function(callback){
                // 사용 쿠폰수를 count한다. 
                    if(req.body.stamp){
                        mariaDB.getCouponAmount(req.body.takitId,startTime,callback);  
                    }else{
                        callback(null,"done");
                    }
                }],callback);
			}],finalCallback);
		}

}


router.getAccount = function(req,res){
	console.log("getAccountShop start");

	mariaDB.getAccountShop(req.body.takitId,function(err,result){
		if(err){
			console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			console.log(result);
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.account=result.account;
			response.bankName=result.bankName;
			response.bankCode=result.bankCode;
			response.depositer=result.depositer;
         res.send(JSON.stringify(response));
		}
	});
}

router.sendGMSCouponMsg=function(api_key,pushid,MSGcontents,custom,next){
	var sender = new gcm.Sender(api_key);
	var title="coupon";

	console.log(sender);
	console.log(api_key);
	console.log("pushid:"+pushid);
	console.log("msg_contents:"+MSGcontents);

	var message = new gcm.Message({
		collapseKey: "MyAppGeneral",
	    delayWhileIdle: false,
	    timeToLive: 3, //weeks
	    //attached payload
	    data: {
	    	title: title,
	        message: MSGcontents,
	        custom: custom,
	        "content-available":1
	    }
	});
	
	if(typeof pushid === 'undefined'){
		console.log("undefined pushid");
		return;
	}

	sender.send(message, pushid, 4, function (err, result) {
		
		if(err){
			console.log("sender:"+JSON.stringify(err));
			console.log("result:"+JSON.stringify(result));
			next(err);
		}else{
			console.log("sender:"+JSON.stringify(result));
			next(null,result);
		}
	});
}

//var utc_order_time= new Date(Date.parse('2016-07-01T08:10:53.358Z'));  
//->  var utc_order_time= new Date(Date.parse(orderedTime));  
// 
//var local_order_time=getTimezoneLocalTime("Asia/Seoul",utc_order_time.getTime());  
//-> var local_order_time=getTimezoneLocalTime(timezone,utc_order_time.getTime());  
// 
//var local_hour=local_order_time.substring(11,13);
//console.log("hour:"+local_hour);

router.addTakitId=function(req,res){
    console.log("router.insertTakitId");

    mariaDB.insertTakitId(req.body,function(err,result){
        if(err){
            console.log(err);
            let response = new index.FailResponse("failure",err);
            response.setVersion(config.MIGRATION,req.version);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(JSON.stringify(response));
        }
    });

};


router.addCategory=function(req,res){
    console.log("router.insertCategory"+JSON.stringify(req.body));
    let category = req.body;
    async.waterfall([function(callback){
        mariaDB.updateSequence(category,"+1",callback);
    },function(result,callback){
        console.log(result);
        mariaDB.insertCategory(category,callback);
    }],function(err,result){
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


router.modifyCategory=function(req,res){
    console.log("router.updateCategory:"+JSON.stringify(req.body));


    let category = req.body;
    category.oldSequence = parseInt(category.oldSequence);
    category.newSequence = parseInt(category.newSequence);

    async.waterfall([function(callback){
        if(category.newSequence === category.oldSequence){
            callback(null,"same sequence");
        }else{
            mariaDB.updateSeqWhenModify(category,callback);
        }
    },function(result,callback){
        console.log(result);
        mariaDB.updateCategory(category,callback);
    }],function(err,result){
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

router.removeCategory=(req,res)=>{
	console.log("router.removeCategory:"+JSON.stringify(req.body));
	
	let category = req.body
	async.waterfall([(callback)=>{
		mariaDB.deleteCategory(category,callback);
	},(result,callback)=>{
        mariaDB.updateSequence(category,"-1",callback);
	}],(err,result)=>{
		if(err){
            console.log(err);
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

router.addMenu=function(req,res){
    console.log("router.insertMenu");

    let menu = req.body;
    mariaDB.insertMenu(menu,function(err,result){
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

router.modifyMenu=function(req,res){
    console.log("router.updateMenu");

    let menu = req.body;
    mariaDB.updateMenu(menu,function(err,result){
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

router.removeMenu=function(req,res){
    console.log("router.removeMenu");

    mariaDB.deleteMenu(req.body,function(err,result){
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



router.addShopInfo=function(req,res){
    mariaDB.insertShopInfo(req.body,function(err,result){
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
};

router.modifyShopInfo=function(req,res){
    mariaDB.updateShopInfo(req.body,function(err,result){
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
};

router.modifyPassword=function(req,res){
    mariaDB.checkShopUserWithEmailAndPassword(req.body.email, req.body.oldPassword, function(err,result){
        if(err){
            console.log(err);
            let response = new index.Response("invalidId");
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            mariaDB.modifyShopUserWithEmailAndPassword(req.body.email, req.body.newPassword, function(err,result){ 
                let response = new index.SuccResponse();
                response.setVersion(config.MIGRATION,req.version);
                res.send(JSON.stringify(response));
            });
        } 
    });
};

let storage =   multer.diskStorage({
      destination: function (req, file, callback) {
        callback(null, './uploads');
      },
      filename: function (req, file, callback) {
		console.log(req.body);
		console.log(req.file);
		console.log(file)
        callback(null, req.body.fileName);
      }
});

let upload = multer({
      storage: storage,
      limits: {fileSize: 10000000, files:1},
    }).single('file');


router.uploadMenuImage = (req,res)=>{
    console.log("router.uploadMenuImage start");

    async.waterfall([(callback)=>{
        upload(req,res,callback);
    },(callback)=>{
        console.log(callback);
        console.log(req.body);
		console.log(req.file);
        mariaDB.selectImagePath(req.body,callback);
    },(result,callback)=>{
        let data = { fileName : req.body.fileName,
                     bucket:config.imgBucket,
                     key : config.s3Key }
        s3.uploadS3(data,callback);
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

router.uploadMenuImageWeb = (req,res)=>{
   console.log("req.file:"+JSON.stringify(req.file));
   let path=req.file.path;
   let destination;
    async.waterfall([(callback)=>{
      //rename filename as req.body.fileName
      destination=req.file.destination+'/'+req.body.fileName;
      console.log("destination:"+destination);
      fs.rename(path,destination, callback);
    },(callback)=>{
        //console.log("req.body:"+req.body);
        //console.log("req.file:"+req.file);
        mariaDB.selectImagePath(req.body,callback);
    },(result,callback)=>{
        let data = { fileName : req.body.fileName,
                     bucket:config.imgBucket,
                     key : config.s3Key }
        s3.uploadS3(data,callback);
    }],(err,result)=>{
        //remove upload file
        fs.unlink(destination); // 여러개가 동시에 동일한 이름일 경우 문제가 될수 있다 ㅜㅜ. menuName으로 그럴것같지는 않음. 나중에 확인하자.
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
    });
}

router.modifyBusinessHours=function(req,res){
     mariaDB.updateBusinessHour (req.body,function(err,result){
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

router.importMenuFile = (req,res)=>{
   console.log("!!!!!req.file:"+JSON.stringify(req.file));
   let instream = fs.createReadStream(req.file.path).pipe(iconv.decodeStream('euc-kr'));
   let outstream = new (require('stream'))(),
   rl = readline.createInterface(instream, outstream);
   let header;
   let takitId=req.body.takitId;
   let objNames=[];
   let menus=[];
   let done=false;

    rl.on('line', function (line) {
        console.log(line);
        if(!header){ //read the first line
             let cols=line.split(",");
             cols.forEach(col=>{
                objNames.push(col.trim());
                console.log("col:"+col.trim());
             });
             header=true;
        }else{
             let cols=line.split(",");
             let menu={};
             for(let i=0;i<objNames.length;i++){
                 menu[objNames[i]]=cols[i].trim();
             }
             console.log("menu:"+JSON.stringify(menu));
             menus.push(menu);
        }
    });

    rl.on('close', function (line) {  // 마지막 line의 종료를 어떻게 확인하지? 메모리로 올린후에 작업하자.ㅜㅜ
       const lockName="importMenuFile-"+takitId;
       lock.acquire(lockName, function (doneFunc) { // 파일이 두번 업로드 된다. 이유가 뭘까? 일단 한번 처리후 다시 처리하도록 조치함.
         console.log('done reading file. done...:'+done);
         if(!done){
           done=true;
           async.mapSeries(menus, function(menu,callback){
                mariaDB.importUpdateMenu(takitId,menu,callback);
           },function(err,result){
                if(err){
                    console.log("!!!! File import error:"+err);
                    let response = new index.FailResponse(err);
                    response.setVersion(config.MIGRATION,req.version);
                    res.send(JSON.stringify(response));
                    doneFunc(null,"success");
                }else{ //All done successfully
                    console.log("All done successfully");
                    //send response
                    let response = new index.SuccResponse();
                    response.setVersion(config.MIGRATION,req.version);
                    res.send(JSON.stringify(response));
                    doneFunc(null,"success");
                }
           });
          }else{
              doneFunc(null,"success");
          }
      });
    });
}

router.exportMenus=function(req,res){
 mariaDB.exportMenus(req.body.takitId,function(err,result){
  if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
  }else{
   let now=new Date();
   let publicDir=path.join(__dirname, '../public');
   let filename= "/menus_"+now.getTime()+".csv";
   console.log("filename:"+filename);
   var stream = fs.createWriteStream(publicDir+filename);
   console.log("result:"+JSON.stringify(result));
   stream.once('open', function(fd) {
      let buffer = legacy.encode("categoryName,menuName,price,imagePath\n",'euckr');
      stream.write(buffer);
      result.forEach(category=>{
          category.forEach(menu=>{
               // @로 split한다.
               let categoryName=menu.categoryName;
               //stream.write(menu.categoryName+','+menu.menuName+','+menu.price+'\n','utf8');
               buffer = legacy.encode(menu.categoryName+','+menu.menuName+','+menu.price+','+menu.imagePath+'\n','euckr');
               stream.write(buffer);
          });
      });
      stream.end();
            let response = new index.SuccResponse();
            response.url= filename;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
      //fs.unlink(filename, function (err) {
      //  if (err) throw err;
      //  console.log('File deleted!');
      //});
   });
  }
 });
}

router.modifyFoodOrigin = function(req,res){
    mariaDB.updateFoodOrigin(req.body.takitId,req.body.foodOrigin,function(err,result){
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
    })
}

module.exports = router;
