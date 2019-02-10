var express = require('express');
var router = express.Router();
var popbill = require('popbill');
let config = require('../config');

/**
* 팝빌 서비스 연동환경 초기화
*/
popbill.config( {

  // 링크아이디
  LinkID :'TAKIT',

  // 비밀키
  SecretKey : config.popbillSecretKey,

  // 연동환경 설정값, 개발용(true), 상업용(false)
  IsTest : false,

  defaultErrorHandler :  function(Error) {
    console.log('Error Occur : [' + Error.code + '] ' + Error.message);
  }
});


/**
* 전자세금계산서 API 서비스 클래스 생성
*/
var taxinvoiceService = popbill.TaxinvoiceService();

/**
* 1건의 세금계산서를 즉시발행 처리합니다.
* - 세금계산서 항목별 정보는 "[전자세금계산서 API 연동매뉴얼]
*   > 4.1. (세금)계산서구성"을 참조하시기 바랍니다.
*/
const takitInfo={
       invoicerCorpNum : '1428800447',
       invoicerCorpName : '타킷주식회사',
       invoicerCEOName : '이경주',
       invoicerAddr : '서울특별시 서초구 강남대로 479,B1층 131호 피치트리랩(반포동,신논현타워)',
       invoicerBizClass : 'IT 서비스',
       invoicerBizType : '통신판매중개업',
       invoicerContactName : '이경주',
       invoicerTEL : '0505-170-3636',
       invoicerHP : '010-2722-8226',
       invoicerEmail : 'kalen.lee@takit.biz',
    };

