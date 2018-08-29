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
let card = require('./card');
let config = require('../config');
let index = require('./index');
let op = require('./op');
let socket = require('./socket');
let cashBill =require('./cashBill');

let router = express.Router();
let redisCli = redis.createClient(); 
let scheduler = new Scheduler();

function updateOrderStatus(order){
   let title;
	console.log("takeout:"+order.takeout);
	
	//배달일 경우
	if(order.takeout == 2){
		switch (order.orderStatus){
      		case 'paid' :
         		title='[웨이티] 주문 '+order.orderName; break;
      		case 'checked' :
         		title='[웨이티] 주문접수 '+order.orderName; break;
      		case 'completed' :
         		title='[웨이티] 배달출발 '+order.orderName; break;
      		case 'cancelled' :
         		title='[웨이티] 주문취소 '+order.orderName; break;
      		default :
         		title = '[웨이티]';
   			}
	}else{
   		switch (order.orderStatus){
      		case 'paid' :
         		title='[웨이티] 주문 '+order.orderName; break;
      		case 'checked' :
         		title='[웨이티] 주문접수 '+order.orderName; break;
      		case 'completed' :
         		title='[웨이티] 주문준비완료 '+order.orderName; break;
      		case 'cancelled' :
         		title='[웨이티] 주문취소 '+order.orderName; break;
            case 'pickup':
                title='[웨이티]주문전달완료 '+order.orderName;break;
      		default :
         		title = '[웨이티]';
   		}
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

   //업주에게도 전달함. socket으로 연결된 업주가 있을수 있음
   socket.notifySocket(order); 
   //noti 받는 사람
   //if(userInfo.SMSNoti==="on"){
   if(order.orderStatus!="checked"){    // 주문접수일 경우 sms를 전달하지 않는다.완료와 취소는 sms를 전달한다.
		console.log("SMSNoti on!!!!");
      async.waterfall([function(callback){
         redisCli.incr("gcm",callback);
      },function(messageId,callback){
         console.log("sendOrderMSGUser messageId:"+messageId);
         GCM.messageId = messageId;
         const SMS = {};
         SMS.title = GCM.title;
         SMS.content = GCM.content+"\n상단바 알림을 클릭하시면 문자를 받지 않을 수 있습니다.";

			if(userInfo.pushId === null || userInfo.pushId === undefined){
         	noti.setRedisScheduleLMS(order.userId+"_gcm_user_"+messageId,order.userPhone,SMS,10000,callback);
			}else{
				noti.setRedisScheduleLMS(order.userId+"_gcm_user_"+messageId,order.userPhone,SMS,60000,callback); // humm... one minutes
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
   }else{ // 주문 접수 일경우 
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

   //setup Timer to call  socket after 2 seconds
   setTimeout(function(){ socket.notifySocket(order);}, 2000);

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
      ///////////////////////////////////////////////////////////////////////////////
	  if(!order.takitId.startsWith("TEST")){
	  	noti.sendSMS(SMS.title+" "+SMS.content,[config.SMS.SENDER]); //set production mode
	  }else{
        console.log("takitId startsWith TEST. Do not send william sms");
      }
      //////////////////////////////////////////////////////////////////////////////
      console.log("shopUserInfo.phone:"+shopUserInfo.phone);
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

//param:uid, order,orderedTime,paymethod,customer_uid
function saveOrderEach(param,next){
    console.log("param:"+JSON.stringify(param));
    let order=param.order;

     console.log("!!!param.order:!!!!"+JSON.stringify(order));
     console.log("!!!order.paymethod:!!!!"+JSON.stringify(order.paymethod));

    order.orderStatus="paid";

    order.orderedTime    =param.orderedTime;
    order.takeout        =param.takeout;
    order.userId         =param.userId;
    order.deliveryFee    =param.deliveryFee;
    order.deliveryAddress=param.deliveryAddress;
    order.customer_uid   =param.customer_uid;
    order.total          =param.total;

    console.log("!!!!!!order.total:"+param.total);
	let shopInfo;
    let newOrderId;
 
    async.waterfall([function(callback){
      //check if menu is soldout
      let menus=[];
      order.orderList.menus.forEach(menu=>{
           let menuInfo=menu ;//{menuNO:menu.menuNO,menuName:menu.menuName};
           menus.push(menuInfo);
      });
      console.log("menus:"+JSON.stringify(menus));
      mariaDB.checkIfMenuSoldOut(menus,callback);
    },function(result,callback){
        console.log("result of soldout"+result);
        mariaDB.getShopInfo(order.takitId,callback);
    },function(result,callback){
        shopInfo = result;
        
        //console.log("shopInfo:"+JSON.stringify(shopInfo));
        // humm please check it according to payment
        let user_paymethod=order.paymethod;
        let shop_paymethod=JSON.parse(shopInfo.paymethod);

        //console.log("shop_paymethod.cash:"+shop_paymethod.cash);
        console.log("user_paymethod:"+user_paymethod + " type:"+typeof user_paymethod);
        //재주문시 user_paymethod가 string으로 들어올수 있음. Why?
        if(typeof user_paymethod ==="string"){
            let stringVal= user_paymethod;
            user_paymethod=JSON.parse(stringVal);
            console.log("user_paymethod:"+JSON.stringify(user_paymethod.cash));
        }
        // 상점의 discount rate과 결제 방법을 확인함 
        if(param.payment=="cash" && shop_paymethod.cash!=user_paymethod.cash)
            callback("paymethod is out of date user_paymethod.cash:"+order.paymethod);
        else if(param.payment=="card" && shop_paymethod.card!=user_paymethod.card)
            callback("paymethod is out of date");
        else
            callback(null, param.payment);        
    },function(payment,callback){
        order.paymethod=payment; // DB의 이름이 paymethod임
        if(payment=="card"){
            card.payCard(order.userId,order.total,order.customer_uid,order.orderName,callback); 
        }else{           
            callback(null,"cash"); 
        } 
    },function(approval,callback){
        console.log("approval is ..."+JSON.stringify(approval));

        if(typeof approval === 'object'){
            order.imp_uid  = approval.imp_uid;
            order.approval = approval.approval;
            order.card_info= approval.card_info;
            console.log("order_card_info:"+order.card_info);
        }
        console.log("order.orderedTime:"+order.orderedTime);

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
                console.log("!!!!shopInfo.business:"+shopInfo.business);
                if(shopInfo.business !="on"){
                    callback("shop's closed");
                }else{
                    let businessTimeString="";
                    businessTimeString+=(businessTime.openHour >9 ? businessTime.openHour:"0"+businessTime.openHour);
                    //console.log(" "+businessTimeString);
                    businessTimeString+=":";
                    //console.log(" "+businessTimeString);
                    businessTimeString+=(businessTime.openMin>9?businessTime.openMin:"0"+businessTime.openMin);
                    //console.log(" "+businessTimeString);
					businessTimeString+="-";
                    businessTimeString+=(businessTime.closeHour >9 ? businessTime.closeHour:"0"+businessTime.closeHour);
                    //console.log(" "+businessTimeString);
                    businessTimeString+=":";
                    //console.log(" "+businessTimeString);
                    businessTimeString+=(businessTime.closeMin>9?businessTime.closeMin:"0"+businessTime.closeMin);
                    //console.log(" "+businessTimeString);
                    callback("shop's off ("+businessTimeString+")"); 
                }
            }
        }else{
            callback("shop's business time is null");
        }
    },function(orderNO,callback){
        order.orderNO=orderNO;
        console.log("orderNO:"+orderNO);
        order.orderList=JSON.stringify(order.orderList);
        console.log("orderList......:"+JSON.stringify(order.orderList));
        mariaDB.saveOrder(order,shopInfo,callback);
    },function(orderId,callback){
        console.log(orderId);
        newOrderId=orderId;
        async.parallel([function(callback){
            mariaDB.getOrder(orderId,callback);
        },function(callback){
            mariaDB.getShopPushIdWithEmail(order.takitId,callback);
        },function(callback){
            console.log("payment:["+param.payment+"]");
            if(param.payment=="cash"){
                console.log("call cash.payCash");
                cash.payCash(param.cashId,order.total,orderId,callback);
            }else{
                console.log("This must be card");
                callback(null);
            }
        }],function(err,result){
           console.log("payCash result-err:"+JSON.stringify(err));
           if(err){
               //주문상태를 cancel로 만든이후에 error를 리턴한다. workaround로 근본적으로 saveOrder가발생하지 못하도록 해야 한다. 
               mariaDB.updateOrderStatus(newOrderId,'paid','cancelled','cancelledTime',
                                         new Date(),'결제 실패',"Asia/Seoul",function(error,result){
                   callback(err); //payCash의 에러를 전달한다. 
               });
           }else 
               callback(null,result); 
          });
    },function(result,callback){
        console.log("getShopPushId result:"+JSON.stringify(result));
        console.log(result[0]);
        console.log(result[1]);
        sendOrderMSGShop(result[0],result[1],callback); //result[0]:order, result[1] :shopUserInfo(shopPushId, userId, platform)
    }],function(err,result){
        if(err){
            console.log("err comes:"+err);
            if(err!="card-approval"){ // other error like getOrder....
                //Please cancel card approval.
            }
            console.log(err);
            next(err);
        }else{
            //console.log("hum... result.order:"+JSON.stringify(result.order));
            result.order.payment=param.payment;
            let output={order:result.order,messageId:result.messageId};
            next(null,output);
        }
    }); 
}

checkOneTimeConstraint=function(timeConstraint){
        var currTime = new Date();
        let currLocalTime=currTime.getMinutes()+ currTime.getHours()*60;

        if(timeConstraint){
                if(timeConstraint.from && (!timeConstraint.to || timeConstraint.to==null)){
                        //current time in seconds is more than or equal to
                        if(currLocalTime<timeConstraint.fromMins)
                            return false;
                }else if((!timeConstraint.from || timeConstraint.from==null) && timeConstraint.to){
                        //current time is less then or equal to
                        console.log("currLocalTime:"+currLocalTime+"timeConstraint.ToMins:"+timeConstraint.toMins);
                        if(currLocalTime>timeConstraint.toMins){
                            return false;
                        }
                }else if(timeConstraint.from && timeConstraint.from!=null
                        && timeConstraint.to!=null && timeConstraint.to){
                    if(timeConstraint.condition=='XOR'){
                        //current time is more than or equal to from OR
                        //    current time is less than or equal to to
                        if(timeConstraint.fromMins<currLocalTime ||currLocalTime<timeConstraint.toMins)
                            return false;
                    }else if(timeConstraint.condition=='AND'){
                        //    current time is more than or equal to from AND
                        //    current time is less than or equal to to
                         if(timeConstraint.fromMins>currLocalTime ||currLocalTime>timeConstraint.toMins)
                            return false;
                    }
                }
        }
        return true;
}

router.saveOrderCart=function(req, res){
    let order=req.body;
    console.log("req.body:"+JSON.stringify(req.body));
    console.log("userId:"+req.session.uid);
    let shops=[]; 
    let orderList=JSON.parse(req.body.orderList);

    // timeconstraint 조사
    orderList.forEach(element => { // 잘못된 코드이다 ㅜㅜ 나중에 수정이 필요하다. 
           let shop={};
           shop.order       =element;
           shop.userId      =req.session.uid;
           shop.payment     =req.body.payment;
           shop.orderedTime =req.body.orderedTime;
           shop.orderStatus ="paid"; 
           shop.takeout     =req.body.takeout;
           shop.cashId      =req.body.cashId;
           shop.deliveryFee    = req.body.deliveryFee;
           if(req.body.total){
               shop.total =req.body.total;
           }else{
               console.log("!!!!total is not comming!!!!");
               shop.total=req.body.amount;
           }
           console.log("!!!!!total:"+shop.total); // hum....
           shop.deliveryAddress= req.body.deliveryAddress;
           if(req.body.payment=="card")
               shop.customer_uid=req.body.customer_uid
           shops.push(shop);
    });

    mariaDB.checkCashPwd(req.body.cashId.toUpperCase(),req.body.password,function(err,result){
          if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
            return;
          }
          let items=shops;
          console.log("shops.length:"+shops.length);
          async.map(shops,saveOrderEach,function(err,eachResult){
              if(err){
                  console.log("error happens,"+err);
                  let response = new index.FailResponse(err);
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
              }else{
                  console.log("eachResult:"+JSON.stringify(eachResult));
                  let response = new index.SuccResponse();
                  response.setVersion(config.MIGRATION,req.version);
                  response.order = eachResult;
                  console.log("save order result:"+JSON.stringify(eachResult));
                  res.send(JSON.stringify(response));
                  console.log("All done "+JSON.stringify(response));
              }
          }); 
    });
};


router.getOrdersUser=function(req,res){
	//1. period설정인지 아닌지 확인
	//2. userId에 해당하는 order검색
    console.log("getOrdersUsers body:"+req.body)
	
	let body = req.body;
	body.userId = req.session.uid	
	mariaDB.getOrdersUser(body,(err,orders)=>{
		
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

router.getOrdersUserDefault=function(req,res){
    //1. period설정인지 아닌지 확인
    //2. userId에 해당하는 order검색
    console.log("getOrdersUsers body:"+req.body)
   
    let body = req.body;
    body.userId = req.session.uid
    //userId, lastOrderId, limit
    console.log("params:"+JSON.stringify(body));
    mariaDB.getOrdersUserDefault(body,(err,orders)=>{
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
		mariaDB.getPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,
                                    req.body.lastOrderId,req.body.limit,
                                    function(err,orders){
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
		mariaDB.getOrdersShop(req.body.takitId,req.body.option,
                              req.body.lastOrderId,req.body.limit,
                              //req.body.lastKioskOrderId,
                              function(err,orders){
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

/*
router.getOrdersShop=function(req,res){
    console.log("getOrders:"+JSON.stringify(req.body));
   
    if(req.body.option === "period"){
        mariaDB.getPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,
                                    req.body.lastOrderId,req.body.limit,
                                    function(err,orders){
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
        mariaDB.getOrdersShop(req.body.takitId,req.body.option,
                              req.body.lastOrderId,req.body.limit,
                              function(err,orders){
            if(err){
                console.log(err);
                let response = new index.FailResponse(err);
                response.setVersion(config.MIGRATION,req.version);
                res.send(JSON.stringify(response));
            }else{
                let resultOrders=orders;
                mariaDB.getKioskOrdersShop(req.body.takitId,req.body.option,req.body.lastKioskOrderId,req.body.limit,
                      function(err,kioskOrders){
                          let response = new index.SuccResponse();
                          response.setVersion(config.MIGRATION,req.version);
                          if(kioskOrders && kioskOrders.length>0){
                              kioskOrders.forEach(order=>{
                                  order.type='kiosk';
                                  resultOrders.push(order);
                              }) 
                          }
                          response.orders=resultOrders;
                          res.send(JSON.stringify(response));
                      });
            }
        });
    }
};
*/

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

//////////////////////////////////////////////////////////
// kalen.lee-begin
router.checkOrderWithEmail=function(req,res){ // previous status must be "paid".
    //1. order정보 가져옴
    //2. shopUser인지 확인
    //3. orderStatus update
    //4. send a massege

    //check shop member
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
   let order={};
    async.waterfall([function(callback){
      // Please check if req.session.uid is a member or manager of shop
        mariaDB.getShopUserInfoWithEmail(req.session.uid,callback); //shop의 member인지 체크
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
      userInfo.SMSNoti="on";
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


router.pickupOrderWithEmail=function(req,res){ // previous status must be "completed".
    //2. shopUser인지 확인
    //3. orderStatus update
    //4. send a massege

    //check shop member
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
   let order={};
    async.waterfall([function(callback){
      // Please check if req.session.uid is a member or manager of shop
        mariaDB.getShopUserInfoWithEmail(req.session.uid,callback); //shop의 member인지 체크
    },function(result,callback){
      //주문상태 update
        mariaDB.updateOrderStatus(req.body.orderId,'completed','pickup','pickupTime',
        new Date(),null,null,callback);
    },function(result,callback){
        mariaDB.getOrder(req.body.orderId,callback);
    },function(result,callback){
      order = result;
        mariaDB.getPushId(order.userId,callback);
    },function(userInfo,callback){
      console.log("shopUserInfo:"+userInfo);
       userInfo.SMSNoti="off"
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

router.notifyOrder=function(req,res){
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
   let order={};
    async.waterfall([function(callback){
      // Please check if req.session.uid is a member or manager of shop
        mariaDB.getShopUserInfoWithEmail(req.session.uid,callback); //shop의 member인지 체크
    },function(result,callback){
        mariaDB.getOrder(req.body.orderId,callback);
    },function(result,callback){
      order = result;
        mariaDB.getPushId(order.userId,callback);
    },function(userInfo,callback){
      console.log("shopUserInfo:"+userInfo);
      userInfo.SMSNoti="off";
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

router.completeOrderWithEmail=function(req,res){//previous status must be "checked".
   //1. order정보 가져옴
   //2. shopUser인지 확인
   //3. orderStatus update
   //4. send a massege

   //check shop member
   console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));

   let order={};

   async.waterfall([function(callback){
      // Please check if req.session.uid is a member or manager of shop
      mariaDB.getShopUserInfoWithEmail(req.session.uid,callback);
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
            mariaDB.updateSalesShop(order.takitId,order.total,callback);
        },function(callback){
        mariaDB.getPushId(order.userId,callback);
        }],callback);
   },function(result,callback){
        let userInfo = result[1];
        userInfo.SMSNoti="on";
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
            //현금영수증을 발행한다.
            mariaDB.getShopInfo(order.takitId,function(err,shopInfo){
                if(err){
                    console.log("fail to getShopInfo:"+JSON.stringify(err));
                    console.log("fail to issue cashBill");
                }else{ 
                    mariaDB.getUserInfo(order.userId,function(err,userInfo){
                        console.log("check-registIssue: order.receiptType:"+order.receiptType);
                        console.log("order.receiptId:"+order.receiptId);
                        console.log("shopInfo.businessNumber:"+shopInfo.businessNumber);
                        if(order.receiptType==null || order.receiptId==null ||shopInfo.businessNumber==null) //발급하지 않음.
                            return;
                        let issueInfo={corpNum:shopInfo.businessNumber,
                            takitId:order.takitId,
                            address:shopInfo.address,
                            owner:shopInfo.owner,
                            userId:order.userId,
                            userName:order.userName,
                            receiptId:order.receiptId,
                            total:order.amount, // 배달비 제외한 금액
                            email:userInfo.email,
                            receiptType:order.receiptType,
                            orderId:order.orderId,
                            orderNO:order.orderNO,
                            orderName:order.orderName};
                        cashBill.registIssue(issueInfo);  
                   });
                }
            });
      }
   });
};
// kalen.lee -end 
////////////////////////////////////////////////////////////////////////////



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
       console.log("cancel order :"+order.total);
       async.parallel([function(callback){
          cash.cancelCash(req.body.cashId,req.body.orderId,parseInt(order.total),callback); //cash로 다시 돌려줌
       },function(callback){
          mariaDB.updateSalesShop(order.takitId,0,callback);
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


router.cancelOrderUserCart=function(req,res){
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
       console.log("cancel order :"+order.total);
       if(order.payMethod=='cash'){
         async.parallel([function(callback){
          cash.cancelCash(req.body.cashId,req.body.orderId,parseInt(order.total),callback); //cash로 다시 돌려줌
         },function(callback){
          mariaDB.updateSalesShop(order.takitId,0,callback);
         },function(callback){
          mariaDB.getShopPushIdWithEmail(order.takitId,callback);
         }],callback);
       }else{
         async.parallel([function(callback){
           card.cancelCard(order.imp_uid,callback);  // cancel이 안될경우 어떻게해야 할까? 문제상황을 저장해야만 한다. How? 
         },function(callback){ 
           mariaDB.updateCardSalesShop(order.takitId,-parseInt(order.total),callback);
         },function(callback){
           mariaDB.getShopPushIdWithEmail(order.takitId,callback);
         }],callback);
       }
    },function(result,callback){
       //shop한테 noti 보내줌
       sendOrderMSGShop(order,result[2],callback);
    }],function(err,result){
       if(err){
          console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            response.reason=err;
            res.send(JSON.stringify(response));
       }else{
          console.log(result);
            let response = new index.SuccResponse();
            response.order=order;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
         }
    });
}

////////////////////////////////////////////////////////////////////////////////
// kalen.lee -begin
//shop취소, 카드 취소, 캐쉬 취소 
router.shopCancelOrderWithEmail=function(req,res){
   //1. order정보 가져옴
   //2. shopUser인지 확인
   //3. orderStatus update
   //4. send a massege

   //check shop member
   console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));

   let order={};

   async.waterfall([function(callback){
      mariaDB.getShopUserInfoWithEmail(req.session.uid,callback);
   },function(result,callback){
      mariaDB.updateOrderStatus(req.body.orderId,'','cancelled','cancelledTime',
      new Date(),req.body.cancelReason,"Asia/Seoul" ,callback);
   },function(result,callback){
      mariaDB.getOrder(req.body.orderId,callback);
   },function(result,callback){
      order = result;
      if(order.payMethod=="cash"){
          mariaDB.getCashId(order.userId,callback);
       }else if(order.payMethod=="card"){ 
          callback(null,order.imp_uid); 
       }else{
          callback("invalid payMethod");
       }
   },function(cashId,callback){
      console.log("cancel order :"+JSON.stringify(order));
      async.parallel([function(callback){
         if(order.payMethod=="cash"){
             cash.cancelCash(cashId,req.body.orderId,parseInt(order.total),callback); //cash로 다시 돌려줌
         }else if(order.payMethod=="card"){
             card.cancelCard(order.imp_uid,callback); // 카드 승인취소 
         }else{
             callback("invalid payMethod");
         }
      },function(callback){
         if(order.payMethod=="cash"){
             if(order.completedTime==null)
                 mariaDB.updateSalesShop(order.takitId,0,callback);
             else
                 mariaDB.updateSalesShop(order.takitId,-parseInt(order.total),callback);
         }else if(order.payMethod=="card"){
             mariaDB.updateCardSalesShop(order.takitId,-parseInt(order.total),callback);
         }else{
             callback("invalid payMethod");
         }
      },function(callback){
         mariaDB.getPushId(order.userId,callback);
      }],callback);
      
   },function(result,callback){
      //shop한테 noti 보내줌. user한테 보내줌?
      result[2].SMSNoti="on";
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
            console.log("!!! check cashBill!!!  "+order.cashBillKey);
            if(order.cashBillKey!=null){
                mariaDB.getShopInfo(order.takitId,function(err,shopInfo){
                    let info={corpNum:shopInfo.businessNumber, cashBillKey:order.cashBillKey, orderId:order.orderId};
                    console.log("call cashBill.cancelIssue");
                    cashBill.cancelIssue(info);
                });
            }
      }
   });
};

/////////////////////////////////////////////////////////////////////////////
// 고객 Review저장
router.inputReview=function(req,res){
   console.log("req.body:"+JSON.stringify(req.body));
   let takitId=req.body.takitId;
   let starRate=req.body.fiveStar;
   console.log("takitId:"+takitId+" starRate:"+starRate);

   async.waterfall([function(callback){
      mariaDB.saveReview(req.body.orderId,starRate,req.body.review,callback);
   },function(result,callback){
      mariaDB.updateShopRating(takitId,starRate,callback);
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



router.getFavoriteMenu=function(req,res){
    console.log("userId:"+req.session.uid);
    mariaDB.getFavoriteMenu(req.session.uid,function(err,result){
        console.log("!!!!getFavoriteMenu:"+JSON.stringify(result));
        if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            console.log("getFavoriteMenu:"+JSON.stringify(result));
            response.menus=result;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
};

// kalen.lee -end
////////////////////////////////////////////////////////////////////////////////
router.configureSoldOut=function(req,res){
    console.log("userId:"+req.session.uid);
    mariaDB.configureMenuSoldOut(req.body,function(err,result){
        if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.soldout=result;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}


router.getOldOrders=(req,res)=>{
    console.log("order.getOldOrders");
    mariaDB.selectOldOrders({userId:req.session.uid,
                             takitId:req.body.takitId},(err,oldOrders)=>{
        if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
      }else {
			let response = new index.SuccResponse();
			response.setVersion(config.MIGRATION,req.version);
            response.oldOrders=oldOrders;
            res.send(JSON.stringify(response));
      }
    });
}

router.pollRecentOrder =function(req,res){
    console.log("order.pollRecentOrder");

    mariaDB.pollRecentOrder(req.body.orderNO,req.body.takitId,req.body.time,function(err,more){
       if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
      }else {
            if(more){
                let response = new index.SuccResponse();
                response.setVersion(config.MIGRATION,req.version);
                response.more=more;
                res.send(JSON.stringify(response));
            }else{
                mariaDB.pollRecentOrder(req.body.orderNO,req.body.takitId,req.body.time,function(err,more){
                   if(err){
                       console.log(err);
                       let response = new index.FailResponse(err);
                       response.setVersion(config.MIGRATION,req.version);
                       res.send(JSON.stringify(response));
                   }else {
                       let response = new index.SuccResponse();
                       response.setVersion(config.MIGRATION,req.version);
                       response.more=more;
                       res.send(JSON.stringify(response));
                   }
                });
           }
      }
    })
}

module.exports = router;
