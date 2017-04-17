let express = require('express');
let request = require('request');
let gcm = require('node-gcm');
let timezoneJS = require('timezone-js');
let async = require('async');
let	redis = require('redis');
let Scheduler = require('redis-scheduler');

let mariaDB = require('./mariaDB');
let noti = require('./notification');
let cash = require('./cash');
let config = require('../config');
let index = require('./index');
let op = require('./op');

let router = express.Router();
let redisCli = redis.createClient(); 
let scheduler = new Scheduler();


let a = new index.SuccResponse();
console.log(a);

function updateOrderStatus(order){
   let title;

   switch (order.orderStatus){
      case 'paid' :
         title='[타킷] 주문 '+order.orderName; break;
      case 'checked' :
         title='[타킷] 주문접수 '+order.orderName; break;
      case 'completed' :
         title='[타킷] 주문준비완료 '+order.orderName; break;
      case 'cancelled' :
         title='[타킷] 주문취소 '+order.orderName; break;
      default :
         title = '[타킷]';
   }

   return title;
}

//1. user - SMS noti 필요한 사람
//2. user - SMS noti 필요 없는 사람
function sendOrderMSGUser(order,userInfo,next){
   const GCM = {};
   GCM.title = updateOrderStatus(order);
   GCM.content = "주문번호 "+order.orderNO;

   if(order.hasOwnProperty('cancelReason') && order.cancelReason!==null && order.cancelReason !== ""){
      GCM.content += '취소사유:'+JSON.stringify(order.cancelReason);
   }

   GCM.GCMType = "order";
   GCM.custom = JSON.stringify(order);	

   //noti 받는 사람
   if(userInfo.SMSNoti==="on"){
		console.log("SMSNoti on!!!!");
      async.waterfall([function(callback){
         redisCli.incr("gcm",callback);
      },function(messageId,callback){
         GCM.messageId = messageId;
         const SMS = {};
         SMS.title = GCM.title;
         SMS.content = GCM.content+"\n상단바 알림을 클릭하시면 문자를 받지 않을 수 있습니다.";

			if(userInfo.pushId === null || userInfo.pushId === undefined){
         	noti.setRedisScheduleLMS(order.userId+"_gcm_user_"+messageId,order.userPhone,SMS,10000,callback);
			}else{
				noti.setRedisScheduleLMS(order.userId+"_gcm_user_"+messageId,order.userPhone,SMS,60000,callback);
			}
      },function(result,callback){
         noti.sendGCM(config.SERVER_API_KEY,GCM,[userInfo.pushId], userInfo.platform,"takit",callback);
      }],function(err,result){
         if(err){
            console.log(err);
            next(err);
         }else{
            const response={}
            response.order = order;
            response.messageId = GCM.messageId;
            next(null,response);
         }
      });
   }else{ //noti받지 않는 사람
		console.log("SMSNoti off!!!!");
      noti.sendGCM(config.SERVER_API_KEY,GCM,[userInfo.pushId], userInfo.platform,"takit", function(err,result){
         if(err){
            console.log(err);
            next(err);
         }else{
            const response={}
            response.order = order;
            response.messageId = GCM.messageId;
            next(null,response);
         }
      });
   }

}


function sendOrderMSGShop(order, shopUserInfo,next){
   const GCM = {};
   GCM.title = updateOrderStatus(order);
   GCM.content = "주문번호 "+order.orderNO+" 주문내역:"+order.orderName;

   if(order.hasOwnProperty('cancelReason') && order.cancelReason!==null && order.cancelReason !== ""){
      GCM.content += '취소사유:'+JSON.stringify(order.cancelReason);
   }

   GCM.GCMType = "order";
   GCM.custom = JSON.stringify(order);

   async.waterfall([function(callback){
      redisCli.incr("gcm",callback);
   },function(messageId,callback){
      GCM.messageId = messageId;
      const SMS = {};
      SMS.title = GCM.title;
      SMS.content = "주문번호 "+order.orderNO+" 새로고침 버튼을 눌러주세요";
		noti.sendSMS(SMS.title+" "+SMS.content,["01042588226"]); //set production mode
      noti.setRedisSchedule(shopUserInfo.userId+"_gcm_shop_"+messageId,shopUserInfo.phone,SMS,callback);
   },function(result,callback){
		let sound = "takit";
		if(order.orderStatus === "cancelled"){
			sound = "cancelorder";
		}
      noti.sendGCM(config.SHOP_SERVER_API_KEY,GCM,[shopUserInfo.shopPushId], shopUserInfo.platform,sound,callback);
   }],function(err,result){
      if(err){
         console.log(err);
         next(err);
      }else{
         const response={}
         response.order = order;
         response.messageId = GCM.messageId;
         next(null,response);
      }
	});
}


// function getTimezoneLocalTime(timezone,time,next){ // return current local time in timezone area
// 	var offset=(new timezoneJS.Date(Date(), timezone)).getTimezoneOffset(); // offset in minutes
// 	var currlocal=new Date(time.getTime() - (offset*60*1000));
	
