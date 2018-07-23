var express = require('express');
var router = express.Router();
let mariaDB = require('./mariaDB');
var popbill = require('popbill');
let config = require('../config');

/**
* 팝빌 서비스 연동환경 초기화
*/
popbill.config({

  // 링크아이디
  LinkID :'TAKIT',

  // 비밀키
  SecretKey : config.popbillSecretKey, 

  // 연동환경 설정값, 개발용(true), 상업용(false)
  IsTest : true,

  defaultErrorHandler :  function(Error) {
    console.log('Error Occur : [' + Error.code + '] ' + Error.message);
  }
});

var cashbillService = popbill.CashbillService();

/* 매일 오후 2시반에 실행하도록 한다. 
   지난 3(72시간)일동안 영수증 발급을 확인한다. 
   주문상태가 cancelled이지만 현금영수증 발급번호가 존재하고 취소현금영수증이 발급되어 있지않다면
   현금영수증을 취고하거나 취소현금영수증을 발급한다.
 */
processCancelOrders=function(){
   console.log("cashBill-processCancelOrder");
    let date=new Date(Date.now()-24*60*60*1000*3); //3 days ago;
    let month= (date.getMonth()+1)<10?"0"+(date.getMonth()+1):date.getMonth()+1;
    let day  = date.getDate()<10? "0"+date.getDate():date.getDate();
    let timeString=date.getFullYear()+'-'+month+'-'+day;
    console.log("timeString:"+timeString);
    mariaDB.getRevokeRegistOrders(function(err,orders){
       orders.forEach(order=>{
           console.log("revokeRegistOrder order:"+JSON.stringify(order));  // cashBillKey, corpNum
           router.cancelIssue(order); 
       });
   })
}
                               
let d = new Date();
d.setHours(14,10,0,0);
let nextTimeout = d.getTime()-Date.now();
console.log("processCancelOrders-nextTimeout:"+nextTimeout);
//processCancelOrders();
setTimeout(function(){
             processCancelOrders();
             setInterval(processCancelOrders,24*60*60*1000); // 24 hours later
}, nextTimeout);

router.registIssue=function(info){
   console.log("info:"+JSON.stringify(info));
   if(info.total<=0)  // test order
       return;
   let date = new Date();
   let month= (date.getMonth()+1)<10?"0"+(date.getMonth()+1):date.getMonth()+1;
   let day  = date.getDate()<10? "0"+date.getDate():date.getDate();
   let hours=date.getHours()<10? '0'+date.getHours():date.getHours();
   let mins=date.getMinutes()<10?'0'+date.getMinutes():date.getMinutes();
   let secs=date.getSeconds()<10?'0'+date.getSeconds():date.getSeconds();
   let milliSecs=(date.getMilliseconds()<100)?( date.getMilliseconds()<10?"00"+date.getMilliseconds():"0"+date.getMilliseconds()):date.getMilliseconds();

   let MgtKey= date.getFullYear().toString().substr(2,2)+month+day+hours+mins+secs+milliSecs+'-'+info.userId; //문서관리번호,24bytes ,date-hourMinSecMillisec-userId;
   let testCorpNum = info.corpNum;     // 팝빌회원 사업자번호, '-' 제외 10자리
   let tradeUsage;
   if(info.receiptType==='ExpenseProof'){
       tradeUsage='지출증빙용';
   }else{
       tradeUsage='소득공제용';
   }
   let tax= Math.round(info.total/11);
   let supplyCost=info.total-tax;
   let substrs= info.takitId.split("@");
   let corpName=substrs[1]+" "+substrs[0];

  // 현금영수증 항목
  var cashbill = {
    mgtKey : MgtKey,                  // [필수] 문서관리번호
    tradeType : '승인거래',             // [필수] 거래유형, (승인거래, 취소거래) 중 기재
    tradeUsage : tradeUsage,           // [필수] (소득공제용, 지출증빙용) 중 기재
    taxationType : '과세',             // [필수] (과세, 비과세) 중 기재
    identityNum : info.receiptId,      // [필수] 거래처 식별번호
    franchiseCorpNum : info.corpNum,   // [필수] 발행자 사업자번호
    franchiseAddr : info.address,
    franchiseCorpName : corpName, 
    franchiseCEOName : info.owner,
    customerName : info.userName,
    itemName : info.orderName,
    orderNumber : info.orderNO,
    email : info.email,
    smssendYN : false,             // 발행시 알림문자 전송여부
 
    supplyCost : supplyCost,     // [필수] 공급가액, ',' 콤마 불가, 숫자만가능
    tax : tax ,                  // [필수] 세액, ',' 콤마 불가, 숫자만가능
    serviceFee : '0',              // [필수] 봉사료, ',' 콤마 불가, 숫자만가능
    totalAmount : info.total,    // [거래금액], ',' 콤마 불가, 숫자만가능
  };

  console.log("cashbill:"+JSON.stringify(cashbill)); 
  cashbillService.registIssue(testCorpNum,cashbill,
    function(result){
      console.log("registIssue-result:"+JSON.stringify(result));
      //mgtKey을 db에 저장한다. 
      mariaDB.saveCashBillKey(info.orderId,cashbill.mgtKey,function(err,result){
         if(err){
             console.log("!!!fail to save cashBillKey!!!");
         }
      }); 
    }, function(Error){
      console.log("registIssue-error:"+JSON.stringify(Error));
  });
}

