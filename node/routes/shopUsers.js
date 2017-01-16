const express = require('express');
const router = express.Router();
const request = require('request');
const mariaDB=require('./mariaDB');
const s3=require('./s3');
const d3=require('d3-queue');
const gcm = require('node-gcm');
const config=require('../config');
const redis = require('redis');
const redisCli = redis.createClient();
const async = require('async');
const noti = require('./notification');

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

router.facebookLogin= function(req,res){

   //1. facebook의 token 확인
   /*checkFacebookToken(FACEBOOK_SHOP_APP_TOKEN,req.body.token,function(err){
   	if(err){
			res.statusCode=err.statusCode;//401
      	// please send error reason if access token is invalid or if user not found.
      	res.send(JSON.stringify(err.body));
		}else{
	*/	
			console.log(JSON.stringify(req.body));
      	//2. shopUser로 등록 돼 있는지 확인
         //3. 최종 login
      	mariaDB.existShopUser(req.body.referenceId,function(err,shopUserInfo){
         	console.log("existUser function result:");
            console.log(shopUserInfo);

            if(err){
            	res.send(JSON.stringify({"result":"invalidId"}));
            }else{
               console.log("[facebookLogin]shopUserInfo:"+JSON.stringify(shopUserInfo));
               const response={};
               response.result="success";
               // save user id in session
               req.session.uid=shopUserInfo[0].userId;
               console.log("facebooklogin-id:"+shopUserInfo[0].userId);

               for(let i=0; i<shopUserInfo.length; i++){
               	console.log("i..."+i);
                	delete shopUserInfo[i].userId;
						delete shopUserInfo[i].password;
						delete shopUserInfo[i].salt;
						delete shopUserInfo[i].shopPushId;
            	}
               response.shopUserInfo=shopUserInfo[0];
               let myShopList=[];
               for(let i=0;i<shopUserInfo.length;i++){
                	let shopList=JSON.parse(shopUserInfo[i].myShopList);
                  myShopList.push(shopList[0]);
                  console.log("hum...3..." +JSON.stringify(myShopList));
					}
               response.shopUserInfo.myShopList=JSON.stringify(myShopList);
               console.log("facebook login response:"+JSON.stringify(response));
               res.send(JSON.stringify(response));
         	}

      	});
	//	}
	//});
}

router.kakaoLogin=function(req,res){
	console.log("kakaoLogin request"+JSON.stringify(req.body));

   mariaDB.existShopUser(req.body.referenceId,function(err,shopUserInfo){
   	if(err){
      	console.log(err);
         res.send(JSON.stringify({"result":"InvalidId"}));
      }else{
			req.session.uid = shopUserInfo[0].userId;
			//body.shopUserInfo={};
			const response={};
			response.result="success";

			//delete secret info
			for(let i=0; i<shopUserInfo.length; i++){
				delete shopUserInfo[i].userId;
				delete shopUserInfo[i].password;
				delete shopUserInfo[i].salt;
				delete shopUserInfo[i].shopPushId;
			}
			
			response.shopUserInfo=shopUserInfo[0];

			//여러개 shopList 하나로 합치기
			let myShopList=[];
			for(let i=0; i<shopUserInfo.length; i++){
				let shopList = JSON.parse(shopUserInfo.myShopList[i]);
				myShopList[i]=shopList[0];
				
			}
			response.shopUserInfo.myShopList=JSON.stringify(myShopList);	
			console.log(JSON.stringify(response));
      	res.send(JSON.stringify(response));

      }
	});
}


