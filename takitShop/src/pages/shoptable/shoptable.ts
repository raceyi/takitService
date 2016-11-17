import {Component,EventEmitter,NgZone} from '@angular/core';
import {NavController,App,AlertController,Platform} from 'ionic-angular';
import {ConfigProvider} from '../../providers/ConfigProvider';
import 'rxjs/add/operator/map';
//import {Content} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Push,PushNotification} from 'ionic-native';
import {Http,Headers} from '@angular/http';
import {ErrorPage} from '../../pages/error/error';
import {Splashscreen} from 'ionic-native';
import {PrinterProvider} from '../../providers/printerProvider';

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
  infiniteScroll:any=undefined;

  constructor(public navController: NavController,private app:App,private storageProvider:StorageProvider,
      private http:Http,private alertController:AlertController,private ngZone:NgZone,
      private printerProvider:PrinterProvider,private platform:Platform) {
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

    this.getOrders(-1);
     /////////////////////////////////////////////////////////////////
  }

    ionViewDidEnter(){
        console.log("SelectorPage did enter");
        Splashscreen.hide();
  }

    convertOrderInfo(orderInfo){
          var order:any={};
          order=orderInfo;
          console.log("!!!order:"+JSON.stringify(order));
          //var date=new Date(orderInfo.orderedTime);

          //console.log("local ordered time:"+ date.toLocaleString());//date.toLocaleDateString('ko-KR')
          order.statusString=this.getStatusString(order.orderStatus);
          if(order.orderStatus=="completed" || order.orderStatus=="cancelled")
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
            var result:string=res.result;
            if(result==="success" &&Array.isArray(res.orders)){
              console.log("res.length:"+res.orders.length);
              res.orders.forEach(order=>{
                  this.orders.push(this.convertOrderInfo(order));
                  console.log("orders:"+JSON.stringify(this.orders));
              });
              resolve(true);
            }else if(res.orders=="0" || result==="failure"){ //Please check if it works or not
              console.log("no more orders");
              resolve(false);
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
    this.orders=[];
    if(this.infiniteScroll!=undefined)
        this.infiniteScroll.enable(true);

    if(option!="period"){
        this.getOrders(-1);
    }else{
        // user select search button
    }
  }

  startPicker(startDate){
    console.log("startDate:"+startDate);
  }

  endPicker(endDate){
    console.log("endDate:"+endDate);
  }

  searchPeriod(){
    if(this.startDate==undefined || this.endDate==undefined){
      // 시작일과 종료일을 설정해 주시기 바랍니다. 
      let alert = this.alertController.create({
                    title: '시작일과 종료일을 설정해 주시기 바랍니다',
                    buttons: ['OK']
                });
                alert.present();
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
          let alert = this.alertController.create({
              title: '시작일은 종료일보다 늦을수 없습니다',
              buttons: ['OK']
          });
          alert.present();
         return;
    }
    if(endDate.getTime()>currDate.getTime()){
         // 시작일은 종료일보다 늦을수 없습니다.  
          let alert = this.alertController.create({
              title: '종료일은 현재시점보다 늦을수 없습니다.',
              buttons: ['OK']
          });
          alert.present();
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

    confirmMsgDelivery(messageId){
        return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("messageId:"+messageId);
            console.log("!!!server:"+ ConfigProvider.serverAddress);
            let body = JSON.stringify({messageId:messageId});

            this.http.post(encodeURI(ConfigProvider.serverAddress+"/successGCM"),body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                  console.log("res:"+JSON.stringify(res));
                  resolve();
            },(err)=>{
                reject("http error");  
            });
      });   
    }
    
    printOrder(order){
      if(!this.platform.is("android")){ //Not yet supported
        return;
      }
      var title,message="";

      if(order.orderStatus=="paid"){
          title="주문["+order.orderNO+"]";
          if(order.takeout!='0')          
            title+="Takeout";
          order.orderListObj.menus.forEach((menu)=>{
              message+="-------------\n";
              message+=" "+menu.menuName+"("+menu.quantity+")\n"; 
              menu.options.forEach((option)=>{
                message+=" "+option.name;
                if(option.select!=undefined){
                  message+="("+option.select+")";
                }
                message+="\n";
              });
              
          });
      }else if(order.orderStatus=="cancelled"){
          title="**주문취소["+order.orderNO+"]";
          order.orderListObj.menus.forEach((menu)=>{
              message+="-------------\n";
              message+=" "+menu.menuName+"("+menu.quantity+")\n"; 
              menu.options.forEach((option)=>{
                message+=" "+option.name;
                if(option.select!=undefined){
                   message+="("+option.select+")";
                }
                message+="\n";
              });
          });
      }else
        return;

      this.printerProvider.print(title,message).then(()=>{
             console.log("print successfully");
      },()=>{
            let alert = this.alertController.create({
              title: '주문출력에 실패했습니다.',
              subTitle: '프린터상태를 확인해주시기바랍니다.',
              buttons: ['OK']
          });
          alert.present();
      });
    }

      registerPushService(){ // Please move this code into tabs.ts
            this.pushNotification=Push.init({
                android: {
                    //forceShow: true, // Is it necessary?vibration
                    senderID: ConfigProvider.userSenderID                },
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
              var platform;
              if(this.platform.is("android")){
                  platform="android";
              }else if(this.platform.is("ios")){
                  platform="ios";
              }else{
                  platform="unknown";
              }
              let body = JSON.stringify({registrationId:response.registrationId,takitId:this.storageProvider.myshop.takitId,platform:platform});
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
                    var additionalData:any=data.additionalData;
                    console.log("additionalData");
                    if(additionalData.GCMType==="order"){
                      console.log("order is comming "+data.additionalData.custom);
                       this.ngZone.run(()=>{
                        var incommingOrder=data.additionalData.custom;
                        console.log("incommingOrder:"+ incommingOrder);
                        var i=0;
                        for(;i<this.orders.length;i++){
                                console.log(this.orders[i].orderId+incommingOrder.orderId);
                                if(this.orders[i].orderId == incommingOrder.orderId)
                                      break;
                        }
                        if(i==this.orders.length){
                            var newOrder=this.convertOrderInfo(incommingOrder);
                            this.orders.unshift(newOrder);
                            if(newOrder.orderStatus=="paid"){
                                  this.printOrder(newOrder);
                            }
                        }else{
                           this.orders[i]=this.convertOrderInfo(incommingOrder);   
                           if(this.orders[i].orderStatus=="cancelled"){
                                  this.printOrder(this.orders[i]);
                           }
                        }
                        console.log("orders update:"+JSON.stringify(this.orders));
                       });
                    }
                      this.confirmMsgDelivery(additionalData.notId).then(()=>{
                            console.log("confirmMsgDelivery success");
                      },(err)=>{
                          let alert = this.alertController.create({
                              title: "서버와 통신에 문제가 있습니다.",
                              buttons: ['OK']
                          });
                          alert.present();
                      });
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

     doInfinite(infiniteScroll){
        var lastOrderId=this.orders[this.orders.length-1].orderId;
        this.getOrders(lastOrderId).then((more)=>{
          if(more)
              infiniteScroll.complete();
          else{
              infiniteScroll.enable(false); //stop infinite scroll
              this.infiniteScroll=infiniteScroll;
          }
        });
     }


     getOrderColor(order){
       if(order.orderStatus==='completed'){
          return 'gray';
       }else{
         return 'primary';
       }
     }

  AfterOnedayComplete(order){
    if(order.completedTime!=undefined){
        let completedTime=new Date(order.completedTime+" GMT");
        let now=new Date();
        //console.log("now:"+now.getTime());
        //console.log(" completedTime:"+(completedTime.getTime()+ 24*60*60*1000));
        if(now.getTime()>(completedTime.getTime()+24*60*60*1000)){
            //console.log("orderNo:"+order.orderNO +" hide is true ");
            return true;
        }
    }
    //console.log("order hide is false");
    return false;  
  }

  update(){
    /*
    if(  ){

    }else{

    }*/
  }
}
