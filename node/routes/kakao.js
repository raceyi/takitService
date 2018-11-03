let express = require('express');
var unirest = require('unirest');
let router = express.Router();
let config = require('../config');

smartroResultParser=function(result){
      console.log("smartroResultParser:"+JSON.stringify(result));
       let output={
            shopName:result.extras.shopName,
            address:result.extras.shopAddress,

            approvalTime: result.extras.approvaldate, // 2018 08 25 19 24 50

            cardNO:result.extras.cardno,
            cardName: result.extras.issuername,
            approvalNO: result.extras.approvalno,
            amount: result.extras.totalamount
            };
        return output;            
}

router.sendCardOrderMsg=function(order,shopInfo,phone,callback){

 //Just for testing
//  callback(null,"success");  //반드시 호출해야만 한다.
//  return;
let msg,failed_msg,failed_subject,template_code;

console.log("order.orderNameEn:"+order.orderNameEn);

if(order.orderNameEn==null || !order.orderNameEn || (order.orderNameEn && order.orderNameEn.length==0)){
    template_code="order2";
    failed_msg=constructOrderMsg(order,shopInfo);
    failed_subject=shopInfo.shopName+" 주문번호 "+order.orderNO;
    //console.log("order.orderedTime:"+order.orderedTime);
    // Please fix it later
    let orderedTime=new Date();
    console.log("orderedTime:"+orderedTime.toString());
    orderTime= orderedTime.getHours()+":"+
                   orderedTime.getMinutes(); 
    let orderListObj=JSON.parse(order.orderList);
    let orderList="";
    orderListObj.forEach(menu=>{
                      orderList+=menu.menuName+" "+menu.quantity+"개\n";
                          menu.options.forEach((option)=>{
                              orderList+=option.name+"x"+option.number;
                              if(option.select!==undefined)
                                  orderList+=" "+option.select;
                              orderList+=" +"+option.price*option.number+"\n";
                          });
                      });

    let paymentType="카드";
    let tax=Math.round(order.amount/11);
    let netAmount=order.amount-tax;

    let output=smartroResultParser(JSON.parse(order.cardPayment));
    let cardNO=output.cardNO;
    let cardName=output.cardName;

    console.log("callback:"+config.kakaoSender);
    console.log("failed_subject:"+failed_subject);
    console.log("failed_msg:"+failed_msg);

    msg=shopInfo.shopName +"고객님 주문이 완료되었습니다.\n\
▶주문번호:"+order.orderNO+"\n\
▶상품명:"+order.orderName+"\n\
     "+orderList+"\n\
▶결제 금액:"+order.amount+"\n\
▶주문시간:"+orderTime+"\n\
-----------영수증---------\n\
결제 방법:"+paymentType+"\n\
상호:"+shopInfo.shopName+"\n\
주소:"+shopInfo.address+"\n\
순매출  "+netAmount+"\n\
부가세  "+tax+"\n\
매출합계 "+order.amount+"\n\
카드번호:"+cardNO+"\n\
카드사명:"+cardName+"\n\
승인번호:"+order.cardApprovalNO+"\n\
결제금액:"+order.amount+"\n";
    console.log("msg:"+msg);
}else{ // 영문주문임
    template_code="order2E";
    failed_msg=constructOrderMsgEn(order,shopInfo);
    failed_subject=shopInfo.shopName+" order number "+order.orderNO;
    //console.log("order.orderedTime:"+order.orderedTime);
    // Please fix it later
    let orderedTime=new Date();
    console.log("orderedTime:"+orderedTime.toString());
    let orderTime= orderedTime.getHours()+":"+
                   orderedTime.getMinutes();
    let orderListObj=JSON.parse(order.orderList);
    let orderList="";
    orderListObj.forEach(menu=>{
                      orderList+=menu.menuNameEn+" "+menu.quantity+"unit \n";
                          menu.optionsEn.forEach((option)=>{
                              orderList+=option.name+"x"+option.number;
                              if(option.select!==undefined)
                                  orderList+=" "+option.select;
                              orderList+=" +"+option.price*option.number+"\n";
                          });
                      });

    let paymentType="card";
    let tax=Math.round(order.amount/11);
    let netAmount=order.amount-tax;

    let output=smartroResultParser(JSON.parse(order.cardPayment));
    let cardNO=output.cardNO;
    let cardName=output.cardName;

    console.log("callback:"+config.kakaoSender);
    console.log("failed_subject:"+failed_subject);
    console.log("failed_msg:"+failed_msg);

    msg=shopInfo.shopName +" Your order is delivered.\n\
▶Order number:"+order.orderNO+"\n\
▶Order list :"+order.orderNameEn+"\n\
     "+orderList+"\n\
▶Amount:"+order.amount+"\n\
▶Order Time:"+orderTime+"\n\
-----------receipt---------\n\
payment :"+paymentType+"\n\
Shop name:"+shopInfo.shopName+"\n\
Shop address:"+shopInfo.address+"\n\
net sales: "+netAmount+"\n\
tax:"+tax+"\n\
sales:"+order.amount+"\n\
card number:"+cardNO+"\n\
card name:"+cardName+"\n\
approval number:"+order.cardApprovalNO+"\n\
amount :"+order.amount+"\n";
    console.log("template_code:"+template_code);
    console.log("msg:"+msg);
}
    console.log("phone:"+phone);
    unirest.post ("http://api.apistore.co.kr/kko/1/msg/takit")
    .header("x-waple-authorization", "ODM3NC0xNTI2OTk1NTk0NjA5LWVkYTA2YzM4LTg3MDItNGM1Ni1hMDZjLTM4ODcwMmZjNTY4OA==")
    .field("phone", phone)
    .field("callback",config.kakaoSender)
    .field("msg" , msg)
    .field("template_code", template_code)
    .field("failed_type", "LMS")
    .field("failed_subject",failed_subject)
    .field("failed_msg",failed_msg)
    .field("apiVersion", "1")
    .field("client_id", "takit")
    .end(function(response){
        console.log(response.body);
        if(typeof response.body === 'string'){ 
          let responseObj=JSON.parse(response.body);
          if(responseObj.result_code==200)
            callback(null,"success");  //반드시 호출해야만 한다. 
          else
            callback(responseObj.result_message);
        }
    });
}