router.emailLogin=function(req,res){
	mariaDB.existEmailAndPassword(req.body.email, req.body.password, function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"invalidId"}));
		}else{
			mariaDB.existShopUser(req.body.referenceId,function(err,shopUserInfo){
				if(err){
					res.send(JSON.stringify({"result":"invalidId"}));
				}else{
					console.log("existShopUser function result:");
					console.log(shopUserInfo);
					req.session.uid = shopUserInfo[0].userId;
			         //body.shopUserInfo={};
		         const response={};
		         response.result="success";

		         //delete secret info
		         for(let i=0; i<shopUserInfo.length; i++){
		            delete shopUserInfo[i].userId;
		            delete shopUserInfo[i].password;
		            delete shopUserInfo[i].salt;
		            delete shopUserInfo[i].shopPushId;
		         }

		         response.shopUserInfo=shopUserInfo[0];

		         //여러개 shopList 하나로 합치기
		         let myShopList=[];
		         for(let i=0; i<shopUserInfo.length; i++){
		            let shopList = JSON.parse(shopUserInfo.myShopList[i]);
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


router.secretLogin=function(req,res){	
	console.log("enter secretLogin");	

	//1. facebook 가입인지 확인
	//2. facebook 가입이면 token 확인
			
	//3. shopUserInfo에 존재하는 user인지 확인

	if(req.body.referenceId.substring(0,5) === 'email'){
		console.log('secretLogin email!!');		
		
		mariaDB.existEmailAndPassword(req.body.email, req.body.password, function(err,result){
			if(err){
				console.log(err);
				res.send(JSON.stringify({"result":"failure"}));
			}else{
				console.log(result);
				mariaDB.updateShopRefId(result.userId,req.body.referenceId, function(err,result){
					if(err){
						console.log(err);
						res.send(JSON.stringify({"result":"failure"}));
					}else{
						console.log(result);
					}
				});

				mariaDB.getShopUserInfo(result.userId,function(err,shopUserInfos){
					if(err){
						console.log(err);
						res.send(JSON.stringify({"result":"failure"}));
					}else{
						console.log(result);		
         			req.session.uid = shopUserInfos[0].userId;
         			const response={};
         			response.result="success";

         			//delete secret info
         			for(let i=0; i<shopUserInfos.length; i++){
            			delete shopUserInfos[i].userId;
            			delete shopUserInfos[i].password;
            			delete shopUserInfos[i].salt;
            			delete shopUserInfos[i].shopPushId;
         			}

         			response.shopUserInfo=shopUserInfos[0];
						response.shopUserInfo.referenceId = req.body.referenceId;						

         			//여러개 shopList 하나로 합치기
         			let myShopList=[];
         			for(let i=0; i<shopUserInfos.length; i++){
            			let shopList = JSON.parse(shopUserInfos[i].myShopList);
            			myShopList[i]=shopList[0];
         			}
         			response.shopUserInfo.myShopList=JSON.stringify(myShopList);
         			console.log(JSON.stringify(response));

            		res.send(JSON.stringify(response));
					}
				});
			}
		});
	}else{
		console.log('secretLogin facebook or kakaotalk');
		mairaDB.existUserEmail(req.body.email,function(err,userInfo){
	      if(err){
   	      console.log(err);
				res.send(JSON.stringify({"result":"failure"}));
			}else{
				mariaDB.getShopUserInfo(userInfo.userId,function(err,shopUserInfos){
            	if(err){
						console.log(err);
               	res.send(JSON.stringify({"result":"failure"}));
            	}else{
						let secretPassword = crypto.createHash('sha256').update(password+shopUserInfos[0].salt).digest('hex');

               	if(secretPassword === shopUserInfos[0].password){
                  	console.log("password success!!");
						
							mariaDB.updateShopRefId(userInfo.userId,req.body.referenceId,function(err,result){
								if(err){
									console.log(err);
									res.send(JSON.stringify({"result":"failure"}));
								}else{
									console.log(result);
								}
							});
							
							req.session.uid = shopUserInfos[0].userId;
            			const response={};
            			response.result="success";

            			//delete secret info
            			for(let i=0; i<shopUserInfos.length; i++){
               			delete shopUserInfos[i].userId;
               			delete shopUserInfos[i].password;
               			delete shopUserInfos[i].salt;
               			delete shopUserInfos[i].shopPushId;
            			}

            			response.shopUserInfo=shopUserInfos[0];
							response.shopUserInfo.referenceId = req.body.referenceId;

            			//여러개 shopList 하나로 합치기
            			let myShopList=[];
            			for(let i=0; i<shopUserInfos.length; i++){
               			let shopList = JSON.parse(shopUserInfos[i].myShopList);
               			myShopList[i]=shopList[0];
            			}
            			response.shopUserInfo.myShopList=JSON.stringify(myShopList);
            			console.log(JSON.stringify(response));
            			res.send(JSON.stringify(response));
	
						}
					}
				});
			}
		});
		
	}
}

//shop 운영 on/ off
router.openShop=function(req,res){
	console.log("start openShop function");
	console.log(req.body);
	mariaDB.updateShopBusiness(req.body.takitId,"on",function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log("openShop function success");
			res.send(JSON.stringify({"result":"success"}));
		}
	});

};

router.closeShop=function(req,res){
	console.log("start closeShop function");
	mariaDB.updateShopBusiness(req.body.takitId,"off",function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log("closeShop function success");
			res.send(JSON.stringify({"result":"success"}));
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
	GCM.content = req.body.takitId+"의 알림이 다른 멤버로 변경 됩니다. 원하지 않는 경우 타킷운영자 앱을 실행해주세요.";
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
		getUserInfo(shopUserInfo.userId,callback)
	},function(userInfo,callback){
		GCM.custom.email=userInfo.email;

		async.parallel([function(callback){
			noti.sendGCM(config.SHOP_SERVER_API_KEY,GCM,[shopUserInfo.shopPushId], shopUserInfo.platform,callback); //현재 알림 멤버에게 gcm보내줌 
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
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log("change Noti Member success result:"+JSON.stringify(result));
			res.send(JSON.stringify({"result":"success"}));
		}
	});
};

router.successGCM=function(req,res){
   console.log("messageId : "+req.body.messageId);
   redisCli.del(req.session.uid+"_gcm_shop_"+req.body.messageId,function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         console.log("!!!!!!!!!!!success gcm 성공!!!!!!" +result);
         res.send(JSON.stringify({"result":"success"}));
      }
   })
}


router.sleepMode=function(req,res){
   console.log("shop sleepMode comes!!!!");
   redisCli.keys(req.session.uid+"_gcm_shop_*",function(err,result){
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

router.getShopInfo=function(req,res){
	console.log("getShopInfo");

	mariaDB.getShopInfo(req.body.takitId,function(err,shopInfo){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			delete shopInfo.orderNumberCounter;
			delete shopInfo.orderNumberCounterTime;

			console.log("success");
			let response={};
			response.shopInfo=shopInfo;
			response.result = "success";
			res.send(JSON.stringify(response));
		}
	});
}

router.refreshInfo=function(req,res){
	console.log("enter refreshInfo shop");

	async.parallel([function(callback){
		mariaDB.getShopUserInfo(req.session.uid,callback); //GCMNoti정보 받아오기 위해
	},function(callback){
		mariaDB.getShopInfo(req.body.takitId, callback); //shop on/off 받아오기 위해
	}],function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure"}));
		}else{
			console.log(result);

			let response = {};
			response.shopUserInfo={};
			response.shopInfo = result[1];
			for(let i=0; i<result.length; i++){ //getShopUserInfo가 여러개 shop 가지고 있는 user들을 여러명 검색하므로 이 작업 필요
				if(result[0][i].takitId === req.body.takitId){
					console.log("find correct takitId");
					delete result[0][i].password;
					delete result[0][i].salt;
					delete result[0][i].shopPushId;
					response.shopUserInfo = result[0][i];
					response.result = "success";

					break;
				}/*else{
					response.result="failure";
					delete response.shopUserInfo;
				}*/
				//TODO : getShopUserInfo with takitId 를 새로 만드는게 낫나 흠흠,,
				//잘 모르겠,,
			}
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
				res.send(JSON.stringify({"result":"failure","error":err}));
			}else{
				console.log("getSalesAndSatas success");
				res.send(JSON.stringify({"result":"success","sales":result[0],"stats":result[1]}))
			}
		}

		if(req.body.option === "period"){
			async.parallel([function(callback){
				mariaDB.getSalesPeriod(req.body.takitId, req.body.startTime, req.body.endTime, callback);
			},function(callback){
				mariaDB.getPeriodStatsMenu(req.body.takitId,req.body.startTime,req.body.endTime,callback);
			}],finalCallback);
		}else{
			async.waterfall([function(callback){
				mariaDB.getShopInfo(req.body.takitId,callback);
			},function(shopInfo,callback){
				let startTime = mariaDB.getLocalTimeWithOption(req.body.option,shopInfo.timezone);

				async.parallel([function(callback){
					mariaDB.getSales(req.body.takitId,startTime,callback);
				},function(result,callback){
					mariaDB.getStatsMenu(req.body.takitId,startTime,callback);
				}],callback);
			}],finalCallback);
		}

}


router.getAccount = function(req,res){
	console.log("getAccountShop start");

	mariaDB.getAccountShop(req.body.takitId,function(err,result){
		if(err){
			console.log(err);
			res.send(JSON.stringify({"result":"failure","error":err}));
		}else{
			console.log(result);
			res.send(JSON.stringify({"result":"success","account":result.account, "bankName":result.bankName, "bankCode":result.bankCode, "depositer":result.depositer}));
		}
	});
}


/*
//!!!Please check whether requestor is manager or not!!!
router.removeMenu=function(req,res,next){ //remove a menu
	var no= req.body.takitId+";"+req.body.categoryNumber;
	var name=req.body.menuName;
	console.log("body:"+JSON.stringify(req.body));
	console.log("no:"+no+" name:"+name);
	dynamoDB.removeMenu(no,name,function(menu){
		console.log("remove s3 menu image");
		// Please find the reason why fail to remove a file from S3 with Missing credentials in config
		//s3.remove_menu_image(menu.imagePath,function(){
		//	console.log("return success");
		//	return res.end(JSON.stringify({result:"success"}));
		//},function(err){
		//	console.log("err:"+err);
		//	return res.end(JSON.stringify({result:"failure"}));
		//});
		//
		console.log("return success");
		return res.end(JSON.stringify({result:"success"}));
	},function(err){
		return res.end(JSON.stringify({result:"failure"}));
	});
};

router.saveCafeInfoWithFile = function(req, res, next){
	var img = req.file.path; // full name
	console.log("img:"+req.file.path);
	console.log("req.body:"+JSON.stringify(req.body));
	console.log("req.file:"+JSON.stringify(req.file));
	var body={};
	body=req.body;
	body.imagePath=req.body.takitId+"_main";
	s3.upload_cafe_image(req.file.path,req.body.takitId+"_main",function success(){
		console.log("s3 upload success");
		dynamoDB.getCafeInfo(req.body.takitId, function(cafeInfos){
		    if(err){
		    	console.log(err);
		    	res.end(JSON.stringify({result:"failure"}));
		    }else{
		    	if(cafeInfos.length==1){
			    	// update an item
			    	console.log("updateCafeInfo");
			    	dynamoDB.updateCafeInfo(body,function(shop){
			    		var response={result:"success",shopInfo:JSON.stringify(shop)};
			    		return res.end(JSON.stringify(response));
			    	},function fail(){
			    		return res.end(JSON.stringify({result:"failure"}));
			    	});
			    }else if(cafeInfos.length==0){
			    	// put new item
			    	dynamoDB.addCafeInfo(body,function(shop){
			    		var response={result:"success",shopInfo:JSON.stringify(shop)};
			    		return res.end(JSON.stringify(response));
			    	},function fail(){
			    		return res.end(JSON.stringify({result:"failure"}));
			    	});
			    }else{
			        console.log("cafe Info duplicated! Please check SW bug");
			        res.end(JSON.stringify({result:"failure"}));
			    }
		    }
		});
	},function fail(){
		return res.end(JSON.stringify({result:"failure"}));
	});
};

router.saveCafeInfo=function(req,res,next){
	dynamoDB.getCafeInfo(req.body.takitId, function(err,cafeInfos){
		if(err){
			console.log(err);
			res.end(JSON.stringify({result:"failure"}));
		}else{
			if(cafeInfos.length==1){
		    	// update an item
		    	console.log("updateCafeInfo");
		    	dynamoDB.updateCafeInfo(req.body,function(shop){
		    		var response={result:"success",shopInfo:JSON.stringify(shop)};
		    		return res.end(JSON.stringify(response));
		    	},function fail(){
		    		return res.end(JSON.stringify({result:"failure"}));
		    	});
		    }else if(cafeInfos.length==0){
		    	// put new item
		    	dynamoDB.addCafeInfo(req.body,function(shop){
		    		var response={result:"success",shopInfo:JSON.stringify(shop)};
		    		return res.end(JSON.stringify(response));
		    	},function fail(){
		    		return res.end(JSON.stringify({result:"failure"}));
		    	});
		    }else{
		        console.log("cafe Info duplicated! Please check SW bug");
		        res.end(JSON.stringify({result:"failure"}));
		    }
		}
	    
	});
};

router.modifyMenu=function(req,res,next){
	//check if menu exists or not
	console.log("body:"+JSON.stringify(req.body.category_no));
	dynamoDB.getMenuInfo(req.body.category_no,req.body.menuName,function(menuInfos){
		if(menuInfos.length==1){
			dynamoDB.updateMenuInfo(req.body,function(menu){
				var response={result:"success",menu:JSON.stringify(menu)};
				return res.end(JSON.stringify(response));
			},function fail(){
				res.end(JSON.stringify({result:"failure",reason:"menu db update failure."}));
			});
		}else if(menuInfos.length==0){
			res.end(JSON.stringify({result:"failure",reason:"menu doesn't exist."}));
		}
	},function(err){
		res.end(JSON.stringify({result:"failure"}));
	});
};

router.modifyMenuWithFile=function(req,res,next){
	console.log("[modifyMenuWithFile] req.body:"+JSON.stringify(req.body));
	dynamoDB.getMenuInfo(req.body.category_no,req.body.menuName,function(menuInfos){
		console.log("menuInfos:"+menuInfos.length);
		if(menuInfos.length==1){
			// s3 upload
			console.log("call s3.upload_cafe_image");
			s3.upload_cafe_image(req.file.path,req.body.category_no+"_"+req.body.menuName,function success(){
				console.log("call dynamoDB.updateMenuInfo");
				dynamoDB.updateMenuInfo(req.body,function(menu){
					var response={result:"success",menu:JSON.stringify(menu)};
					return res.end(JSON.stringify(response));
				},function fail(){
					res.end(JSON.stringify({result:"failure",reason:"menu db update failure."}));
				});
			},function fail(){
				res.end(JSON.stringify({result:"failure",reason:"s3 upload failure"}));
			});
		}else if(menuInfos.length==0){
			res.end(JSON.stringify({result:"failure",reason:"menu doesn't exist."}));
		}
	},function(err){
		res.end(JSON.stringify({result:"failure"}));
	});
};

router.registerMenuWithFile=function(req,res,next){
	console.log("req.body:"+JSON.stringify(req.body));
	// s3 upload
	s3.upload_cafe_image(req.file.path,req.body.category_no+"_"+req.body.menuName,function success(){
		dynamoDB.addMenuInfo(req.body,function(menus){
			var response={result:"success",menus:JSON.stringify(menus)};
			return res.end(JSON.stringify(response));
		},function fail(){
			res.end(JSON.stringify({result:"failure",reason:"menu db update failure."}));
		});
	},function fail(){
		res.end(JSON.stringify({result:"failure",reason:"s3 upload failure"}));
	});
};

router.addCategory=function(req,res,next){
	// return the list of categories
	console.log("req.body:"+JSON.stringify(req.body));
	var category={};
	category.takitId=req.body.takitId;
	category.category_name=	req.body.categoryName;
	var q=d3.queue();

	q.defer(dynamoDB.addCategory,category);

	q.await(function(success,results){
		console.log("success:"+success);
		if(!success){
			console.log(JSON.stringify(results));
			res.end(JSON.stringify({result:"failure"}));
		}else{
		    //get all the categories with takitId
			dynamoDB.getCategoriesFunction(category.takitId,function(categories){
				console.log("addCategory-success");
				res.end(JSON.stringify({result:"success",categories:categories}));
			},function fail(){
				res.end(JSON.stringify({result:"failure"}));
			});
		}
	});
};

router.removeCategory=function(req,res,next){
	// return the list of categories
	console.log("req.body:"+JSON.stringify(req.body));

    var category={};
	category.takitId=req.body.takitId;
	category.category_no=req.body.no;

	dynamoDB.removeCategory(category,
			function(){
				res.end(JSON.stringify({result:"success"}));
			},function fail(){
				res.end(JSON.stringify({result:"failure"}));
			}
	);
};

router.modifyCategory=function(req,res,next){
	// return the list of categories
	console.log("req.body:"+JSON.stringify(req.body));
	var category={};
	category.category_name=req.body.name;
	category.takitId=req.body.takitId;
	category.category_no=req.body.no;

	var q=d3.queue();

	q.defer(dynamoDB.modifyCategory,category);

	q.await(function(success,results){
		console.log("success:"+success);
		if(!success){
			console.log(JSON.stringify(results));
			res.end(JSON.stringify({result:"failure"}));
		}else{
			res.end(JSON.stringify({result:"success"}));
		}
	});
};
*/
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

/*
router.couponSend=function(req,res,next){
	

	var orders = {};
	var ExclusiveStartKey='0';

	//오늘 날짜 설정 
	var date = new Date();
	
	var today = date.getUTCFullYear().toString()+
	            (date.getUTCMonth()+1).toString()+
	            date.getUTCDate().toString();
	console.log(today);
	//console.log(req.body.takitId);
	//console.log(req);

	//1. order정보에서 조건에 맞는 쿼리 가져오기
	var q=d3.queue();
	
	if(req.body.periodOption==="period"){
		
		q.defer(dynamoDB.setRedisPeriodOrders,req.body.takitId,10,req.body.startDate,req.endDate,ExclusiveStartKey);
		
	}else{
		q.defer(dynamoDB.setRedisOrders,req.body.takitId, req.body.periodOption, 10, ExclusiveStartKey,today);
	}
	 //2. 1의 결과값 redis 저장
		q.await(function(err,result){
			console.log("await comes");
			if(err){
				console.log(err);
				throw err;
			}else{
				//console.log("result:"+JSON.stringify(result1));
				if(typeof result === 'undefind' || result === null){
					res.end(JSON.stringify("notExistUser"));
				}
				
				console.log("get Keys call");

				var q=d3.queue();
				
				redisLib.getKeys(today+"_*",function(err,key){
					for(var i=0; i<key.length; i++){
						redisLib.getRedisAll(key[i],function(err,user){
							if(err){
								console.log(err);
								throw err;
							}else{
								console.log(user);
								router.sendGMSCouponMsg(SERVER_API_KEY,user.pushid,req.body.MSGcontents,user.buyer_name,function(err,MSGResult){
									if(err){
										console.log(err);
										throw err;
									}else{
										if(MSGResult.success){
											res.end(JSON.stringify("success"));
										}else{
											res.end(JSON.stringify("failure"));
										}
										
									}
								});

							}
						});
					}
				});
				
			}
		});



};




router.customerSearch=function(req,res,next){
	//콜백 함수 정의
	function success(orders,LastEvaluatedKey){
		var response={};
		response.orders=orders;
		response.LastEvaluatedKey=LastEvaluatedKey.toString();

		orders.forEach(function(item){
			var key = "user_"+orders.order_no;
			redis.orderSetRedis(key,orders);
		});

		var q = d3.queue();

		q.awaitAll(function(error) {
			  if (error)
				  throw error;
			  console.log("orders:"+JSON.stringify(orders));
			  res.end(JSON.stringify(response));
			});
	}

	function fail(err){
		res.statusCode=501; // internal server error
		res.end(JSON.stringify(err));
	}

	//user가 설정한 기간이면
	if(req.body.option==="period"){
		dynamoDB.getPeriodOrders(req.body.takitId,
				req.body.count,
				req.body.start,
				req.body.end,
				req.body.ExclusiveStartKey,
				success,
				fail);
	}else{//한주, 한달로 설정 했을 때
		dynamoDB.getOrders(req.body.takitId, req.body.periodOption, 10, 0,success, fail);

	}

	//+day
	//+hour
	//+customer(빈도,구매액)
};

*/


module.exports = router;
