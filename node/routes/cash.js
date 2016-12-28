let express = require('express');
let router = express.Router();
let request = require('request');
let mariaDB = require('./mariaDB');
let noti = require('./notification');
let gcm = require('node-gcm');
let config = require('../config');
let async = require('async');
let Scheduler = require('redis-scheduler');
let scheduler = new Scheduler();
let redis = require('redis');
let redisCli = redis.createClient();

const NHCode = "010";

router.createCashId=function(req,res){
   //
   console.log("createCashId function start!!!");
   mariaDB.insertCashId(req.session.uid,req.body.cashId.toUpperCase(), req.body.password,function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         res.send(JSON.stringify({"result":"success"}));
      }
   });
};

router.modifyCashPwd=function(req,res){
   console.log("modifyCashPwd function start!!");
   mariaDB.updateCashInfo(req.session.uid,req.body.cashIdi.toUpperCase(),req.body.password,function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure"}));
      }else{
         res.send(JSON.stringify({"result":"success"}));
      }
   });
}

router.checkCashInfo = function(req,res){
   console.log("checkCashInfo function start");

   mariaDB.checkCashPwd(req.body.cashId.toUpperCase(),req.body.password,function(err,cashInfo){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure", "error":err}));
      }else{
         console.log("checkCashInfo success");
         res.send(JSON.stringify({"result":"success"}));
      }
   });
}

/*
Response Result : [{"Iqtcnt":"1",
                     "TotCnt":"0",
                     "Header":{"FintechApsno":"001",
                              "ApiSvcCd":"01M_007_00",
                              "Iscd":"000061",
                              "ApiNm":"RetrieveAgreementAccountTransactionHistory",
                              "Trtm":"162745",
                              "Rsms":"정상 처리 되었습니다.",
                              "IsTuno":"TAKIT20161215162745",
                              "Rpcd":"00000",
                              "Tsymd":"20161215"},
                     "Rec":[{"AftrBlnc":"0000000000010001.00",
                              "MnrcDrotDsnc":"2",
                              "Tuno":"00000000001",
                              "Smr":"인터넷당행",
                              "HnbrCd":"000001",
                              "BnprCntn":"타킷 주식회",
                              "Trdd":"20161215",
                              "Tram":"0000000000010000.00",
                              "HnisCd":"011","Ccyn":"0"}],
                              "CtntDataYn":"N"}]
*/

//거래내역 조회
router.RetrieveAgreementAccountTransactionHistory=function(stratDate, endDate,next){
   const form = {};
   form.command = "RetrieveAgreementAccountTransactionHistory"; //약정계좌 거래내역 조회
   form.stratDate = stratDate;
   from.endDate = endDate;
   request.post({url:'https://takit.biz:8443/NHPintech/nhpintechServlet' , form:form}, function (err, response, result){
      let body = JSON.parse(result);
      if(err){
         console.log("RetrieveAgreementAccountTransactionHistory error"+JSON.stringify(err));
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(body.Header.Rsms);
      }else if(!err && body.status ==="OK"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(null,body);
      }
   });
}

/*
Response Result : [{"Header":{"FintechApsno":"001",
                     "ApiSvcCd":"01M_007_00",
                     "Iscd":"000061",
                     "ApiNm":"ReceivedTransferAccountNumber",
                     "Trtm":"171519",
                     "Rsms":"정상 처리 되었습니다.",
                     "IsTuno":"TAKIT20161215171519",
                     "Rpcd":"00000",
                     "Tsymd":"20161215"}}]
*/
//입금이체 (takit계좌에서 농협 다른계좌로 송금)
router.ReceivedTransferAccountNumber=function(account,amount,next){
   const form = {};
   form.command = "ReceivedTransferAccountNumber"; //약정계좌 거래내역 조회
   form.account = account;
   form.amount = amount;
   request.post({url:'https://takit.biz:8443/NHPintech/nhpintechServlet' , form:form}, function (err, response, result){
      let body = JSON.parse(result);      
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(body.Header.Rsms);
      }else if(!err && body.status ==="OK"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(null,body);
      }
   });
}
/*
[{"Header":{"FintechApsno":"001",
            "ApiSvcCd":"01M_009_00",
            "Iscd":"000061",
            "ApiNm":"ReceivedTransferOtherBank",
            "Trtm":"171358",
            "Rsms":"정상 처리 되었습니다.",
            "IsTuno":"TAKIT20161215171358",
            "Rpcd":"00000",
            "Tsymd":"20161215"}}]
*/