router.sendCashOrderMsg=function(order,shopInfo,phone,callback){
let msg,failed_msg,failed_subject;
let template_code="cash";

     console.log("[sendCashOrderMsg]order.orderNameEn:"+order.orderNameEn);
     console.log("[sendCashOrderMsg]phone:"+phone);

if(order.orderNameEn==null || !order.orderNameEn || (order.orderNameEn && order.orderNameEn.length==0)){
    failed_msg=constructOrderMsg(order,shopInfo);
    failed_subject=shopInfo.shopName+" 주문번호:"+order.orderNO;
    let orderTime=order.orderedTime.substr(0,4)+"/"+
            order.orderedTime.substr(5,2)+"/"+
            order.orderedTime.substr(8,2)+" "+
            order.orderedTime.substr(11,5);
    let orderListObj=JSON.parse(order.orderList);
    let orderList="";
    orderListObj.forEach(menu=>{
                      orderList+=menu.menuName+" "+menu.quantity+"개\n";
                          menu.options.forEach((option)=>{
                              orderList+=option.name+"x"+option.number;
                              if(option.select!==undefined)
                                  orderList+=" "+option.select;
                              orderList+="+"+option.price*option.number+"\n";
                          });
                      });

    let paymentType="현금";
    let tax=Math.round(order.amount/11);
    let netAmount=order.amount-tax;
    let receiptIssue;
    let receiptId;

    console.log("order:"+JSON.stringify(order.receiptIssue));
    console.log("order.receiptIssue:"+order.receiptIssue);
    if(order.receiptIssue==1){
        receiptIssue="발급";
        receiptId=order.receiptId;
    }else{ 
        receiptIssue="미발급";
        receiptId="없음";
    }
    msg=shopInfo.shopName+" 고객님 주문이 완료되었습니다.\n\
▶주문번호:"+ order.orderNO+"\n\
▶상품명:"+ order.orderName+"\n\
     "+orderList+"\n\
▶결제 금액:"+ order.amount+"\n\
▶주문시간:"+orderTime+"\n\
-----------영수증---------\n\
결제 방법:"+paymentType+"\n\
상호:"+shopInfo.shopName+"\n\
주소:"+shopInfo.address+"\n\
순매출  "+netAmount+"\n\
부가세  "+tax+"\n\
매출합계 "+order.amount+"\n\
현금영수증 발급 "+receiptIssue+"\n\
발급번호:"+ receiptId+"\n";
}else{ //영문 
    failed_msg=constructOrderMsgEn(order,shopInfo);
    failed_subject=shopInfo.shopName+" Order number "+order.orderNO;
    template_code="cashE";
    let orderTime=order.orderedTime.substr(0,4)+"/"+
            order.orderedTime.substr(5,2)+"/"+
            order.orderedTime.substr(8,2)+" "+
            order.orderedTime.substr(11,5);
    let orderListObj=JSON.parse(order.orderList);
    let orderList="";
    orderListObj.forEach(menu=>{
                      orderList+=menu.menuNameEn+" "+menu.quantity+"unit\n";
                          menu.optionsEn.forEach((option)=>{
                              orderList+=option.name+"x"+option.number;
                              if(option.select!==undefined)
                                  orderList+=" "+option.select;
                              orderList+="+"+option.price*option.number+"\n";
                          });
                      });

    let paymentType="cash";
    let tax=Math.round(order.amount/11);
    let netAmount=order.amount-tax;
    let receiptIssue;
    let receiptId;
    if(order.receiptIssue==1){
        receiptIssue="Y";
        receiptId=order.receiptId;
    }else{
        receiptIssue="N";
        receiptId="none";
    }
    msg=shopInfo.shopName+"Your order is delivered.\n\
▶Order number:"+ order.orderNO+"\n\
▶Order list:"+ order.orderNameEn+"\n\
     "+orderList+"\n\
▶Amount:"+ order.amount+"\n\
▶Order Time:"+orderTime+"\n\
-----------receipt---------\n\
payment:"+paymentType+"\n\
Shop name: "+shopInfo.shopName+"\n\
Shop address:"+shopInfo.address+"\n\
net sales: "+netAmount+"\n\
tax:"+tax+"\n\
sales:"+order.amount+"\n\
Cash receipt issue:"+receiptIssue+"\n\
Cash receipt Id :"+ receiptId+"\n";
}
console.log("msg:"+msg);
    unirest.post ("http://api.apistore.co.kr/kko/1/msg/takit")
    .header("x-waple-authorization", "ODM3NC0xNTI2OTk1NTk0NjA5LWVkYTA2YzM4LTg3MDItNGM1Ni1hMDZjLTM4ODcwMmZjNTY4OA==")
    .field("phone", phone)
    .field("callback",config.kakaoSender)
    .field("msg" ,msg) 
    .field("template_code", template_code)
    .field("failed_type", "LMS")
    .field("failed_subject",failed_subject)
    .field("failed_msg",failed_msg)
    .field("apiVersion", "1")
    .field("client_id", "takit")
    .end(function(response){
        console.log(response.body);
        if(typeof response.body === 'string'){
          let responseObj=JSON.parse(response.body);
          if(responseObj.result_code==200)
            callback(null,"success");  //반드시 호출해야만 한다.
          else{
            console.log("kakao msg failed "+JSON.stringify(responseObj.result_message));
            callback(null,"kakao msg failed");
          }
        }
    });
}
                    
