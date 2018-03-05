let express = require('express');
let router = express.Router();
let https = require("https");
let async = require('async');
const index = require('./index');
const config = require('../config');
const mariaDB = require('./mariaDB');

function getAccessToken(next){
    console.log("getAccessToken");
    var body=JSON.stringify({imp_key:config.imp_key, imp_secret:config.imp_secret});
    var options = {
       host: 'api.iamport.kr',
       port: 443,
       path:'/users/getToken',
       headers: {
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
            let response=JSON.parse(body);
            console.log("reponse:"+JSON.stringify(response));
      		let accessToken=response.response.access_token;
            next(null,accessToken);
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

function getCardInfo(token,customer_uid,next){
   //https://api.iamport.kr/subscribe/customers/customer_1234?_token=a7f4660b638db5a39b337cb14df014f3e4c89390 

    var options = {
      host: 'api.iamport.kr',
      port: 443,
      path: '/subscribe/customers/'+customer_uid+'?_token='+token,
      method: 'GET'
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
            next(null,body);

        }else{
            console.log(body);
            next(body);
        }
      });
    });
    req.end();
    req.on('error', function(e) {
        console.error(e);
        next(e);
    });
}

function cancelPayment(imp_uid,accessToken, next){
    console.log("getAccessToken");
    var body=JSON.stringify({imp_uid:imp_uid});
    var options = {
       host: 'api.iamport.kr',
       port: 443,
       path:'/payments/cancel',
       headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': accessToken
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
            next(null,body);

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

function requestPayment(accessToken,customer_uid,order,next){
     //order={amount:3300, name:"주문", vat: amount*0.1}  
     var merchant_uid=customer_uid+'_'+new Date().getTime();
     var body=JSON.stringify({customer_uid:customer_uid, 
                  merchant_uid:merchant_uid, 
                  amount:order.amount,
                  name:order.name,
                  vat:order.vat
              });
    var options = {
       host: 'api.iamport.kr',
       port: 443,
       path:'/subscribe/payments/again',
       headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': accessToken
      },
      method: 'POST'
    };
    console.log("accessToken:"+accessToken);
    var req = https.request(options, function(res) {
      console.log(res.statusCode);
      var body = "";
      res.on('data', function(d) {
        body += d;
      });
      res.on('end', function(d) {
        if(res.statusCode==200){
            console.log(JSON.parse(body));
            next(null,body);

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

router.addPayInfo=function(req,res){
    console.log("registerCard:"+req.body.customer_uid+"imp_id:"+req.body.imp_uid);
    let accessToken;
    let resCard;

    async.waterfall([function(callback){
         getAccessToken(callback);
    },function(result,callback){
         accessToken=result;
         getCardInfo(accessToken,req.body.customer_uid,callback);
    },function(result,callback){
         resCard=result;
         var cardInfo=JSON.parse(resCard);
         console.log(cardInfo.response.card_name+' '+cardInfo.response.card_number);
         let info={customer_uid:req.body.customer_uid,name:cardInfo.response.card_name,mask_no:cardInfo.response.card_number};
         mariaDB.addPayInfo(req.session.uid,info,callback);
    }],function(err,result){
         if(err!=null){
                     let response = new index.FailResponse(err);
                     response.setVersion(config.MIGRATION,req.version);
                     res.send(JSON.stringify(response));
         }else{
                     let response = new index.SuccResponse();
                     response.setVersion(config.MIGRATION,req.version);
                     response.payInfo=result;
                     res.send(JSON.stringify(response));
                     cancelPayment(req.body.imp_uid,accessToken,function(err,res){
                         console.log("cancelPayment-res:"+res);
                     });
         }
    });
}

router.removePayInfo=function(req,res){
    console.log("removeCard:"+req.body.customer_uid);
              mariaDB.removePayInfo(req.session.uid,req.body.customer_uid,function(err,result){
                 if(err!=null){
                     let response = new index.FailResponse(err);
                     response.setVersion(config.MIGRATION,req.version);
                     res.send(JSON.stringify(response));
                 }else{
                     let response = new index.SuccResponse();
                     response.setVersion(config.MIGRATION,req.version);
                     response.payInfo=result;
                     res.send(JSON.stringify(response));
                 }
              });
}

///////////////////////////////////////////////////////
// 1. userId를 가지고 고객의 customer_uid가 맞는지 확인
// 2. 카드 결제 요청
// 3. 승인번호, 카드정보 결과로 전달 
//////////////////////////////////////////////////////
router.payCard=function(userId,amount,customer_uid,orderName,next){
      let cardInfo;
      let accessToken;

      async.waterfall([function(callback){
         mariaDB.validPayInfo(userId,customer_uid,callback);
      },function(result,callback){
         cardInfo=result;
         getAccessToken(callback); 
      },function(result,callback){
         accessToken=result;
         console.log("cardInfo:"+JSON.stringify(cardInfo));
         let order={amount:amount,name:orderName,var:amount*0.1};
         requestPayment(accessToken,customer_uid,order,callback);
      }],function(err,approval){
         if(err){
            console.log(err);
            next("card failure");
         }else{
            let result;
            result=JSON.parse(approval);
            //console.log("approval.response:"+result.response.apply_num); 
            //console.log("approval:"+result.response.imp_uid); 
            console.log("payCard-cardInfo:"+ JSON.stringify(cardInfo)); 
            let response={card_info:JSON.stringify(cardInfo),approval:result.response.apply_num,imp_uid:result.response.imp_uid}
            next(null,response);
         }
      });
}

router.cancelCard=function(imp_uid,next){
     let accessToken;

     async.waterfall([function(callback){
         getAccessToken(callback);
     },function(result,callback){
         accessToken=result;
         cancelPayment(imp_uid,accessToken,callback);
     }],function(err,result){
        if(err){
            next("card-cancel failure");
        }else{
            next(null,imp_uid);
        }
    });
}

module.exports = router;