//타행입금이체 (takit계좌에서 다른은행 계좌로 송금)
router.ReceivedTransferOtherBank=function(bankCode,account,next){
   const form = {};
   form.command = "receivedTransferOtherBank";
   form.bankCode = bankCode;
   form.account = account;
   request.post({url:'https://takit.biz:8443/NHPintech/nhpintechServlet' , form:form}, function (err, response, result) {
      let body = JSON.parse(result);
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(body.Header.Rsms);
      }else if(body.status ==="OK"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(null,body);
      }
   });
}

/*
Response Result : [{"Acno":"3012424363621",
                  "Bncd":"010",
                  "Dpnm":"타킷 주식회",
                  "Header":{"FintechApsno":"001",
                           "ApiSvcCd":"04Q_004_00",
                           "Iscd":"000061","
                           ApiNm":"InquireDepositorAccountNumber",
                           "Trtm":"102440",
                           "Rsms":"정상 처리 되었습니다.",
                           "IsTuno":"TAKIT20161215102440",
                           "Rpcd":"00000",
                           "Tsymd":"20161215"}}]
*/
//농협 예금주 조회
router.InquireDepositorAccountNumber=function(account,next){
   const form = {};
   form.command = "InquireDepositorAccountNumber";
   form.account = account;
   request.post({url:'https://takit.biz:8443/NHPintech/nhpintechServlet' , form:form}, function (err, response, result) {
      let body = JSON.parse(result);
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(body.Header.Rsms);
      }else if(!err && body.status ==="OK"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(null,body);
      }
   });
}


/*
{ "Header":{
         "ApiNm":"InquireDepositorOtherBank",
         "Tsymd":"20151012",
         "Trtm":"132127",
         "Iscd":"12345",
         "FintechApsno":"001",
         "ApiSvcCd":"DrawingTransferA",
         "IsTuno":"201510120000000001",
         "Rpcd":"00000",
         "Rsms ":"정상처리되었습니다"},
"Bncd":"010",
"Acno":"012345678912",
"Dpnm":"홍길동"
}

*/
//타행 예금주 조회
router.InquireDepositorOtherBank=function(bankCode,account,next){
   const form = {};
   form.command = "InquireDepositorOtherBank"; //약정계좌 거래내역 조회
   form.bankCode = bankCode;
   form.account = account;
   request.post({url:'https://takit.biz:8443/NHPintech/nhpintechServlet' , form:form}, function (err, response, result) {
      let body = JSON.parse(result);
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(body.Header.Rsms);
      }else if(!err && body.status ==="OK"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
         next(null,body);
      }
   });
}


/////////////// 캐쉬 전환 API /////////////////

function getTimezoneLocalTime(timezone,timeInMilliSec){ // return current local time in timezone area
	console.log("timeInMilliSec:"+timeInMilliSec);

	var offset=(new timezoneJS.Date(Date(), timezone)).getTimezoneOffset(); // offset in minutes
	var newtime =  timeInMilliSec - (offset*60*1000);
	var currlocal= new Date(timeInMilliSec - (offset*60*1000));
	return currlocal.toISOString();
}