router.registIssue=function(shopInfo,billInfo,next){

   let date = new Date();

   let month= (date.getMonth()+1)<10?"0"+(date.getMonth()+1):date.getMonth()+1;
   let day  = date.getDate()<10? "0"+date.getDate():date.getDate();

   let hours=date.getHours()<10? '0'+date.getHours():date.getHours();
   let mins=date.getMinutes()<10?'0'+date.getMinutes():date.getMinutes();
   let secs=date.getSeconds()<10?'0'+date.getSeconds():date.getSeconds();
   let milliSecs=(date.getMilliseconds()<100)?( date.getMilliseconds()<10?"00"+date.getMilliseconds():"0"+date.getMilliseconds()):date.getMilliseconds();
 
  // 문서관리번호, 1~24자리 영문,숫자,'-','_' 조합으로 사업자별로 중복되지 않도록 구성
  let mgtKey= date.getFullYear().toString().substr(2,2)+month+day+hours+mins+secs+milliSecs; //문서관리번호,24bytes
  let writeDate= date.getFullYear()+month+day;
  console.log("mgtKey:"+mgtKey);
 
  // 세금계산서 항목
  var Taxinvoice = {

    // [필수] 작성일자, 날짜형식 yyyyMMdd
    writeDate : writeDate,//'20161116',

    // [필수] 과금방향, (정과금, 역과금) 중 기재, 역과금은 역발행의 경우만 가능
    chargeDirection : '정과금',

    // [필수] 발행형태, (정발행, 역발행, 위수탁) 중 기재
    issueType : '정발행',

    // [필수] (영수, 청구) 중 기재
    purposeType : '영수',

    // [필수] 발행시점, (직접발행, 승인시자동발행) 중 기재
    issueTiming : '직접발행',

    // [필수] 과세형태, (과세, 영세, 면세) 중 기재
    taxType : '과세',


    /**************************************************************************
    *                              공급자 정보
    **************************************************************************/

    // [필수] 공급자 사업자번호, '-' 제외 10자리
    invoicerCorpNum : takitInfo.invoicerCorpNum,

    // [정발행시 필수] 문서관리번호, 1~24자리 숫자,영문,'-','_' 조합으로 사업자별로
    invoicerMgtKey : mgtKey,

    // 공급자 종사업장 식별번호, 필요시 기재, 4자리 숫자
    invoicerTaxRegID : '',

    // [필수] 공급자 상호
    invoicerCorpName : takitInfo.invoicerCorpName, 

    // [필수] 대표자 성명
    invoicerCEOName : takitInfo.invoicerCEOName,  

    // 공급자 주소
    invoicerAddr : takitInfo.invoicerAddr ,

    // 공급자 종목
    invoicerBizClass : takitInfo.invoicerBizClass,

    // 공급자 업태
    invoicerBizType : takitInfo.invoicerBizType,

    // 공급자 담당자명
    invoicerContactName : takitInfo.invoicerContactName,

    // 공급자 연락처
    invoicerTEL : takitInfo.invoicerTEL,

    // 공급자 휴대폰번호
    invoicerHP : takitInfo.invoicerHP,

    // 공급자 메일주소
    invoicerEmail : "kalen.lee@takit.biz", //takitInfo.invoicerEmail,

    // 정발행시 알림문자 전송여부
    // - 문자전송지 포인트가 차감되며, 전송실패시 포인트 환불처리됩니다.
    invoicerSMSSendYN : false,


    /**************************************************************************
    *                           공급받는자 정보
    **************************************************************************/

    // [필수] 공급받는자 구분, (사업자, 개인, 외국인) 중 기재
    invoiceeType : '사업자',

    // [필수] 공급받는자 사업자번호, '-'제외 10자리
    invoiceeCorpNum : shopInfo.businessNumber,

    // 공급받는자 종사업장 식별번호, 필요시 기재, 4자리 숫자
    invoiceeTaxRegID : '',

    // [필수] 공급받는자 상호
    invoiceeCorpName : shopInfo.businessName,

    // [필수] 공급받는자 대표자 성명
    invoiceeCEOName : shopInfo.owner,

    // 공급받는자 주소
    invoiceeAddr : shopInfo.address,

    // 공급받는자 이메일 주소
    invoiceeEmail1 : shopInfo.businessEmail,

    // 역발행시 알림문자 전송여부
    // - 문자전송지 포인트가 차감되며, 전송실패시 포인트 환불처리됩니다.
    invoiceeSMSSendYN : false,


    /**************************************************************************
    *                           세금계산서 기재정보
    **************************************************************************/

    // [필수] 공급가액 합계
    supplyCostTotal : billInfo.fee,

    // [필수] 세액합계
    taxTotal : billInfo.tax,

    // [필수] 합계금액 (공급가액 합계 + 세액 합계)
    totalAmount : billInfo.fee+billInfo.tax,

    // 사업자등록증 이미지 첨부여부
    businessLicenseYN : false,

    // 통장사본 이미지 첨부여부
    bankBookYN : false,


    /**************************************************************************
    *                           상세항목(품목) 정보
    **************************************************************************/

    detailList : [
      {
          serialNum : 1,                // 일련번호, 1부터 순차기재
          purchaseDT : writeDate,       // 거래일자, 형식 : yyyyMMdd
          itemName : '수수료',
          spec : '규격',
          qty : '1',                    // 수량, 소수점 2자리까지 기재 가능
          unitCost : billInfo.fee,      //'5000',  // 단가, 소수점 2자리까지 기재 가능
          supplyCost : billInfo.fee,    //'5000',  // 공급가액, 소수점 기재불가, 원단위 이하는 절사하여 표현
          tax : billInfo.tax,           //'500',   // 세액, 소수점 기재불가, 원단위 이하는 절사하여 표현
          remark : '비고'
      }
    ],
    addContactList : [
      {
        // 일련번호, 1부터 순차기재
        serialNum : 1,

        // 담당자명
        contactName : '이경주',

        // 담당자 메일
        email : 'kalen.lee@takit.biz'
      }
    ]
  };

  taxinvoiceService.registIssue(takitInfo.invoicerCorpNum , Taxinvoice,
    function(result) {
      next(null, {code: result.code, message : result.message});
    }, function(Error){
      next(Error, {code : Error.code, message : Error.message});
    });
}

module.exports = router;
