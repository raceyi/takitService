import {Component} from '@angular/core';
import {NavController,App,AlertController} from 'ionic-angular';
import {ConfigProvider} from '../../providers/ConfigProvider';
import 'rxjs/add/operator/map';
//import {Content} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Push,PushNotification} from 'ionic-native';
import {Http,Headers} from '@angular/http';
import {ErrorPage} from '../../pages/error/error';

@Component({
  selector:'page-shoptable',
  templateUrl: 'shoptable.html',
})


export class ShopTablePage {
  Option="today";
  startDate;
  endDate;
  currTime;
  orders=[];
  pushNotification:PushNotification;

  constructor(public navController: NavController,private app:App,private storageProvider:StorageProvider,
      private http:Http,private alertController:AlertController) {
    console.log("ShopTablePage constructor");
    
    this.registerPushService();
    
    var date=new Date();
    var month=date.getMonth()+1;
//  Why initialization of startDate and endDate doesn't work?    
//    this.startDate=date.getFullYear().toString()+'-'+month+'-'+date.getDate();
//    this.endDate=date.getFullYear().toString()+'-'+month+'-'+date.getDate();
    this.currTime=date.getFullYear().toString()+'-'+month+'-'+date.getDate();

    console.log("startDate:"+this.startDate);
    console.log("endDate:"+this.endDate);

     /////////////////////////////////////////////////////////////////
  }

    convertOrderInfo(orderInfo){
          var order:any={};
          order=orderInfo;
          console.log("!!!order:"+JSON.stringify(order));
          //var date=new Date(orderInfo.orderedTime);

          //console.log("local ordered time:"+ date.toLocaleString());//date.toLocaleDateString('ko-KR')
          order.statusString=this.getStatusString(order.orderStatus);
          if(order.orderStatus=="completed")
            order.hidden=true;
          else  
            order.hidden=false;
          order.orderListObj=JSON.parse(order.orderList);
          //console.log("order.orderListObj:"+JSON.stringify(order.orderListObj));
          return order;
    }