constructOrderMsg=function(order,shopInfo){
                      let content= shopInfo.shopName+" 주문번호:"+order.orderNO+"\n";
                      content+=order.orderName+"\n";
                      let orderList=JSON.parse(order.orderList);
                      orderList.forEach(menu=>{
                      content+=menu.menuName+" "+menu.quantity+"개\n";
                          menu.options.forEach((option)=>{
                              content+=option.name+"x"+option.number;
                              if(option.select!==undefined)
                                  content+=" "+option.select+"\n";
                              content+="+"+option.price*option.number+"\n";
                          });
                      });
                      content+=shopInfo.address+"\n";
                      content+="사업자번호:"+shopInfo.businessNumber+"\n";

                      let surtax=Math.round(order.amount/11);
                      let amount=order.amount-surtax;

                      content+="순매출:"+amount+"\n";
                      content+="부가세:"+surtax+"\n";
                      content+="매출합계:"+order.amount+"\n";
                     
                      content+="결제금액:"+order.amount+"\n";
                      if(order.paymentType=="card"){
                          let output=smartroResultParser(JSON.parse(order.cardPayment));
                          let cardNO=output.cardNO;
                          let cardName=output.cardName;
                          content+="카드번호:"+cardNO+"\n";
                          content+=cardName+"\n";
                          content+="승인번호:"+order.cardApprovalNO+"\n";
                      }else{
                          if(order.receiptIssue==1){
                              content+="현금 영수증발급 번호"+order.receiptId; 
                          }
                      }
                      console.log("sendLMS:"+content);
                      return content;

}