function checkAccountHistory(next){
   let beforeIqtcnt;

   async.waterfall([function(callback){
      redisCli.get('cash_Iqtcnt',callback);
   },function(result,callback){
      beforeIqtcnt = result;
      let startDate = getTimezoneLocalTime('Asia/Seoul',new Date(currentTime.getTime()-86400000)); //어제 날짜 local시간으로 계산
      let endDate = getTimezoneLocalTime('Asia/Seoul',new Date(currentTime.getTime())); //오늘 날짜 local시간으로 계산
      router.RetrieveAgreementAccountTransactionHistory(stratDate.substring(0,10).replace('-',''),
                                                         endDate.substring(0,10).replace('-',''),callback);
   },function(result,callback){
      if(result.Header.Iqtcnt > beforeIqtcnt){
         for(let i=0; i<result.Header.Iqtcnt-beforeIqtcnt; i++){
            let cashList = {};
            cashList.cashTuno = result.Header.IsTuno;
            //cashList.userId = req.session.uid;
            cashList.cashId = result.Rec.BnprCntn.toUpperCase();
            cashList.transactionType = "deposit";
            cashList.amount = result.Rec.Tram;
            cashList.transactionTime = result.Rec.Trdd+result.Rec.Mntmd;
            cashList.confirm = 0;
            cashList.branchCode = result.Rec.HnbrCd;

            async.waterfall([function(callback){
               async.parallel([function(callback){
                  insertCashList(cashList,callback);
               },function(callback){
                  getPushIdWithCashId(cashList.cashId,callback);
               },function(callback){
                  getBankName(cashList.branchCode,callback); // branchCode로 bankName,branchName 가져옴
               }],callback);
            },function(result,callback){
               //send notification
               console.log("cashHistory iteration : "+JSON.stringify(result));
               cashList.bankName = result[2].bankName;
               cashList.branchName = result[2].branchName;
               const GCM ={};
               GCM.title = "적립된 캐쉬를 확인해주세요";
               GCM.content = result.Rec.Tram+"캐쉬 확인 바로가기";
               GCM.custom = JSON.stringify(cashList);
               GCM.GCMType = "cash";

               noti.sendGCM(config.SERVER_API_KEY,GCM,[result[1].pushId],result[1].platform,callback); //API_KEY,MSG,pushId, platform,
            }],function(err,result){
               if(err){
                  console.log(err);
               }else{
                  if(i === result.Header.Iqtcnt-beforeIqtcnt-1){
                     redisCli.set('cash_Iqtcnt',result.Header.Iqtcnt, callback);
               	}
            	}
				});
         }
      }else{
         callback(null);
      }
   }],function(err,result){
      if(err){
         console.log(err);
         next(err);
      }else{
         console.log("checkAccountHistory function success");
         next(null,"success");
      }
   });

}

router.checkCashInstantly = function(req,res){
   checkAccountHistory(function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         res.send(JSON.stringify({"result":"success"}));
      }
   });
}

//cash 수동 확인 -> cashId는 있고, 통장인자내역에 cashId를 넣지 않아서, user가 정보 넣고 조회 할 때
//depositDate, depositAmount, branchCode,
router.checkCashUserself = function(req,res){
   console.log("checkCashUserself start")
   let newCashList={};
   async.waterfall([function(callback){
      checkAccountHistory(req.session.uid,callback);
   },function(result,callback){
      let cashList ={};
      cashList.depositMemo = req.body.depositMemo;
      cashList.amount = req.body.depositAmount;
      cashList.branchCode = req.body.branchCode;
      cashList.depositDate = req.body.depositDate;
      mariaDB.getDepositedCash(cashList,callback);
   },function(result,callback){
      newCashList = result;
      async.parallel([function(callback){
         mariaDB.getPushId(req.session.uid,callback);
      },function(callback){
         maraiDB.getBankName(req.body.branchCode,callback);
      }],callback);
   },function(result,callback){
      newCashList.bankName = result[1].bankName;
      newCashList.branchName = result[1].branchName;

      const GCM ={};
      GCM.title = "적립된 캐쉬를 확인해주세요";
      GCM.content = newCashList.amount+"캐쉬 확인 바로가기";
      GCM.custom = JSON.stringify(newCashList);
      GCM.GCMType = "cash";

      noti.sendGCM(config.SERVER_API_KEY,GCM,[result[0].pushId],result[0].platform,callback); //API_KEY,MSG,pushId, platform,
   }],function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         res.send(JSON.stringify({"result":"success"}));
      }
   });
}

//user가 확인버튼 눌렀을 때
router.addCash = function(req,res){
   async.waterfall([function(callback){
      mariaDB.updateBalanceCash(req.body.cashId.toUpperCase(),parseInt(req.body.amount),callback);
   },function(result,callback){
      mariaDB.getBalanceCash(req.body.cashId,callback)
   },function(balance,callback){
      const cashList = {};
      cashList.cashTuno = req.body.cashTuno;
      cashList.transactionTime = new Date().toISOString();
      cashList.confirm = 1;
      cashList.nowBalance = balance;
      mariaDB.updateCashList(cashList,callback);
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         console.log("addCash success:"+JSON.stringify(result));
         res.send(JSON.stringify({"result":"success"}));
      }
   });
};

/////////// 캐쉬 전환 API end.


function pad(n, length) {
   while (n.toString().length < length) {
      n = '0' + n;
   }
   return n;
}

function setIsTuno(){

   let d = new Date();

   //yyyyMMddHHmmssSSS
   let IsTuno = d.getUTCFullYear().toString() +
               pad(d.getUTCMonth() + 1,2) +
               pad(d.getUTCDate(),2) +
               pad(d.getUTCHours(),2) +
               pad(d.getUTCMinutes(),2) +
               pad(d.getUTCSeconds(),2) +
               pad(d.getUTCMilliseconds(),3);

   console.log("IsTuno:"+IsTuno);
   return IsTuno;
}



