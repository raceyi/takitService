let express = require('express');
let router = express.Router();
let request = require('request');
let mariaDB = require('./mariaDB');
let noti = require('./notification');
let config = require('../config');
let async = require('async');
let Scheduler = require('redis-scheduler');
let scheduler = new Scheduler();
let redis = require('redis');
let redisCli = redis.createClient();
let timezoneJS = require('timezone-js');
let index = require('./index');

const NHCode = "011";


router.createCashId=function(req,res){
   //
   console.log("createCashId function start!!!");
   mariaDB.insertCashId(req.session.uid,req.body.cashId.toUpperCase(), req.body.password,function(err,result){
      if(err){
         res.send(JSON.stringify({"result":"failure","error":err}));
      }else{
			if(result === "duplicationCashId"){
				let response = new index.FailResponse("duplicationCashId");
				res.send(JSON.stringify(response));
			}else{
				let response = new index.SuccResponse();
         	res.send(JSON.stringify(response));
			}
      }
   });
};

router.modifyCashPwd=function(req,res){
   console.log("modifyCashPwd function start!!");
   mariaDB.updateCashPassword(req.session.uid,req.body.cashId.toUpperCase(),req.body.password,function(err,result){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
      }
   });
}

router.checkCashInfo = function(req,res){
   console.log("checkCashInfo function start");

   mariaDB.checkCashPwd(req.body.cashId.toUpperCase(),req.body.password,function(err,cashInfo){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
         console.log("checkCashInfo success");
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
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
router.RetrieveAgreementAccountTransactionHistory=function(startDate, endDate,pageNO,num,next){
   const form = {};
   form.command = "RetrieveAgreementAccountTransactionHistory"; //약정계좌 거래내역 조회
   form.startDate = startDate;
   form.endDate = endDate;
	form.pageNO = pageNO;
	form.num = num;

	console.log(form);
   request.post({url:'http://localhost:8080/NHPintech/nhpintechServlet' , form:form}, function (err, response, result){
		let body = JSON.parse(result);
      if(err){
         console.log("RetrieveAgreementAccountTransactionHistory error"+JSON.stringify(err));
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
			if(body.Header.Rpcd === "AC002"){
				next("no service time");
			}else{
         	next(body.Header.Rsms);
			}
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
   request.post({url:'http://localhost:8080/NHPintech/nhpintechServlet' , form:form}, function (err, response, result){
      let body = JSON.parse(result);      
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
			if(body.Header.Rpcd === "AC002"){
            next("no service time");
         }else{
            next(body.Header.Rsms);
         }
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
router.ReceivedTransferOtherBank=function(bankCode,account,amount,next){
   const form = {};
   form.command = "ReceivedTransferOtherBank";
   form.bankCode = bankCode;
   form.account = account;
	form.amount = amount;
   request.post({url:'http://localhost:8080/NHPintech/nhpintechServlet' , form:form}, function (err, response, result){
      let body = JSON.parse(result);
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
			if(body.Header.Rpcd === "AC002"){
            next("no service time");
         }else{
            next(body.Header.Rsms);
         }
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
   request.post({url:'http://localhost:8080/NHPintech/nhpintechServlet' , form:form}, function (err, response, result) {
      let body = JSON.parse(result);
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
			if(body.Header.Rpcd === "AC002"){
            next("no service time");
         }else{
            next(body.Header.Rsms);
         }
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
   request.post({url:'http://localhost:8080/NHPintech/nhpintechServlet' , form:form}, function (err, response, result) {
      let body = JSON.parse(result);
		if(err){
         console.log(err);
         next(err);
      }else if(body.status ==="failure"){
         console.log("body:"+JSON.stringify(body)); // Show the HTML for the Google homepage.
         console.log("response:"+JSON.stringify(response));
			if(body.Header.Rpcd === "AC002"){
            next("no service time");
         }else{
            next(body.Header.Rsms);
         }
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


function checkAccountHistory(pageNO,count,startDate,next){
   let CtntFlag = true;
   let accHistory = {};

   if(count === "100"){ //마지막 조회 페이지의 100번째면 다음 페이지의 0부터 조회
      pageNO++;
      count = 0;
   }

	console.log(pageNO+" "+count+" "+" "+startDate);
   async.whilst(function(){return CtntFlag},
      function(callback){
         router.RetrieveAgreementAccountTransactionHistory(startDate,startDate,pageNO,"100",function(err,result){
            console.log("RetrieveAgreementAccountTransactionHistory success");

            accHistory = result;
            let i = 0;
            async.whilst(function(){ return i < accHistory.Iqtcnt-count;},
            function(callback){
               let cashList = {};
              
               cashList.cashId = accHistory.Rec[i].BnprCntn.toUpperCase();
               cashList.transactionType = "deposit";
               cashList.amount = parseInt(accHistory.Rec[i].Tram);
               cashList.depositTime = accHistory.Rec[i].Trdd;
               cashList.transactionTime = new Date().toISOString();
					cashList.confirm = 0;
					cashList.bankCode = accHistory.Rec[i].HnisCd;
					cashList.branchCode = accHistory.Rec[i].HnbrCd;

               let NHisCd = ["010","011","012","013","014","015","016","017","018"];

               for(let idx=0; idx<NHisCd.length; idx++){
                  if(accHistory.Rec[i].HnisCd === NHisCd[idx]){
							cashList.branchCode = accHistory.Rec[i].HnisCd + accHistory.Rec[i].HnbrCd.substring(3,6);
                     break;
                  }
               }               
   
					console.log(cashList);
               async.waterfall([function(callback){
						mariaDB.getBankName(cashList.branchCode,callback);
               },function(result,callback){
						cashList.bankName = result.bankName;
                  cashList.branchName = result.branchName;
                  console.log("insertCashList");
                  mariaDB.insertCashList(cashList,callback);
               },function(cashTuno,callback){
						cashList.cashTuno = cashTuno;
                  async.parallel([function(callback){
                     redisCli.hmset('cash_'+startDate,'pageNO',pageNO,'count',count+i+1,callback);
                  },function(callback){
                     mariaDB.getPushIdWithCashId(cashList.cashId,callback);
                  }],callback);
               },function(result,callback){
                  //send notification
						
						console.log("cashHistory iteration : "+JSON.stringify(result));
                  const GCM ={};
                  GCM.title = "입금된 캐쉬를 확인해주세요";
                  GCM.content = cashList.amount+"캐쉬 확인 바로가기";
                  GCM.custom = JSON.stringify(cashList);
                  GCM.GCMType = "cash";

                  i++;
                  if(result[1] !== "incorrect cashId"){
                     noti.sendGCM(config.SERVER_API_KEY,GCM,[result[1].pushId],result[1].platform,callback);
                  }else{
                     callback(null,"incorrect cashId");
                  }
               }],callback); //API_KEY,MSG,pushId, platform,
            },function(err,result){
               if(err){
                  console.log(err);
                  callback(err);
               }else{
                  if(accHistory.CtntDataYn === "N"){
                     CtntFlag = false;
                  }else{
                     pageNO++;
                     count = 0;
                  }
                  callback(null,result);
               }
         });
      });
   },function(err,result){
      if(err){
         next(err);
      }else{
         console.log("checkAccountHistory success");
         next(null,result);
      }
   });
}



router.checkCashInstantly = function(req,res){
   let nowTime = getTimezoneLocalTime('Asia/Seoul', new Date().getTime()); //농협이 'Asia/Seoul' 이므로 이시간으로 맞춰줌
   let beforeTime = getTimezoneLocalTime('Asia/Seoul',new Date().getTime()-350000); //지금시간 local시간으로 -6분전 시간으로 계산
   //redis reset을 어떻게 한번만...? 시키나ㅜㅜ expire 시간 24시간+10분으로 설정하면 될 듯
   let startDate = beforeTime.substring(0,10).replace(/-/gi,'');

   async.waterfall([function(callback){
		redisCli.exists('cash_'+startDate,callback);
   },function(result,callback){
      if(result === 0){ //key가 없으면
         redisCli.hmset('cash_'+startDate,'pageNO','1','count',0,function(err,result){
            if(err){
               console.log(err);
               callback(err);
            }else{
               console.log(result);
               redisCli.expire('cash_'+startDate, 87600); //60*60*24 + 60*20
            }
         });
      }else{ //있으면
         callback(null,"key is already exists")
      }
   },function(result,callback){
		console.log("startDate:"+startDate);
      redisCli.hgetall('cash_'+startDate,callback);
   },function(result,callback){
		console.log(result);
      checkAccountHistory(result.pageNO,parseInt(result.count),startDate,callback);
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
         console.log(result);
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
      }
   });
}

setInterval(function(){
   let beforeTime = getTimezoneLocalTime('Asia/Seoul',new Date().getTime()-350000); //지금시간 local시간으로 -6분전 시간으로 계산 //농협이 'Asia/Seoul' 이므로 이시간으로 맞춰줌
   //redis reset을 어떻게 한번만...? 시키나ㅜㅜ expire 시간 24시간+10분으로 설정하면 될 듯
   let startDate = beforeTime.substring(0,10).replace(/-/gi,'');


   async.waterfall([function(callback){
      redisCli.exists('cash_'+startDate,callback);
   },function(result,callback){
      if(result === 0){ //key가 없으면
         redisCli.hmset('cash_'+startDate,'pageNO','1','count',0,function(err,result){
            if(err){
               console.log(err);
               callback(err);
            }else{
               console.log(result);
               redisCli.expire('cash_'+startDate, 87600); //60*60*24 + 60*20
            }
         });
      }else{ //있으면
         callback(null,"key is already exists")
      }
   },function(result,callback){
      console.log("startDate:"+startDate);
      redisCli.hgetall('cash_'+startDate,callback);
   },function(result,callback){
      console.log(result);
      checkAccountHistory(result.pageNO,parseInt(result.count),startDate,callback);
   }],function(err,result){
      if(err){
         console.log("setInterval checkAccountHistory error: "+JSON.stringify(err));
      }else{
         console.log("setInterval checkAccountHistory success:"+JSON.stringify(result));
      }
   });
},300000);

//cash 수동 확인 -> cashId는 있고, 통장인자내역에 cashId를 넣지 않아서, user가 정보 넣고 조회 할 때
//depositDate, depositAmount, bankName,
router.checkCashUserself = function(req,res){
   console.log("checkCashUserself start");
   let nowTime = getTimezoneLocalTime('Asia/Seoul', new Date().getTime()); //농협이 'Asia/Seoul' 이므로 이시간으로 맞춰줌
   let beforeTime = getTimezoneLocalTime('Asia/Seoul',new Date().getTime()-350000); //지금시간 local시간으로 -6분전 시간으로 계산
   //redis reset을 어떻게 한번만...? 시키나ㅜㅜ expire 시간 24시간+10분으로 설정하면 될 듯
   let startDate = beforeTime.substring(0,10).replace(/-/gi,'');
	let cashList={};	

   async.waterfall([function(callback){
      mariaDB.getCashInfo(req.body.cashId.toUpperCase(),callback);
   },function(result,callback){
		console.log(result);
		console.log(result.confirmCount);
      if(result.confirmCount <= 3){
         mariaDB.updateConfirmCount(req.body.cashId.toUpperCase(), parseInt(result.confirmCount)+1,callback);
      }else{
         callback("count excess");
      }
   },function(result,callback){
      redisCli.exists('cash_'+startDate,callback);
   },function(result,callback){
      if(result === 0){ //key가 없으면
         redisCli.hmset('cash_'+startDate,'pageNO','1','count',0,function(err,result){
            if(err){
               console.log(err);
               callback(err);
            }else{
               console.log(result);
               redisCli.expire('cash_'+startDate, 87600); //60*60*24 + 60*20
            }
         });
      }else{ //있으면
         callback(null,"key is already exists")
      }
   },function(result,callback){
      redisCli.hgetall("cash_"+startDate,callback);
   },function(result,callback){
      console.log(result);
      checkAccountHistory(result.pageNO,parseInt(result.count),startDate,callback);
   },function(result,callback){
		console.log("req.body:"+JSON.stringify(req.body));
      cashList.depositMemo = req.body.depositMemo.toUpperCase();
      cashList.amount = req.body.amount;
      cashList.depositDate = req.body.depositDate.substring(0,10);
      cashList.branchCode = req.body.branchCode;
      mariaDB.getDepositedCash(cashList,callback);
   },function(result,callback){
		cashList.cashTuno = result.cashTuno;
      cashList.bankName = result.bankName;
  		mariaDB.updateConfirmCount(req.body.cashId,0,callback);
      //mariaDB.getPushId(req.session.uid,callback);
   },function(result,callback){
		mariaDB.getPushId(req.session.uid,callback);
	},function(result,callback){
      const GCM ={};
      GCM.title = "입금된 캐쉬를 확인해주세요";
      GCM.content = cashList.amount+"캐쉬 확인 바로가기";
      GCM.custom = JSON.stringify(cashList);
      GCM.GCMType = "cash";

      noti.sendGCM(config.SERVER_API_KEY,GCM,[result.pushId],result.platform,callback); //API_KEY,MSG,pushId, platform,
   //},function(result,callback){

      //mariaDB.updateConfirmCount(req.body.cashId,0,callback);
   }],function(err,result){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			if(result === "gcm:400"){
				let response = new index.FailResponse(result);
				res.send(JSON.stringify(response));
         }else{
				let response = new index.SuccResponse();
				res.send(JSON.stringify(response));
			}
      }
   });
}


//user가 잘못된 캐쉬 목록 들어와서 삭제했을 때
router.removeWrongCashList = function(req,res){
   console.log("removeWrongCashList start!!");

   mariaDB.updateTransactionType(req.body.cashTuno,"wrong",function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
         console.log(result);
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
      }
   });
}


//user가 확인버튼 눌렀을 때
router.addCash = function(req,res){
   async.waterfall([function(callback){
   	mariaDB.getCashListWithTuno(req.body.cashTuno,callback);
   },function(result,callback){
      if(result.confirm === '0'){
         mariaDB.updateBalanceCash(req.body.cashId.toUpperCase(), parseInt(req.body.amount),callback);
      }else{
         callback("already checked cash");
      }
	},function(result,callback){
      mariaDB.getBalanceCash(req.body.cashId.toUpperCase(),callback)
   },function(balance,callback){
      const cashList = {};
		cashList.cashId = req.body.cashId.toUpperCase();
      cashList.cashTuno = req.body.cashTuno;
      cashList.transactionTime = new Date().toISOString();
		cashList.transactionType = "deposit"; 
     	cashList.confirm = 1;
      cashList.nowBalance = balance;
      mariaDB.updateCashList(cashList,callback);
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
         console.log("addCash success:"+JSON.stringify(result));
			let response = new index.SuccResponse();
            res.send(JSON.stringify(response));
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


// user가 캐쉬로 주문하여 캐쉬 빠짐
router.payCash = function(cashId,amount,next){
   let balance;
   async.waterfall([function(callback){
      mariaDB.getBalanceCash(cashId.toUpperCase(),callback);
   },function(result,callback){
      balance = result;

      async.parallel([function(callback){
         if(balance >= amount){ //갖고 있는 캐쉬가 구매하려는 상품의 가격보다 같거나 많으면 구매할 수 있음
            mariaDB.updateBalanceCash(cashId.toUpperCase(), -parseInt(amount),callback);
         }else{
            callback("check your balance");
         }
      },function(callback){
         const cashList = {};
         cashList.cashId = cashId;
			cashList.transactionType = "payment";
         cashList.amount = amount;
         cashList.transactionTime = new Date().toISOString();
         cashList.confirm = 1;
         cashList.nowBalance = balance-amount;
         mariaDB.insertCashList(cashList,callback);
      }],callback);
   }],function(err,result){
      if(err){
         console.log(err);
         next(err);
      }else{
         console.log("payCash success:"+JSON.stringify(result));
         next(null,"success");
      }
   });
};







//////// 주문 취소로 cash로 환불 //////

router.cancelCash = function(cashId,amount,next){
   async.waterfall([function(callback){
      mariaDB.updateBalanceCash(cashId.toUpperCase(), parseInt(amount),callback);
   },function(result,callback){
      mariaDB.getBalanceCash(cashId,callback)
   },function(balance,callback){
      const cashList = {};

		console.log("amount :"+amount);
		cashList.cashId = cashId.toUpperCase();
      cashList.transactionType = "cancel";
      cashList.amount = amount;
      cashList.transactionTime = new Date().toISOString();
      cashList.confirm = 1;
      cashList.nowBalance = balance;
      mariaDB.insertCashList(cashList,callback);
   }],function(err,result){
      if(err){
         console.log(err);
         next(err);
      }else{
         console.log("addCash success:"+JSON.stringify(result));
         next(null,"success");
      }
   });
}


///////////환불 API////////////

router.registRefundAccount = function(req,res){
   async.waterfall([function(callback){
      if(req.body.bankCode === NHCode){ //농협일때
         router.InquireDepositorAccountNumber(req.body.account,callback);
      }else{ //타행일때
         router.InquireDepositorOtherBank(req.body.bankCode,req.body.account,callback);
      }
   },function(result,callback){
      if(result.Dpnm === req.body.depositorName){ //Dpnm Header에 있는 정보 아님
         callback(null,"success");
      }else{
         callback("incorrect depositor");
      }
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));	
      }else{
         console.log(result);
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
      }
   });
};

//2.출금 이체

//환불 횟수 조회 (4회 초과 시 수수료)
router.checkRefundCount = function(req,res){
   console.log("checkRefundCount start!!!");

   mariaDB.getCashInfo(req.body.cashId.toUpperCase(),function(err,result){
      if(err){
         console.log("err");
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
         console.log("result");
			let response = new index.SuccResponse();
      	if(result.refundCount >=4 && req.body.bankCode === NHCode && result.balance >= 150){
            console.log("환불 4회 초과 입니다.")
				response.fee = "150";
				res.send(JSON.stringify(response));
         }else if(result.refundCount >=4 && req.body.bankCode !== NHCode && result.balance >= 400){
            console.log("환불 4회 초과 입니다.")
				response.fee = "400";
				res.send(JSON.stringify(response));
         }else if(result.refundCount <4){
            console.log("환불 4회 이하 입니다.")
				response.fee = "0";
				res.send(JSON.stringify(response));
         }else{
				response = new index.FailResponse("check your balance");
				res.send(JSON.stringify(response));
         }
		}
   });
};


//parameter: depositorName, bankCode,account,withdrawalAmount <-> deposit
router.refundCash=function(req,res){
	
	let cashList={};
	let cashInfo ={};
	cashList.fee=0;
   async.waterfall([function(callback){
      mariaDB.getCashInfo(req.body.cashId.toUpperCase(), callback);
   },function(result,callback){
		cashInfo=result;
      console.log( "cashInfo:"+cashInfo);
		console.log("req.body:"+JSON.stringify(req.body));
		if(cashInfo.refundCount >=4 && req.body.bankCode === NHCode){
         console.log("환불 4회 초과 입니다. NH");
			cashList.fee = 150;
      }else if(cashInfo.refundCount >=4 && req.body.bankCode !== NHCode){
         console.log("환불 4회 초과 입니다. other")
			cashList.fee = 400;
      }   
	
		console.log("fee:"+cashList.fee);
		if(parseInt(cashInfo.balance) >= parseInt(req.body.withdrawalAmount)+cashList.fee){ //환불받으려는 금액보다 잔액이 많아야 환불 가능
         if(req.body.bankCode === NHCode){ //농협계좌로 환불할 때
            router.ReceivedTransferAccountNumber(req.body.account,req.body.withdrawalAmount,callback);
         }else{
            router.ReceivedTransferOtherBank(req.body.bankCode,req.body.account,req.body.withdrawalAmount,callback);
         }
      }else{
         callback("check your balance");
      }
   },function(result,callback){
   	async.parallel([function(callback){
         mariaDB.updateRefundCashInfo(req.body.cashId.toUpperCase(), -parseInt(req.body.withdrawalAmount)-cashList.fee, callback)
      },function(callback){
         cashList.cashId = req.body.cashId.toUpperCase();
         cashList.transactionType = "refund";
         cashList.amount = req.body.withdrawalAmount;
         cashList.transactionTime = new Date().toISOString();
			cashList.bankName = req.body.bankName;
			cashList.account = req.body.account;
			cashList.nowBalance = parseInt(cashInfo.balance)-parseInt(req.body.withdrawalAmount)-cashList.fee;
         result.confirm = 1;

         mariaDB.insertCashList(cashList,callback);
      }],callback)
	}],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse(err);
			res.send(JSON.stringify(response));
      }else{
         console.log("success:"+JSON.stringify(result));
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
      }
   });

}


////////// 환불 API end.


///////// shop -cash API ///////////

router.checkWithdrawalCountShop = function(req,res){
   console.log("checkShopWithdrawalCount start!!!");

   mariaDB.getShopInfo(req.body.takitId,function(err,result){
      if(err){
         console.log("err");
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
         console.log("result");
			
			let response = new index.SuccResponse();
         if(result.withdrawalCount >=4 && req.body.bankCode === NHCode && result.balance >= 150){
            console.log("인출 4회 초과 입니다. NH")
				response.fee="150";
				res.send(JSON.stringify(response));
         }else if(result.withdrawalCount >=4 && req.body.bankCode !== NHCode && result.balance >= 400){
            console.log("인출 4회 초과 입니다. other")
				response.fee="400";
				res.send(JSON.stringify(response));
         }else if(result.withdrawalCount < 4){
            console.log("인출 4회 이하 입니다.")
				response.fee="0";
				res.send(JSON.stringify(response));
         }else{
				response = new index.FailResponse("check your balance");
				res.send(JSON.stringify(response));
         }
      }
   });
}


//shop - cash인출 API
//인출가능 금액,
router.withdrawCashShop = function(req,res){
   //takitId, amount
   //1. shopInfo에서 해당shop 계좌 가져옴
   //2. 계좌에 금액만큼 넣어줌.
   let shopInfo={};
   let fee =0;
   async.waterfall([function(callback){
      mariaDB.getShopInfoWithAccount(req.body.takitId,callback);
   },function(result,callback){
      shopInfo=result;
      console.log( "shopInfo:"+JSON.stringify(shopInfo));
      console.log("req.body:"+JSON.stringify(req.body));
      if(shopInfo.withdrawalCount >=4 && req.body.bankCode === NHCode){
         console.log("인출 4회 초과 입니다. NH");
         fee = 150;
      }else if(shopInfo.withdrawalCount >=4 && req.body.bankCode !== NHCode){
         console.log("인출 4회 초과 입니다. other")
         fee = 400;
      }

      console.log("fee:"+fee);
      if(parseInt(shopInfo.balance) >= parseInt(req.body.withdrawalAmount)+fee){ //환불받으려는 금액보다 잔액이 많아야 환불 가능
         if(req.body.bankCode === NHCode){ //농협계좌로 환불할 때
            router.ReceivedTransferAccountNumber(shopInfo.account,req.body.withdrawalAmount,callback);
         }else{
            router.ReceivedTransferOtherBank(req.body.bankCode,shopInfo.account,req.body.withdrawalAmount,callback);
         }
      }else{
         callback("check your balance");
      }
   },function(result,callback){
      mariaDB.updateWithdrawalShop(req.body.takitId,-parseInt(req.body.withdrawalAmount)-fee,callback);
   },function(result,callback){
      mariaDB.insertWithdrawalList(req.body.takitId,req.body.withdrawalAmount,fee,parseInt(shopInfo.balance)-parseInt(req.body.withdrawalAmount)-fee,callback);
   }],function(err,result){
      if(err){
         console.log(err);
			let response = new index.FailResponse("failure",err);
         res.send(JSON.stringify(response));
      }else{
         console.log(result);
			let response = new index.SuccResponse();
         res.send(JSON.stringify(response));
      }
   });
}


router.getBalnaceShop = function(req,res){
   mariaDB.getBalnaceShop(req.body.takitId,function(err,result){
      if(err){
			console.log(err);
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			console.log(result);
			let response = new index.SuccResponse();
			response.sales = result.sales;
			response.balance=result.balance;
         res.send(JSON.stringify(response));
      }
   })
}



router.getWithdrawalListShop = function(req,res){
   console.log("getWithdrawalList comes");
   mariaDB.getWithdrawalList(req.body.takitId,req.body.lastWithdNO,req.body.limit,function(err,result){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			let response = new index.SuccResponse();
			response.withdrawalList=result;
         res.send(JSON.stringify(response));
      }
   })
}


router.branchNameAutoComplete = function(req,res){
	console.log("bankCodeAutoComplete comes(req:"+JSON.stringify(req.body)+")");
	mariaDB.findBranchName(req.body.branchName,req.body.bankName,function(err,bankInfo){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			let response = new index.SuccResponse();
			response.bankInfo=bankInfo;
         res.send(JSON.stringify(response));
      }
	});
};

router.getBalanceCash = function(req,res){
   console.log("getBalanceCash comes(req:"+JSON.stringify(req.body)+")");

   mariaDB.getBalanceCash(req.body.cashId.toUpperCase(),function(err,balance){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			let response = new index.SuccResponse();
			response.balance=balance;
         res.send(JSON.stringify(response));
      }
   });
}

// 캐쉬 사용내역 조회
router.getCashList = function(req,res){
	mariaDB.getCashList(req.body.cashId.toUpperCase(),req.body.lastTuno,req.body.limit,function(err,cashList){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			let response = new index.SuccResponse();
			response.cashList=cashList;
			res.send(JSON.stringify(response));
      }
   });
};


router.branchNameAutoComplete = function(req,res){
	console.log("bankCodeAutoComplete comes(req:"+JSON.stringify(req.body)+")");
	mariaDB.findBranchName(req.body.branchName,req.body.bankName,function(err,bankInfo){
      if(err){
			let response = new index.FailResponse(err);
         res.send(JSON.stringify(response));
      }else{
			let response = new index.SuccResponse();
			response.bankInfo=bankInfo;
			res.send(JSON.stringify(response));

      }
	});
};



module.exports = router;