router.cancelIssue=function(info){
  if(info.corpNum==null ||  info.cashBillKey==null){
      console.log("cancelIssue: invalid info "+JSON.stringify(info));
      return;
  }
  // 팝빌회원 사업자번호, '-' 제외 10자리
  var testCorpNum = info.corpNum;
  // 문서관리번호
  var mgtKey = info.cashBillKey;

  cashbillService.getInfo(testCorpNum, mgtKey,
    function(result) {
        console.log("getInfo-result:"+JSON.stringify(result.stateCode));
        if(result.stateCode==100){ //임시저장. registIssue를 호출함으로 발생하지 않는 상태임.
            console.log("임시저장상태");
        }else if(result.stateCode==300){ //발행완료
           //cancelIssue를 호출한다.
             // 팝빌회원 사업자번호, '-' 제외 10자리
             var memo = '발행취소';
             cashbillService.cancelIssue(testCorpNum, mgtKey, memo,
                 function(result) {
                     console.log("발행취소 성공");
  		             cashbillService.delete(testCorpNum, mgtKey,
                         function(result) {
			                 console.log("삭제 성공");
                             mariaDB.saveCashBillKey(info.orderId,null,function(err,result){
                               if(err){
                                   console.log("!!!fail to save cashBillKey!!!");
                               }else
                                   console.log("DB 삭제성공");
                             });
                         }, function(Error) {
			                 console.log("삭제 실패");
                     });
                 }, function(Error) {
                     console.log("발행취소 실패");
                 });
             //부분취소일 경우 새로운 금액으로 재발행한다. 
             //부분 환불 구현시 구현 필요함. 
        }else if(301<=result.stateCode && result.stateCode<=303){ //국세청 전송중
             //댜음날 처리하도록 한다. 
        }else if(result.stateCode==304){ // 전송완료
           //취소 현금영수증을 발행한다.
           console.log("getInfo-result:"+JSON.stringify(result));  
           //result.confirmNum이 반드시 있어야 한다. 
           cancelBill(info,result.confirmNum,result.tradeDate); 
        }else if(result.stateCode==305){ //발행오류 발생
           //발행오류임으로 무시한다. 
        }else if(result.stateCode==400){ //발행자에 의해 이미 취소됨
           //무시함.
        }
    }, function(Error) {
        console.log("getInfo-error:"+JSON.stringify(Error));
        if(Error.code ==-14000003){ //해당 관리번호의 현금영수증 정보가 존재하지 않습니다. 
            mariaDB.saveCashBillKey(info.orderId,null,function(err,result){
                 if(err){
                     console.log("!!!fail to save cashBillKey!!!");
                 }else
                     console.log("DB 삭제성공");
            }); 
        }
  });
}