     getOrders(lastOrderId){
      return new Promise((resolve,reject)=>{
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log("getOrders-server:"+ ConfigProvider.serverAddress);
        let body;
        if(this.Option!="period"){
              body  = JSON.stringify({  option: this.Option,
                                        takitId:this.storageProvider.myshop.takitId,
                                        lastOrderId:lastOrderId, 
                                        limit:ConfigProvider.OrdersInPage});
        }else{
              console.log("this.startDate:"+this.startDate);

              var startDate=new Date(this.startDate);
              var endDate= new Date(this.endDate);

              body  = JSON.stringify({  option: this.Option,
                                        takitId:this.storageProvider.myshop.takitId,
                                        lastOrderId:lastOrderId, 
                                        limit:ConfigProvider.OrdersInPage,
                                        startTime:startDate.toISOString(), 
                                         endTime:endDate.toISOString()
                                      });
        }
         console.log("body:"+JSON.stringify(body));
         this.http.post(ConfigProvider.serverAddress+"/shop/getOrders",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
            console.log("!!!getOrders-res:"+JSON.stringify(res));
            if(Array.isArray(res.orders)){
              console.log("res.length:"+res.orders.length);
              res.orders.forEach(order=>{
                  this.orders.push(this.convertOrderInfo(order));
                  console.log("orders:"+JSON.stringify(this.orders));
                  resolve();
              });
            }
         },(err)=>{
           console.log("서버와 통신에 문제가 있습니다");
           let alert = this.alertController.create({
                                title: '서버와 통신에 문제가 있습니다',
                                subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                buttons: ['OK']
                            });
                            alert.present();
           reject();
         });
      });
     }


    getStatusString(orderStatus){
      console.log("orderStatus:"+orderStatus);
      if(orderStatus=="paid"){
            return "접수";
      }else if(orderStatus=="cancelled"){
            return "취소";
      }else if(orderStatus=="checked"){
            return "완료";
      }else if(orderStatus=="completed"){
            return "종료";
      }else{
        console.log("invalid orderStatus:"+orderStatus);
        return "미정";
      }
    }


  changeValue(option){
    console.log("changeValue:"+option);
    if(option!="period"){
      //send getOrders request and update orders
        this.orders=[];
        this.getOrders(-1);
    }
  }

  startPicker(startDate){
    console.log("startDate:"+startDate);
  }

  endPicker(endDate){
    console.log("endDate:"+endDate);
  }

  searchPeriod(){
    if(startDate==undefined || endDate==undefined){
      // 시작일과 종료일을 설정해 주시기 바랍니다. 
      return;
    }
    //check the validity of startDate and endDate
    var startDate=new Date(this.startDate);
    var endDate=new Date(this.endDate);
    var currDate=new Date(); 
    console.log(startDate.getTime());
    console.log(endDate.getTime());
    if(startDate.getTime()>endDate.getTime()){
         // 시작일은 종료일보다 늦을수 없습니다.  
         return;
    }
    if(endDate.getTime()>currDate.getTime()){
         return;
         // 종료일은 현재시점보다 늦을수 없습니다.
    }
    // send getOrders request and update orders
    this.orders=[];
    this.getOrders(-1);
  }

  toggleOrder(order){
    console.log("toggleOrder");
     order.hidden=(!order.hidden);
  }

      registerPushService(){ // Please move this code into tabs.ts
            this.pushNotification=Push.init({
                android: {
                    senderID: ConfigProvider.userSenderID,
                },
                ios: {
                    senderID: ConfigProvider.userSenderID,
                    "gcmSandbox": "true",
                    "alert": "true",
                    "badge": "true",
                    "sound": "true"
                },
                windows: {}
            });
                        
            this.pushNotification.on('registration',(response)=>{
              console.log("registration..."+response.registrationId);
              let body = JSON.stringify({registrationId:response.registrationId});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);
              this.http.post(ConfigProvider.serverAddress+"/shop/registrationId",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                  console.log("registrationId sent successfully");
             },(err)=>{
                  console.log("registrationId sent failure");
                  //console.log(JSON.stringify(err));
                  this.storageProvider.errorReasonSet('네트웍 연결이 원할하지 않습니다'); 
                  //Please move into ErrorPage!
                  this.app.getRootNav().setRoot(ErrorPage); 
                });
            });

            this.pushNotification.on('notification',(data:any)=>{
              console.log("!!! shoporder-data:"+JSON.stringify(data));
              console.log("!!! shoporder-data.custom:"+JSON.stringify(data.additionalData.custom));
                if(this.Option!="period" ||(this.Option=="period" && true/* it has today */ )){
                     //Please check if order is new or existing one and then add it or modify it into orders.
                     var incommingOrder=data.additionalData.custom;
                     var i=0;
                     for(;i<this.orders.length;i++){
                            console.log(this.orders[i].orderId+incommingOrder.orderId);
                            if(this.orders[i].orderId == incommingOrder.orderId)
                                  break;
                     }
                     if(i==this.orders.length)
                        this.orders.unshift(this.convertOrderInfo(data.additionalData.custom));
                     //else
                     //   this.orders[i]=this.convertOrderInfo(incommingOrder);   
                     console.log("orders update:"+JSON.stringify(this.orders));
                     //this.focusEmail.emit(true);
                }
                console.log("[shoptable.ts]pushNotification.on-data:"+JSON.stringify(data));
                console.log("first view name:"+this.navController.first().name);
                console.log("active view name:"+this.navController.getActive().name);
                console.log("active view name:"+this.navController.last().name);
                /*
                console.log(data.message);
                console.log(data.title);
                console.log(data.count);
                console.log(data.sound);
                console.log(data.image);
                console.log(data.additionalData);
                */
            });

            this.pushNotification.on('error', (e)=>{
                console.log(e.message);
            });
    }

    updateOrder(order){
        if(order.orderStatus=="paid"){
               this.updateStatus(order,"checkOrder").then(()=>{
                 order.orderStatus="checked";
                 order.statusString="완료"; 
               },()=>{
                 console.log("주문 접수에 실패했습니다.");
                 //give Alert here
                 let alert = this.alertController.create({
                                title: '주문 접수에 실패했습니다.',
                                buttons: ['OK']
                            });
                  alert.present();
               });
        }else if(order.orderStatus=="checked"){
               this.updateStatus(order,"completeOrder").then(()=>{
                 order.orderStatus="completed";
                 order.statusString="종료"; 
               },()=>{
                 console.log("주문 완료에 실패했습니다.");
                 let alert = this.alertController.create({
                                title: '주문 완료에 실패했습니다.',
                                buttons: ['OK']
                            });
                  alert.present();
               });;
        }
    }

    cancelOrder(order){
      return new Promise((resolve,reject)=>{
        var cancelReason="This is test";
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        let body= JSON.stringify({ orderId: order.orderId,cancelReason:cancelReason});

        console.log("body:"+JSON.stringify(body));
        this.http.post(ConfigProvider.serverAddress+"/shop/cancelOrder",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
            console.log("res:"+JSON.stringify(res));
            if(res.result=="success"){
                resolve();
            }else{
                reject();
            }
         },(err)=>{
           console.log("서버와 통신에 문제가 있습니다");
           let alert = this.alertController.create({
                                title: '서버와 통신에 문제가 있습니다',
                                subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                buttons: ['OK']
                            });
           alert.present();
         });
      });
    }

    cancel(order){
        this.cancelOrder(order).then((result)=>{
          console.log("cancel-order result:"+result);
        },(err)=>{
          console.log("cancel-order err:"+err);
        });
    }
    updateStatus(order,request){
      return new Promise((resolve,reject)=>{
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log(request+"-server:"+ ConfigProvider.serverAddress);
        let body= JSON.stringify({ orderId: order.orderId });

        console.log("body:"+JSON.stringify(body));
        this.http.post(ConfigProvider.serverAddress+"/shop/"+request,body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
            console.log(request+"-res:"+JSON.stringify(res));
            if(res.result=="success"){
                 order.orderStatus="cancelled";
                 order.statusString="취소"; 
                resolve("주문취소에 성공했습니다");
            }else{
                resolve("주문취소에 실패했습니다");
                let alert = this.alertController.create({
                                title: '주문취소에 실패했습니다',
                                buttons: ['OK']
                            });
                alert.present();
            }
         },(err)=>{
           console.log("서버와 통신에 문제가 있습니다");
           reject("서버와 통신에 문제가 있습니다");
           let alert = this.alertController.create({
                                title: '서버와 통신에 문제가 있습니다',
                                subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                buttons: ['OK']
                            });
            alert.present();
         });
      });
     }
}
