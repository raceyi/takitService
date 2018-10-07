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

    let failed_msg=constructOrderMsg(order,shopInfo);
    let failed_subject=shopInfo.shopName+" 주문번호 "+order.orderNO;
    //console.log("order.orderedTime:"+order.orderedTime);
    // Please fix it later
    let orderedTime=new Date();
    console.log("orderedTime:"+orderedTime.toString());
    let orderTime= orderedTime.getHours()+":"+
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

    let msg=shopInfo.shopName +"고객님 주문이 완료되었습니다.\n\
▶주문번호:"+order.orderNO+"\n\
▶상품명:"+order.orderName+"\n\
     "+orderList+"\n\
▶결제 금액:"+order.amount+"\n\
▶주문시간:"+orderTime+"\n\
-----------영수증---------\n\
결제 방법:"+paymentType+"\n\
상호:"+shopInfo.shopName+"\n\
주소:"+shopInfo.address+"\n\
순매출  "+order.amount+"\n\
부가세  "+tax+"\n\
매출합계 "+order.amount+"\n\
카드번호:"+cardNO+"\n\
카드사명:"+cardName+"\n\
승인번호:"+order.cardApprovalNO+"\n\
결제금액:"+order.amount+"\n";
    console.log("msg:"+msg);
    unirest.post ("http://api.apistore.co.kr/kko/1/msg/takit")
    .header("x-waple-authorization", "ODM3NC0xNTI2OTk1NTk0NjA5LWVkYTA2YzM4LTg3MDItNGM1Ni1hMDZjLTM4ODcwMmZjNTY4OA==")
    .field("phone", phone)
    .field("callback",config.kakaoSender)
    .field("msg" , msg)
    .field("template_code", "order2")
    .field("failed_type", "LMS")
    .field("failed_subject",failed_subject)
    .field("failed_msg",failed_msg)
    .field("apiVersion", "1")
    .field("client_id", "takit")
    .field("STORE", shopInfo.shopName)
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
    let failed_msg=constructOrderMsg(order,shopInfo);
    let failed_subject=shopInfo.shopName+" 주문번호:"+order.orderNO;
    let orderTime=order.orderedTime.substr(0,4)+"/"+
            order.orderedTime.substr(5,2)+"/"+
            order.orderedTime.substr(8,2)+" "+
            order.orderedtime.substr(11,5);
    let orderListObj;
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
    if(order.receiptIssue==1){
        receiptIssue="발급";
        receiptId=order.receiptId;
    }else{ 
        receiptIssue="미발급";
        receiptId=order.receiptId;
    }
    let msg=shopInfo.shopName+" 고객님 주문이 완료되었습니다.\n\
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

    unirest.post ("http://api.apistore.co.kr/kko/1/msg/takit")
    .header("x-waple-authorization", "ODM3NC0xNTI2OTk1NTk0NjA5LWVkYTA2YzM4LTg3MDItNGM1Ni1hMDZjLTM4ODcwMmZjNTY4OA==")
    .field("phone", phone)
    .field("callback",config.kakaoSender)
    .field("msg" ,msg) 
    .field("template_code", "cash")
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

router.sendOrderInfo=function(order,shopInfo,callback){
    let failed_msg=constructOrderMsg(order,shopInfo);
    let failed_subject=shopInfo.shopName+" 주문번호:"+order.orderNO;
    if(order.paymentType=="card"){

    }else if(order.paymentType=="cash"){
        
    }else{
        callback("invalidPaymentType");
    }    

}

module.exports = router;
