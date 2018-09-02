let express = require('express');
let request = require('request');
let gcm = require('node-gcm');
let timezoneJS = require('timezone-js');
let async = require('async');

let mariaDB = require('./mariaDB');
let noti = require('./notification');
let config = require('../config');
let index = require('./index');
let op = require('./op');
let socket = require('./socket');
let cashBill =require('./cashBill');
let router = express.Router();

router.pollKioskRecentOrder=function(req,res){
    mariaDB.pollKioskRecentOrder(req.orderNO,req.takitId,req.time,function(err,more){
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
                         if(kioskOrders.length==limit){
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
                           mariaDB.getPeriodOrdersShop(req.body.takitId,req.body.startTime,req.body.endTime,
                              req.body.lastOrderId,req.body.limit,
                              function(err,orders){
                                  if(err=="not exist orders")
                                      responseOrders(null,kioskOrders,orders,req,res);
                                  else
                                      responseOrders(err,kioskOrders,orders,req,res);
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
          console.log("err:"+JSON.stringify(err));
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
           let menuInfo={menuNO:menu.menuNO,menuName:menu.menuName,options:menu.options,unitPrice:menu.unitPrice};
           menus.push(menuInfo);
      });
      console.log("menus:"+JSON.stringify(menus));
      mariaDB.checkIfMenuSoldOut(menus,callback);
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
                  res.send(JSON.stringify(response));
                  //sendOrderMsgShop(order); // web server를 통해 직접 태블릿으로 전달함으로 굳이 오류 확인을 할필요는 없다. 반드시 takitShop에 해당 기능을 추가한다. 

                  console.log("!!!order:"+JSON.stringify(result));

                  sendOrderMsgShop(result); // web server를 통해 직접 태블릿으로 전달함으로 굳이 오류 확인을 할필요는 없다. 반드시 takitShop에 해당 기능을 추가한다. 
                  let data={};
                  data.receivers=[req.body.notiPhone];
                  data.subject=req.body.shopName+" 주문번호:"+order.orderNO+"\n"; 
                  data.content=order.orderName+"\n";
                  req.body.orderList.forEach(menu=>{
                      data.content+=menu.menuName+" "+menu.quantity+"개\n";
                      menu.options.forEach((option)=>{
                          data.content+=option.name+"x"+option.number;
                          if(option.select!==undefined)
                              data.content+=" "+option.select+"\n";
                          data.content+="+"+option.price*option.number+"\n";
                      }); 
                  });
                      data.content+=req.body.address+"\n";
                      data.content+="사업자번호:"+req.body.businessNumber+"\n";

                      let surtax=Math.round(order.amount/11);
                      let amount=order.amount-surtax;

                      data.content+="순매출:"+amount+"\n";
                      data.content+="부가세:"+surtax+"\n";
                      data.content+="매출합계:"+order.amount+"\n";

                      data.content+="결제금액:"+order.amount+"\n";
                      data.content+="카드번호:"+req.body.cardNO+"\n";
                      data.content+=req.body.cardName+"\n";
                      data.content+="승인번호:"+req.body.approvalNO+"\n";
                  console.log("sendLMS:"+JSON.stringify(data));
                  noti.sendLMS(data); // 문자전송에 실패하였을 경우 고객들에게 어떻게 알려줄까? 일단 카카오로 바꾼이후에 처리하자.  
              }
   });
}

sendOrderMsgShop=function(order){
   mariaDB.getShopPushIdWithEmail(order.takitId,function(err,shopUserInfo){
       const GCM = {};
       GCM.title = updateOrderStatus(order);
       GCM.content = "주문번호 "+order.orderNO+" 주문내역:"+order.orderName;

       GCM.GCMType = "order";
       GCM.custom = JSON.stringify(order);

       let sound = "takit";
       console.log("shopUserInfo:"+JSON.stringify(shopUserInfo));

       noti.sendGCM(config.SHOP_SERVER_API_KEY,GCM,[shopUserInfo.shopPushId], shopUserInfo.platform,sound,function(err,result){

       });
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

router.completeOrder=function(req,res){ // previous status must be "paid".
    console.log("req.body.orderId:"+JSON.stringify(req.body.orderId));
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
    //주문상태 update
    mariaDB.updateKioskOrderStatus(req.body.orderId,null,'cancelled','cancelledTime',
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
                mariaDB.getPeriodStatsMenu(req.body.takitId,req.body.startTime,req.body.endTime,callback);
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