// 	var localOrderedTime = {};
// 	localOrderedTime.time = currlocal.toISOString();
// 	localOrderedTime.day = currlocal.getUTCDay();
// 	localOrderedTime.hour= currlocal.getUTCHours();	

// 	next(null,localOrderedTime);
// }






//{\"open\":[[10,8,8,8,8,8,10],[00,00,00,00,00,00,00]],\"close\": [[18,19,19,19,19,19,18],[40,40,40,40,40,40,40]]}

//[\"10:00~18:40\",\"08:00~19:40\",\"08:00~19:40\",\"08:00~19:40\",\"08:00~19:40\",\"08:00~19:40\",\"10:00~18:40\"]
//주문정보 저장



router.saveOrder=function(req, res){
	let order=req.body;
	console.log("req.body:"+JSON.stringify(req.body));
	console.log("userId:"+req.session.uid);
	order.userId=req.session.uid;
	order.orderStatus="paid";
	order.orderedTime = req.body.orderedTime;

	let shopInfo;

	async.waterfall([function(callback){
        mariaDB.checkCashPwd(req.body.cashId.toUpperCase(),req.body.password,callback);
    },function(result,callback){
	    mariaDB.getShopInfo(req.body.takitId,callback);
	},function(result,callback){
        shopInfo = result;
        console.log("shopInfo:"+JSON.stringify(shopInfo));
        
        let UTCOrderTime=new Date(order.orderedTime);
        let localOrderedTime  = op.getTimezoneLocalTime(shopInfo.timezone,UTCOrderTime);
        
        order.localOrderedTime=localOrderedTime.toISOString();
        order.localOrderedHour=localOrderedTime.getUTCHours();
        order.localOrderedDay = localOrderedTime.getUTCDay();
        order.localOrderedDate = localOrderedTime.toISOString().substring(0,10);


		if(shopInfo.businessTime !== null){

            let businessTime=op.computeBusinessTime(JSON.parse(shopInfo.businessTime),localOrderedTime.getUTCDay());

			console.log(parseInt(businessTime.openHour));
			console.log(typeof localOrderedTime.getUTCHours());
			console.log(localOrderedTime.getUTCHours()+","+localOrderedTime.getUTCMinutes());
            if(shopInfo.business === "on" && (businessTime.openHour < localOrderedTime.getUTCHours() ||  
                (businessTime.openHour === localOrderedTime.getUTCHours() && businessTime.openMin <= localOrderedTime.getUTCMinutes())) 
                && (businessTime.closeHour > localOrderedTime.getUTCHours() ||
                (businessTime.closeHour === localOrderedTime.getUTCHours() && businessTime.closeMin > localOrderedTime.getUTCMinutes()))){
                mariaDB.getOrderNumber(shopInfo,callback);
            }else{
                callback("shop's off");
            }
        }else{
            callback("shop's business time is null");
        }

        // if(shopInfo.business === "on"){	
        //     mariaDB.getOrderNumber(shopInfo,callback);
        // }else{
        //     callback("shop's off");
        // }
    },function(orderNO,callback){
        order.orderNO=orderNO;
        console.log("orderNO:"+orderNO);
        mariaDB.saveOrder(order,shopInfo,callback);
    },function(orderId,callback){
        console.log(orderId);
        async.parallel([function(callback){
            mariaDB.getOrder(orderId,callback);
        },function(callback){
            mariaDB.getShopPushId(req.body.takitId,callback);
        },function(callback){
            cash.payCash(req.body.cashId,req.body.amount,callback);
        }],callback);

    },function(result,callback){
        //async.parallel([function(callback){
    //	mariaDB.updateSalesShop(req.body.takitId,req.body.amount,callback); //지불한 상점에 매출 더해줌.
    //},function(callback){
        console.log("getShopPushId result:"+JSON.stringify(result));
        console.log(result[0]);
        console.log(result[1]);
        sendOrderMSGShop(result[0],result[1],callback); //result[0]:order, result[1] :shopUserInfo(shopPushId, userId, platform)
    //}],callback);
    }],function(err,result){
        if(err){
			console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            response.order = result.order;
            response.messageId = result.messageId;
            console.log("save order result:"+JSON.stringify(result));
            res.send(JSON.stringify(response));
        }
    });
};

router.getOrdersUser=function(req,res){
	//1. period설정인지 아닌지 확인
	//2. userId에 해당하는 order검색
	
	mariaDB.getOrdersUser(req.session.uid,req.body.takitId,req.body.lastOrderId,req.body.limit,function(err,orders){
		
		if(err){
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
		}else{
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
			response.orders=orders;
         res.send(JSON.stringify(response));
		}    
	});

}

router.getOrdersShop=function(req,res){
	console.log("getOrders:"+JSON.stringify(req.body));
	
	if(req.body.option === "period"){
		mariaDB.getPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,req.body.lastOrderId,req.body.limit,function(err,orders){
			if(err){
				console.log(err);
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
         	res.send(JSON.stringify(response));
			}else{
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
         	response.orders=orders;
				res.send(JSON.stringify(response));
			}
		});
	}else{			
		mariaDB.getOrdersShop(req.body.takitId,req.body.option,req.body.lastOrderId,req.body.limit,function(err,orders){
			if(err){
				console.log(err);
				let response = new index.FailResponse(err);
				response.setVersion(config.MIGRATION,req.version);
        	 	res.send(JSON.stringify(response));
			}else{
				let response = new index.SuccResponse();
				response.setVersion(config.MIGRATION,req.version);
				response.orders=orders;
         	res.send(JSON.stringify(response));
			}	
		});
		
	}
};


