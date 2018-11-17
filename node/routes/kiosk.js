let express = require('express');
let request = require('request');
let gcm = require('node-gcm');
let timezoneJS = require('timezone-js');
let async = require('async');
let crypto = require('crypto');
let mariaDB = require('./mariaDB');
let noti = require('./notification');
let config = require('../config');
let index = require('./index');
let op = require('./op');
let socket = require('./socket');
let cashBill =require('./cashBill');
let kakao =require('./kakao');

let router = express.Router();

//decrypt decrepted data

function decryption(secretData, pwd) {
    var decipher = crypto.createDecipher('aes256', pwd);
    var data = decipher.update(secretData, 'hex', 'utf8');
    data += decipher.final('utf8');

    return data;
}

router.pollKioskRecentOrder=function(req,res){
    let now = new Date();
    console.log("pollKioskRecentOrder "+now.toLocaleTimeString()+ " "+ req.body.takitId);

    mariaDB.pollKioskRecentOrder(req.body.orderNO,req.body.takitId,req.body.time,function(err,more){
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

router.getOrdersShop=function(req,res){
   console.log("getOrders:"+JSON.stringify(req.body));
    //뭔가 오류가 있다. 분석이 필요함 ㅜㅜ 
    if(req.body.option === "period"){
        mariaDB.getKioskPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,
                                    req.body.lastOrderId,req.body.limit,
                                    function(err,kiosk){
                         if(kiosk && kiosk.length==req.body.limit){
                             let startTime=kiosk[kiosk.length-1].orderedTime;
                             mariaDB.getOrdersShopWithStartTimeLimit(req.body.takitId,startTime,
                                    req.body.lastOrderId,req.body.limit,
                                    function(err,orders){
                                         if(err=="not exist orders")
                                             responseOrders(null,kiosk,orders,req,res);
                                         else
                                             responseOrders(err,kiosk,orders,req,res);
                             });
                         }else{
                           mariaDB.getPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,
                              req.body.lastOrderId,req.body.limit,
                              function(err,orders){
                                  if(err=="not exist orders")
                                      responseOrders(null,kiosk,orders,req,res);
                                  else
                                      responseOrders(err,kiosk,orders,req,res);
                              });
                         }
        });
    }else{
                console.log("call getKioskOrdersShop!!!");
                mariaDB.getKioskOrdersShop(req.body.takitId,req.body.option,req.body.lastKioskOrderId,req.body.limit,
                      function(err,kioskOrders){
                         console.log("kioskOrders:"+JSON.stringify(kioskOrders));
                         if(!err && Array.isArray(kioskOrders) && kioskOrders.length==req.body.limit){
                             let startTime=kioskOrders[kioskOrders.length-1].orderedTime;
                             mariaDB.getOrdersShopWithStartTimeLimit(req.body.takitId,startTime,
                                    req.body.lastOrderId,req.body.limit,
                                    function(err,orders){
                                         if(err=="not exist orders")
                                             responseOrders(null,kioskOrders,orders,req,res);
                                         else
                                             responseOrders(err,kioskOrders,orders,req,res); 
                             });
                         }else{
                           mariaDB.getOrdersShop(req.body.takitId,req.body.option,
                              req.body.lastOrderId,req.body.limit,
                              function(err,orders){
                                  if(err=="not exist orders")
                                      responseOrders(null,kioskOrders,orders,req,res); 
                                  else
                                      responseOrders(err,kioskOrders,orders,req,res); 
                              });
                      }
        });
    }
};  

responseOrders=function(err,kiosk,waitee,req,res){

    if(kiosk)
    kiosk.forEach((order)=>{
       console.log("kiosk order.orderNO:"+order.orderNO+"order.orderId:"+order.orderId);
    });
    if(waitee)
    waitee.forEach((order)=>{
       console.log("waitee order.orderNO:"+order.orderNO+"order.orderId:"+order.orderId);
    });

    if(err){
       console.log(err);
       let response = new index.FailResponse(err);
       response.setVersion(config.MIGRATION,req.version);
       res.send(JSON.stringify(response));
    }else{
       let response = new index.SuccResponse();
       response.setVersion(config.MIGRATION,req.version);
       let orders=[];
       if(Array.isArray(kiosk)){
           kiosk.forEach(order=>{
               order.type='kiosk';
           });
       }
       if(Array.isArray(kiosk) && Array.isArray(waitee)){
           orders=kiosk.concat(waitee);
           orders.sort(function(a,b){
                    if (a.orderedTime<b.orderedTime){
                            return 1;
                    }
                    if (a.orderedTime>b.orderedTime){
                            return -1;
                    }
                    return 0;
           });
       }else if(Array.isArray(kiosk)){
           orders=kiosk;
       }else if(Array.isArray(waitee)){
           orders=waitee;
       }

       orders.forEach((order)=>{
           console.log("response order.orderNO:"+order.orderNO+"order.orderId:"+order.orderId);
       });

       response.orders=orders;
       res.send(JSON.stringify(response));
    }
}

router.checkSoldOut=function(req,res){
      let menus=[];
      console.log("checkSoldOut:"+JSON.stringify(req.body));
	  let orderList=[];
      if(typeof req.body.orderList === 'object'){
          orderList=req.body.orderList;
      }else if(typeof req.body.orderList === 'string'){
          orderList=JSON.parse(req.body.orderList);  
      }
      orderList.forEach(menu=>{
           let menuInfo={menuNO:menu.menuNO,menuName:menu.menuName,options:menu.options,unitPrice:menu.unitPrice};
           console.log("orderList:"+menu.options+ menu.unitPrice);
           menus.push(menuInfo);
      });
      console.log("menus:"+JSON.stringify(menus));
      mariaDB.checkIfMenuSoldOut(menus,function(err,sale){
          console.log("kiosk-checkSoldOut err:"+JSON.stringify(err));
          if(err=="soldout" || err==null){
                  let response = new index.SuccResponse();
                  if(err=="soldout"){
                      response.soldout=true;
                      response.menu=sale; // soldout일 경우 menuName이 return됨. 
                  }else
                      response.soldout=false;
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
          }else{
                  console.log("error happens,"+err);
                  let response = new index.FailResponse(err);
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
          }
      });
}

router.checkSoldOutEn=function(req,res){
      let menus=[];
      console.log("checkSoldOutEn:"+JSON.stringify(req.body));
      let orderList=[];
      if(typeof req.body.orderList === 'object'){
          orderList=req.body.orderList;
      }else if(typeof req.body.orderList === 'string'){
          orderList=JSON.parse(req.body.orderList);
      }
      orderList.forEach(menu=>{
           let menuInfo={menuNO:menu.menuNO,menuName:menu.menuName,options:menu.options,unitPrice:menu.unitPrice,optionsEn:menu.optionsEn};
           console.log("orderList:"+menu.options+ menu.unitPrice);
           menus.push(menuInfo);
      });
      console.log("menus:"+JSON.stringify(menus));
      mariaDB.checkIfMenuSoldOutEn(menus,function(err,sale){
          console.log("kiosk-checkSoldOut err:"+JSON.stringify(err));
          if(err=="soldout" || err==null){
                  let response = new index.SuccResponse();
                  if(err=="soldout"){
                      response.soldout=true;
                      response.menu=sale; // soldout일 경우 menuName이 return됨.
                  }else
                      response.soldout=false;
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
          }else{
                  console.log("error happens,"+err);
                  let response = new index.FailResponse(err);
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
          }
      });
}


router.searchOrderWithCardInfo=function(req,res){ //카드 승인번호와 날짜,catid로 주문정보를 가져온다. 
   console.log("searchOrderWithCardInfo:"+JSON.stringify(req.body));
   mariaDB.searchOrderWithCardInfo(req.body,function(err,order){
       if(err){
                  console.log("error happens,"+err);
                  let response = new index.FailResponse(err);
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
       }else{
                  let response = new index.SuccResponse();
                  response.setVersion(config.MIGRATION,req.version);
                  console.log("[searchOrder]"+JSON.stringify(order));
                  if(order)
                      response.order = order;
                  res.send(JSON.stringify(response));
       }
   });
}

router.searchOrder=function(req,res){
   console.log("kiosk searcOrder:"+JSON.stringify(req.body));
   mariaDB.searchKioskOrder(req.body,function(err,order){
       if(err){
                  console.log("error happens,"+err);
                  let response = new index.FailResponse(err);
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
       }else{
                  let response = new index.SuccResponse();
                  response.setVersion(config.MIGRATION,req.version);
                  console.log("[searchOrder]"+JSON.stringify(order));
                  if(order)
                      response.order = order;
                  res.send(JSON.stringify(response));
       }
   });
}

router.saveOrder=function(req, res){
   let order=req.body;
   let shopInfo;

   if(typeof req.body.orderList === 'object'){
       order.orderList=req.body.orderList;
   }else if(typeof req.body.orderList === 'string'){
       order.orderList=JSON.parse(req.body.orderList);
   }
  // hum...check the validity of req.body
   console.log("KIOSK-!!!saveOrder!!!!" + JSON.stringify(order));
   async.waterfall([function(callback){
       //check sold-out
      let menus=[];
      order.orderList.forEach(menu=>{
           let menuInfo={menuNO:menu.menuNO,menuName:menu.menuName,options:menu.options,unitPrice:menu.unitPrice,optionsEn:menu.optionsEn};
           menus.push(menuInfo);
      });
      //console.log("menus:"+JSON.stringify(menus));
      console.log("english:"+req.body.english);
      //let english=req.body.english;
      //console.log(typeof english);
      if(req.body.english=="true"){
          console.log("checkIfMenuSoldOutEn");
          mariaDB.checkIfMenuSoldOutEn(menus,callback);
      }else{
          console.log("checkIfMenuSoldOut");
          mariaDB.checkIfMenuSoldOut(menus,callback);
      }
   },function(soldout,callback){
      mariaDB.getShopInfo(order.takitId,callback);
   },function(shopInfo,callback){
      shopInfo=shopInfo;
      mariaDB.getOrderNumber(shopInfo,callback);
   },function(orderNO,callback){
      order.orderNO=orderNO;
      if(order.paymentType=="card"){
          order.receiptIssue=null;
          order.receiptType=null
          order.receiptId=null; 
      }else if(order.paymentType=="cash")
          order.cardPaymet=null;     
      mariaDB.saveKioskOrder(order,callback);
   },function(orderId,callback){
      
      order.orderId=orderId;
      mariaDB.searchKioskOrderWithId(orderId,callback);
   }],(err,result)=>{
               if(err){
                  console.log("error happens,"+err);
                  let response = new index.FailResponse(err);
                  response.setVersion(config.MIGRATION,req.version);
                  res.send(JSON.stringify(response));
              }else{
                  console.log("orderNO:"+order.orderNO);
                  let response = new index.SuccResponse();
                  response.setVersion(config.MIGRATION,req.version);
                  response.orderNO = order.orderNO;
                  response.order=order;
                  res.send(JSON.stringify(response));
                  console.log("!!!KIOSK-saveOrder-done:"+JSON.stringify(result));
                  sendOrderMsgShop(result); // web server를 통해 직접 태블릿으로 전달함으로 굳이 오류 확인을 할필요는 없다. 반드시 takitShop에 해당 기능을 추가한다. 
              }
   });
}

sendOrderMsgShop=function(order){
   mariaDB.getShopPushIdWithEmail(order.takitId,function(err,shopUserInfo){
       order.type="kiosk";
       const GCM = {};
       GCM.title = updateOrderStatus(order);
       GCM.content = "주문번호 "+order.orderNO+" 주문내역:"+order.orderName;

       GCM.GCMType = "order";
       GCM.custom = JSON.stringify(order);

       let sound = "takit";
       console.log("shopUserInfo:"+JSON.stringify(shopUserInfo));

       noti.sendGCM(config.SHOP_SERVER_API_KEY,GCM,[shopUserInfo.shopPushId], shopUserInfo.platform,sound,function(err,result){
           
       });

       //GCM이 전달안될경우 전달되도록함. 중복전달될수 있음으로 1초 이후에 보낸다. Poll과 함께 사용함.
       setTimeout(function(){ console.log("send again with socket"); socket.notifySocket(order); }, 1000);
   });
}

function updateOrderStatus(order){
    let title;

    console.log("takeout:"+order.takeout);
   
     switch (order.orderStatus){
            case 'paid' :
                title='[키오스크] 주문 '+order.orderName; break;
            case 'checked' :
                title='[키오스크] 주문접수 '+order.orderName; break;
            case 'completed' :
                title='[키오스크] 주문준비완료 '+order.orderName; break;
            case 'cancelled' :
                title='[키오스크] 주문취소 '+order.orderName; break;
            case 'pickup':
                title='[키오스크]주문전달완료 '+order.orderName;break;
            default :
                title = '[키오스크]';
        }
   return title;
}

router.checkOrder=function(req,res){ // previous status must be "paid".
	console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
    //주문상태 update
	mariaDB.updateKioskOrderStatus(req.body.orderId,'paid','checked','checkedTime',
		new Date(),req.body.cancelReason,function(err,data){
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

router.paidAndCheckOrder=function(req,res){
    //이전상태는 반드시 unpaid여야만 한다. 확인이 필요함.
    //order의 상태를 checked로 변경한다. 현금영수증은 complete일때 발행한다. 
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
    //0.상태변경
    //1.주문서 발송이 필요할 경우 주문서를 발송한다.
    //2.orderList추가가 필요하다.
    let msgSentFail; 
    let phone,order,shop;
    console.log("sendOrderInfoWithWaitee:"+JSON.stringify(req.body));
    async.waterfall([function(callback){
        mariaDB.updateKioskOrderStatus(req.body.orderId,'unpaid','checked','checkedTime',
            new Date(),req.body.cancelReason,callback);
    },function(result,callback){
            mariaDB.searchKioskOrderWithId(req.body.orderId,callback);
    },function(orderInfo,callback){
        order=orderInfo;
        if(order.notiPhone!=null){
            mariaDB.getShopInfo(order.takitId,callback);
        }else{
            callback(null,null);
        }
    },function(shop,callback){
        shopInfo=shop;
        //kakao api호출
        if(order.notiPhone!=null){
            console.log("order.notiPhone:"+order.notiPhone);
            let notiPhone= decryption(order.notiPhone, config.pPwd);  
            kakao.sendCashOrderMsg(order,shopInfo,notiPhone,callback);
        }else
            callback(null,null);
    },function(result,callback){ //add orderList
         if(result=="kakao msg failed"){
             //just let shop owner know about it. but it is not failure.
             msgSentFail=true; 
         }
         let i=0;
         let orderList=JSON.parse(order.orderList);
         mariaDB.kioskInsertOrderList(order.takitId,order.orderId,i,orderList,callback);
    }],function(err,result){
        if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            if(msgSentFail){
                response.msgSentFail=true;
            }
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

issueCashBill=function(req){
    let order={};
    let shop={};
    //1.order 정보를 가져온다. 
    //2.shop 정보를 가져온다.
    //3.영수증을 발급한다. 
    async.waterfall([function(callback){
        mariaDB.searchKioskOrderWithId(req.body.orderId,callback);
    },function(orderInfo,callback){
        order=orderInfo;
        if(!order){
            callback("invalidOrderId");
        }else if(order.receiptType==null || order.receiptId==null){ //발급하지 않음.
            callback(null,null);
        }else{
            order=orderInfo;
            mariaDB.getShopInfo(order.takitId,callback);
       }
    }],function(err,shopInfo){
         if(shopInfo==null){ //do not issue cashBill
             console.log("do not issue cashBill");
         }else{  
            shop=shopInfo;
            let issueInfo={corpNum:shop.businessNumber,
                            takitId:order.takitId,
                            address:shop.address,
                            owner:shop.owner,
                            receiptId:order.receiptId,
                            total:order.amount,   // 배달비 제외한 금액
                            receiptType:order.receiptType,
                            orderId:order.orderId,
                            orderNO:order.orderNO,
                            orderName:order.orderName,
                            kiosk:true};
                        cashBill.registIssue(issueInfo);  
         }
    });
}

router.completeOrder=function(req,res){ // previous status must be "paid".
    console.log("req.body:"+JSON.stringify(req.body));
    //주문상태 update
    mariaDB.updateKioskOrderStatus(req.body.orderId,'checked','completed','completedTime',
        new Date(),req.body.cancelReason,function(err,data){
        if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }else{
            //현금거래의 경우 현금영수증을 발행한다.
            if(req.body.payment=="cash"){
                 issueCashBill(req);
            } 
            let response = new index.SuccResponse();
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
        }
    });
}

router.pickupOrder=function(req,res){ 
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
    //주문상태 update
    mariaDB.updateKioskOrderStatus(req.body.orderId,'completed','pickup','pickupTime',
        new Date(),req.body.cancelReason,function(err,data){
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

router.cancelOrder=function(req,res){  
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
    let order={};
    let shop={};

    // 1.주문상태 update (orderList에서 삭제한다)
    // 2.현금일경우 현금영수증 발급을 취소하고 현금환불을 안내한다. 상점주앱에 환불완료 상태가 있어야 한다. refund를 추가하자. 
    // 3.카드일경우 고객에게 카드 취소를 요청 한다.  
    async.waterfall([(callback)=>{
        mariaDB.updateKioskOrderStatus(req.body.orderId,null,'cancelled','cancelledTime',
        new Date(),req.body.cancelReason,callback);
    },function(result,callback){
       mariaDB.searchKioskOrderWithId(req.body.orderId,callback);  
    },function(orderInfo,callback){
       order=orderInfo;
       if(order.paymentType=="cash"){ //notify user
           callback(null,"success");
           //cancel cashBill issue. 나중에 바꾸자. 현금영수증 발급여부도 확인하도록. 업주에게는 중요할수 있다. 
           let info={corpNum:shop.businessNumber,cashBillKey:order.cashBillKey, orderId:order.orderId,kiosk:true};
           console.log("call cashBill.cancelIssue");
           cashBill.cancelIssue(info);
       }else{ //notify user
           callback(null,"success");
       }
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
                response.sales=result[0];
                response.stats=result[1];
                res.send(JSON.stringify(response));
            }
        }

        console.log(req.body);
        if(req.body.option === "period"){
            async.parallel([function(callback){
                mariaDB.getKioskSalesPeriod(req.body.takitId, req.body.startTime, req.body.endTime, callback);
            },function(callback){
                mariaDB.getKioskPeriodStatsMenu(req.body.takitId,req.body.startTime,req.body.endTime,callback);
            }],finalCallback);
        }else{
            async.waterfall([function(callback){
                mariaDB.getShopInfo(req.body.takitId,callback);
            },function(shopInfo,callback){
                let startTime = mariaDB.getLocalTimeWithOption(req.body.option,shopInfo.timezone);

                async.parallel([function(callback){
                    mariaDB.getKioskSales(req.body.takitId,startTime,callback);
                },function(callback){
                    mariaDB.getKioskStatsMenu(req.body.takitId,startTime,callback);
                }],callback);
            }],finalCallback);
        }
}

router.sendOrderWithPhone=function(req,res){
    console.log("sendOrderWithPhone body:"+JSON.stringify(req.body));
    //주문 전달     
    let order={};
    let shopInfo={};

    async.waterfall([function(callback){
        mariaDB.searchKioskOrderWithId(req.body.orderId,callback);
    },function(orderInfo,callback){
        if(!order){
            callback("invalidOrderId");
        }else{
            order=orderInfo;
            if(order.paymentType=="card")
                mariaDB.getShopInfo(order.takitId,callback);
            else // cash
                callback(null,null);
        }
    },function(shop,callback){
        //kakao api호출
     shopInfo=shop;
     if(order.paymentType=="card")
         kakao.sendCardOrderMsg(order,shopInfo,req.body.phone,callback);
     else{
         callback(null,null);
     }
    },function(result,callback){ //update notiPhone kiosk 
         mariaDB.saveKioskNotiPhone(req.body.phone,req.body.orderId,callback);
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

//lock함수가 필요하다 ㅜㅜ. 앞에 뭘붙이지? kioskNoti+phone 
router.registerPhone=function(req,res){
    async.waterfall([function(callback){
        mariaDB.checkRegisterNotiPhone(req.body.phone,callback);
    },function(registeredInfo,callback){
        console.log("registeredInfo:"+registeredInfo);
        if(registeredInfo==null){
            mariaDB.registerNotiPhone(req.body.phone,callback);
        }else{
            callback("alreadyRegistered:"+registeredInfo.waiteeNumber);
        }
    }],function(err,result){
      if(err){
            console.log(err);
            let response = new index.FailResponse(err);
            response.setVersion(config.MIGRATION,req.version);
            if(err=="alreadyRegistered"){
                response.waiteeNumber=result;
            }
            res.send(JSON.stringify(response));
        }else{
            let response = new index.SuccResponse();
            response.digitsMask=result.waiteeNumber;
            response.digitsNumber=result.waiteeNumber.length;
            response.setVersion(config.MIGRATION,req.version);
            res.send(JSON.stringify(response));
            //사용자에게 전달한다. req.body.phone,result.waiteeNumber,result.waiteeNumber.length  
            kakao.sendWaiteeNumber(req.body.phone,result.waiteeNumber,result.waiteeNumber.length,req.body.english);
        } 
    });
}

router.sendOrderInfoWithWaitee=function(req,res){
    //1. 등록번호를 찾음
    //2. 등록번호로 주문 전달 , 현금일경우 주문전달 번호만 저장한다.
    //3. order정보에 전화번호 암호화해서 저장함=>  향후 사용처는?
    //주문 전달
    let phone,order,shop;
    console.log("sendOrderInfoWithWaitee:"+JSON.stringify(req.body));
    async.waterfall([function(callback){
        mariaDB.searchWaiteeNumber(req.body.waiteeNumber,callback);
    },function(phoneNumber,callback){
        if(phoneNumber==null){
            callback("waiteeNumberInvald");
        }else{
            phone=phoneNumber;
            mariaDB.searchKioskOrderWithId(req.body.orderId,callback);
        }
    },function(orderInfo,callback){
        order=orderInfo;
        if(order.paymentType=="card"){
            mariaDB.getShopInfo(order.takitId,callback);
        }else{
            callback(null,null);
        }
    },function(shop,callback){
        shopInfo=shop;
        //kakao api호출
     if(order.paymentType=="card")
         kakao.sendCardOrderMsg(order,shopInfo,phone,callback);
     else{
         callback(null,"cash");
      }
    },function(result,callback){ //update notiPhone kiosk
         mariaDB.saveKioskNotiPhone(phone,req.body.orderId,callback);
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


module.exports = router;

/*
//cancel card payment
  /kiosk/cancelCardPayment
//cash receipt
  /kiosk/issueCashBill
//cancel cash receipt
  /kiosk/cancelCashBill
//print out cancel receipt
*/