// user가 캐쉬로 주문하여 캐쉬 빠짐
router.payCash = function(req,res){
   //cashList 에도 업데이트

   async.waterfall([function(callback){
      mariaDB.updateBalanceCash(req.body.cashId.toUpperCase(), -parseInt(req.body.amount),callback);
   },function(result,callback){
      mariaDB.getBalanceCash(req.body.cashId,callback);
   },function(balance,callback){
      const cashList = {};

      cashList.cashTuno = setIsTuno();   //T+format(yyyyMMddHHmmssSSS)
      cashList.userId = req.session.uid;
      cashList.transactionType = "payment";
      cashList.amount = amount;
      cashList.transactionTime = new Date().toISOString();
      cahsList.branchCode = null;
      cashList.confirm = 1;
      cashList.nowBalance = balance;
      mariaDB.insertCashList(cashList,callback);
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         console.log("payCash success:"+JSON.stringify(result));
         res.send(JSON.stringify({"result":"success"}));
      }
   });
};



///////////환불 API////////////

router.registRefundAccount = function(req,res){
   async.waterfall([function(callback){
      if(req.body.bank === NHCode){ //농협일때
         router.InquireDepositorAccountNumber(req.body.account,callback);
      }else{ //타행일때
         router.InquireDepositorOtherBank(req.body.bankCode,req.body.account,callback);
      }
   },function(result,callback){
      if(result.dpnm === req.body.name){ //dpnm Header에 있는 정보 아님
         callback(null,"success");
      }else{
         callback("incorrect depositor");
      }
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         console.log(result);
         res.send(JSON.stringify({"result":"success"}));
      }
   });
};

//2.출금 이체
//parameter: depositorName, bankCode,account,withdrawalAmount <-> deposit
router.refundCash=function(req,res){
   async.waterfall([function(callback){
      mariaDB.getCashInfo(req.session.uid, callback);
   },function(cashInfo,callback){
      console.log("cashInfo:"+cashInfo);
      if(cashInfo.balance < req.body.withdrawalAmount){
         callback("check your balance");
      }else{
         callback(null,"success");
      }
   },function(result,callback){
      async.parallel([function(callback){
         let cash = -parseInt(req.body.amount); //balance +(-amount)의 개념
         mariaDB.updateBalanceCash(req.body.cashId.toUpperCase(), req.body.amount, callback)
      },function(callback){
         if(req.body.bankCode === NHCode){ //농협계좌로 환불할 때
            router.ReceivedTransferAccountNumber(req.body.account,req.body.withdrawalAmount,callback);
         }else{
            router.ReceivedTransferOtherBank(req.body.bankCode,req.body.account,req.body.withdrawalAmount,callback);
         }
      }],callback);
   },function(result,callback){
      const cashList = {};
      cashList.cashTuno = result.Header.IsTuno;
      cashList.userId = req.session.uid;
      cashList.cashId = req.body.cashId.toUpperCase();
      cashList.transactionType = "refund";
      cashList.amount = req.body.withdrawalAmount;
		cashList.transactionTime = new Date().toISOString();
      mariaDB.insertCashList(cashList,callback);
   }],function(err,result){
      if(err){
         console.log(err);
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         console.log("success:"+JSON.stringify(result));
         res.send(JSON.stringify({"result":"success"}));
      }
   });

}

router.branchNameAutoComplete = function(req,res){
	console.log("bankCodeAutoComplete comes(req:"+JSON.stringify(req.body)+")");
	mariaDB.findBranchName(req.body.branchName,req.body.bankName,function(err,bankInfo){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         res.send(JSON.stringify({"result":"success", "bankInfo": bankInfo}));
      }
	});
};


router.getBalanceCash = function(req,res){
   console.log("getBalanceCash comes(req:"+JSON.stringify(req.body)+")");

   mariaDB.getBalanceCash(req.body.cashId,function(err,balance){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         res.send(JSON.stringify({"result":"success", "balance": balance}));
      }
   });
}

// 캐쉬 사용내역 조회
router.getCashList = function(req,res){
   mariaDB.getCashList(req.body.cashId,function(err,cashList){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
         res.send(JSON.stringify({"result":"success","cashList":cashList}));
      }
   });
};

module.exports = router;
