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
           let menuInfo={menuNO:menu.menuNO,menuName:menu.menuName};
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
           let menuInfo={menuNO:menu.menuNO,menuName:menu.menuName};
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
                  sendOrderMsgShop(order);
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

module.exports = router;

/*
//check order 
  /kiosk/checkOrder
//complete order
  /kiosk/completeOrder
//cancel order
  /kiosk/cancelOrder
//cancel card payment
  /kiosk/cancelCardPayment
//cash receipt
  /kiosk/issueCashBill
//cancel cash receipt
  /kiosk/cancelCashBill
//print out cancel receipt
*/