router.checkOrder=function(req,res){ // previous status must be "paid".
	//1. order정보 가져옴
	//2. shopUser인지 확인
	//3. orderStatus update
	//4. send a massege

	//check shop member
	console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
   let order={};
	async.waterfall([function(callback){
      // Please check if req.session.uid is a member or manager of shop
		mariaDB.getShopUserInfo(req.session.uid,callback); //shop의 member인지 체크
	},function(result,callback){
      //주문상태 update
		mariaDB.updateOrderStatus(req.body.orderId,'paid','checked','checkedTime',
		new Date(),req.body.cancelReason,null,callback);
	},function(result,callback){
		mariaDB.getOrder(req.body.orderId,callback);
	},function(result,callback){
      order = result;
		mariaDB.getPushId(order.userId,callback);
	},function(userInfo,callback){
      console.log("shopUserInfo:"+userInfo);
      sendOrderMSGUser(order,userInfo,callback);
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
};

router.completeOrder=function(req,res){//previous status must be "checked".
   //1. order정보 가져옴
   //2. shopUser인지 확인
   //3. orderStatus update
   //4. send a massege

   //check shop member
   console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));

   let order={};

   async.waterfall([function(callback){
      // Please check if req.session.uid is a member or manager of shop
      mariaDB.getShopUserInfo(req.session.uid,callback);
   },function(result,callback){
      //주문상태 update
      mariaDB.updateOrderStatus(req.body.orderId,'checked','completed','completedTime',
      new Date(),req.body.cancelReason,null,callback);
   },function(result,callback){
      //update된 상태user, shopUser에게  msg보내줌
      mariaDB.getOrder(req.body.orderId,callback);
   },function(result,callback){
      order = result;
		async.parallel([function(callback){
			mariaDB.updateSalesShop(order.takitId,order.amount,callback);
		},function(callback){
      	mariaDB.getPushId(order.userId,callback);
		}],callback);
   },function(result,callback){
		let userInfo = result[1];
      sendOrderMSGUser(order,userInfo,callback);
   }],function(err,result){
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
};


//user가 취소할때
router.cancelOrderUser=function(req,res){

   //1. shopUser인지 확인
    //2. order정보 가져와서 'paid' 상태에서만 취소가능
    //3. orderStatus update
    //4. send a massege

    //check shop member
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));

    let order = {};
    async.waterfall([function(callback){
       //orderStatus가 paid 일 때만 주문 취소 가능 .. -> oldStatus = 'paid'로 지정
       mariaDB.updateOrderStatus(req.body.orderId,'paid','cancelled','cancelledTime',
		 new Date(),req.body.cancelReason,"Asia/Seoul",callback);
    },function(result,callback){
       mariaDB.getOrder(req.body.orderId,callback);
    },function(result,callback){
       order = result;
       console.log("cancel order :"+order.amount);
       async.parallel([function(callback){
          cash.cancelCash(req.body.cashId,parseInt(order.amount),callback); //cash로 다시 돌려줌
       },function(callback){
          mariaDB.updateSalesShop(order.takitId,-parseInt(order.amount),callback);
       },function(callback){
          mariaDB.getShopPushId(order.takitId,callback);
       }],callback);
    },function(result,callback){
       //shop한테 noti 보내줌
       sendOrderMSGShop(order,result[2],callback);
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
        res.send(JSON.stringify(response));
		 }
	});
}

//shop취소
router.shopCancelOrder=function(req,res){
   //1. order정보 가져옴
   //2. shopUser인지 확인
   //3. orderStatus update
   //4. send a massege

   //check shop member
   console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));

   let order={};

   async.waterfall([function(callback){
      mariaDB.getShopUserInfo(req.session.uid,callback);
   },function(result,callback){
      mariaDB.updateOrderStatus(req.body.orderId,'','cancelled','cancelledTime',
      new Date(),req.body.cancelReason,"Asia/Seoul" ,callback);
   },function(result,callback){
      mariaDB.getOrder(req.body.orderId,callback);
   },function(result,callback){
      order = result;
      mariaDB.getCashId(order.userId,callback);
   },function(cashId,callback){
      console.log("cancel order :"+JSON.stringify(order));
      async.parallel([function(callback){
         cash.cancelCash(cashId,parseInt(order.amount),callback); //cash로 다시 돌려줌
      },function(callback){
         mariaDB.updateSalesShop(order.takitId,-parseInt(order.amount),callback);
      },function(callback){
         mariaDB.getPushId(order.userId,callback);
      }],callback);
   },function(result,callback){
      //shop한테 noti 보내줌
      sendOrderMSGUser(order,result[2],callback);
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }else {
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
         res.send(JSON.stringify(response));
      }
   });
};
	
module.exports = router;