cancelBill=function(info,confirmNum,tradeDate){
   //취소현금영수증을 발행한다. 
   var testCorpNum = info.corpNum;

   let date = new Date();
   let month= (date.getMonth()+1)<10?"0"+(date.getMonth()+1):date.getMonth()+1;
   let day  = date.getDate()<10? "0"+date.getDate():date.getDate();
   let hours=date.getHours()<10? '0'+date.getHours():date.getHours();
   let mins=date.getMinutes()<10?'0'+date.getMinutes():date.getMinutes();
   let secs=date.getSeconds()<10?'0'+date.getSeconds():date.getSeconds();
   let milliSecs=(date.getMilliseconds()<100)?( date.getMilliseconds()<10?"00"+date.getMilliseconds():"0"+date.getMilliseconds()):date.getMilliseconds();

   let mgtKey= date.getFullYear().toString().substr(2,2)+month+day+hours+mins+secs+milliSecs+'-'+info.userId; //문서관리번호,24bytes ,date-hourMinSecMillisec-userId;

  // [취소 현금영수증 발행시 필수] 원본 현금영수증 국세청 승인번호
  // 국세청 승인번호는 GetInfo API의 ConfirmNum 항목으로 확인할 수 있습니다.
  orgConfirmNum = confirmNum;
  // [취소 현금영수증 발행시 필수] 원본 현금영수증 거래일자
  // 원본 현금영수증 거래일자는 GetInfo API의 TradeDate 항목으로 확인할 수 있습니다.
  orgTradeDate = tradeDate;

  cashbillService.revokeRegistIssue(testCorpNum, mgtKey, orgConfirmNum, orgTradeDate,
    function(result) {
        console.log("registIssue-result:"+JSON.stringify(result));
        mariaDB.saveCancelCashBillKey(info.orderId,mgtKey,function(err,result){
            if(err){
                console.log("!!!fail to save cancelCashBillKey!!!");
            }
        });
    }, function(Error) {
      console.log("revokeRegistIssue-error:"+JSON.stringify(Error));
  });
}

/* 부분 취소 현금영수증 발행 예제

  // 팝빌회원 사업자번호, '-' 제외 10자리
  var testCorpNum = '1234567890';

  // 팝빌회원 아이디
  var testUserID = 'testkorea';

  // 문서관리번호, 1~24자리 숫자, 영문, '-', '_'를 조합하여 사업자별로 중복되지 않도록 작성
  var mgtKey = '20171115-09';

  // [취소 현금영수증 발행시 필수] 원본 현금영수증 국세청 승인번호
  // 국세청 승인번호는 GetInfo API의 ConfirmNum 항목으로 확인할 수 있습니다.
  var orgConfirmNum = '820116333';

  // [취소 현금영수증 발행시 필수] 원본 현금영수증 거래일자
  // 원본 현금영수증 거래일자는 GetInfo API의 TradeDate 항목으로 확인할 수 있습니다.
  var orgTradeDate = '20170711';


  // 안내문자 전송여부
  var smssendYN = false;

  // 메모
  var memo = '부분취소발행 메모';

  // 부분취소여부, true-부분취소, false-전체취소
  var isPartCancel = true;

  // 취소사유, 1-거래취소, 2-오류발급취소, 3-기타
  var cancelType = 1;

  // [취소] 공급가액
  var supplyCost = "7000";

  // [취소] 세액
  var tax = "700";

  // [취소] 봉사료
  var serviceFee = "0";

  // [취소] 합계금액
  var totalAmount = "7700";

  cashbillService.revokeRegistIssue(testCorpNum, mgtKey, orgConfirmNum, orgTradeDate, smssendYN, memo, testUserID,
    isPartCancel, cancelType, supplyCost, tax, serviceFee, totalAmount,
    function(result) {
       console.log("registIssue-result:"+JSON.stringify(result));
    }, function(Error) {
       console.log("registIssue-error:"+JSON.stringify(Error));        
  });

*/

module.exports = router;