constructOrderMsgEn=function(order,shopInfo){
                      let content= shopInfo.shopName+" order number:"+order.orderNO+"\n";
                      content+=order.orderNameEn+"\n";
                      let orderList=JSON.parse(order.orderList);
                      orderList.forEach(menu=>{
                      content+=menu.menuNameEn+" "+menu.quantity+"unit\n";
                          console.log("menu.optionsEn:"+JSON.stringify(menu.optionsEn));
                          menu.optionsEn.forEach((option)=>{
                              content+=option.name+"x"+option.number;
                              if(option.select!==undefined)
                                  content+=" "+option.select+"\n";
                              content+="+"+option.price*option.number+"\n";
                          });
                      });
                      content+=shopInfo.address+"\n";
                      content+="business number:"+shopInfo.businessNumber+"\n";

                      let surtax=Math.round(order.amount/11);
                      let amount=order.amount-surtax;

                      content+="net sales:"+amount+"\n";
                      content+="tax:"+surtax+"\n";
                      content+="sales:"+order.amount+"\n";

                      content+="amount:"+order.amount+"\n";
                      if(order.paymentType=="card"){
                          let output=smartroResultParser(JSON.parse(order.cardPayment));
                          let cardNO=output.cardNO;
                          let cardName=output.cardName;
                          content+="card number:"+cardNO+"\n";
                          content+=cardName+"\n";
                          content+="approval number:"+order.cardApprovalNO+"\n";
                      }else{
                          if(order.receiptIssue==1){
                              content+="cash receipt number "+order.receiptId;
                          }
                      }
                      console.log("sendLMS:"+content);
                      return content;

}

router.sendWaiteeNumber=function(phone,waiteeNumber,length,english){
    console.log("sendWaiteeNumber");
    let failed, failed_subject,template_code,msg;
    if(!english){
        failed_msg="고객님의 웨이티 등록번호는 뒷자리 "+length+"개 "+waiteeNumber+"입니다.\n\
*휴대폰 번호변경시 새로 등록번호를 발급받으시기 바랍니다.";
        failed_subject="웨이티 등록번호";
        template_code="notiNum";
        msg="고객님의 웨이티 등록번호는 뒷자리 "+length+"개 "+waiteeNumber+"입니다.\n\
*휴대폰 번호변경시 새로 등록번호를 발급받으시기 바랍니다.";

    unirest.post ("http://api.apistore.co.kr/kko/1/msg/takit")
    .header("x-waple-authorization", "ODM3NC0xNTI2OTk1NTk0NjA5LWVkYTA2YzM4LTg3MDItNGM1Ni1hMDZjLTM4ODcwMmZjNTY4OA==")
    .field("phone", phone)
    .field("callback",config.kakaoSender)
    .field("msg" ,msg)
    .field("template_code", template_code)
    .field("failed_type", "LMS")
    .field("failed_subject",failed_subject)
    .field("failed_msg",failed_msg)
    .field("apiVersion", "1")
    .field("client_id", "takit")
    .end(function(response){
        console.log(response.body);
    });    
    }
}

module.exports = router;
