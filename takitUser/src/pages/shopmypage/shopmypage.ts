import {Component,NgZone} from "@angular/core";
import {NavController,NavParams,AlertController} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ServerProvider} from '../../providers/serverProvider';

declare var cordova:any;

@Component({
    selector:'page-shopmypage', 
    templateUrl: 'shopmypage.html',
})

export class ShopMyPage{

     shopname:string;
     myPageMenu:string;
     shopInfo;
     //items = [];
     orders=[];
     messageEmitterSubscription;
     infiniteScroll:any;

     constructor(private http:Http, private navController: NavController, 
          private navParams: NavParams,public storageProvider:StorageProvider,
          private alertController:AlertController, private ngZone:NgZone,
          private serverProvider:ServerProvider){
	      console.log("ShopMyPage constructor");
        this.myPageMenu="orderHistory";
        this.shopname=this.storageProvider.currentShopname();
        
        
        this.messageEmitterSubscription= this.storageProvider.messageEmitter.subscribe((order)=> {
                console.log("[ShopMyPage]message comes "+JSON.stringify(order)); 
                console.log("order.orderId:"+order.orderId);
                this.ngZone.run(()=>{
                    var i;
                    for(i=0;i<this.storageProvider.OrdersInPage && i<this.orders.length;i++){  // if new order comes, add it at the front. otherwise, cange status.
                      //console.log(" "+ this.orders[i].orderId+" "+order.orderId);
                        if(parseInt(this.orders[i].orderId)==parseInt(order.orderId) && this.orders[i].orderStatus!=order.orderStatus){
                              //update order statusString
                              this.orders[i].orderStatus=order.orderStatus;
                              this.orders[i].statusString=this.getStatusString(order.orderStatus);
                              console.log("orderId are same");
                              break;
                        }
                    }
                    if(i==this.storageProvider.OrdersInPage || i==this.orders.length){// new one
                        console.log("add new one at the front");
                        this.orders.unshift(this.convertOrderInfo(order)); 
                    }
                });
        });
        
     }

    ionViewDidEnter(){
        console.log("ionViewDidEnter");
        if(this.orders.length==0){
            this.getOrders(-1,false);
        }else{
            //check the orders and reset it if necessary.
            this.getOrders(-1,true).then((res:any)=>{
                if( typeof res ==='object'){
                    this.orders=[];
                        res.orders.forEach(order=>{
                        console.log("order.ordrId:"+order.orderId);
                        this.orders.push(this.convertOrderInfo(order));
                        //console.log("orders:"+JSON.stringify(this.orders));
                    });
                    if(this.infiniteScroll!=undefined){
                        this.infiniteScroll.enable(true);
                        this.infiniteScroll.complete();      
                    }
                }
            },err=>{

            });
        }
    }

      getStatusString(orderStatus){
        console.log("orderStatus:"+orderStatus);
        if(orderStatus=="paid"){
              return "결제";
        }else if(orderStatus=="cancelled"){
              return "취소";
        }else if(orderStatus=="checked"){
              return "접수";
        }else if(orderStatus=="completed"){
              return "완료";
        }else{
          console.log("invalid orderStatus:"+orderStatus);
          return "미정";
        }
      }

      convertOrderInfo(orderInfo){
            var order:any={};
            order=orderInfo;
            console.log("!!!order:"+JSON.stringify(order));
            /*
            var date=new Date(orderInfo.localOrderedTime);
            var day=date.getMonth()+1;
            console.log("day:"+day);
            */
            // localOrderedTime format: '2016-10-12 05:28:02'
            order.orderedDateString=order.localOrderedTime.substring(0,10);
            order.orderedTimeString=order.localOrderedTime.substring(11);
            console.log("!!!orderedTimeString:"+order.orderedTimeString);
            order.statusString=this.getStatusString(order.orderStatus);
            if(order.orderStatus=="paid"){
              order.cancel=true;
              order.hidden=false;
            }else{
              order.cancel=false;
              order.hidden=true;
            }
            order.orderListObj=JSON.parse(order.orderList);
            console.log("order.orderListObj:"+JSON.stringify(order.orderListObj));
            return order;
      }

     getOrders(lastOrderId,compare){
      return new Promise((resolve,reject)=>{
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log("server:"+ this.storageProvider.serverAddress);
        let body  = JSON.stringify({    takitId:this.storageProvider.takitId,
                                        lastOrderId:lastOrderId, 
                                        limit:this.storageProvider.OrdersInPage});
        console.log("getOrders:"+body);
        this.serverProvider.post(this.storageProvider.serverAddress+"/getOrders",body).then((res:any)=>{
            //console.log("getOrders-res:"+JSON.stringify(res));
            var result:string=res.result;
            if(result=="success" && Array.isArray(res.orders)){
                if(compare==true){
                    for(var i=0;i<this.orders.length && i< this.storageProvider.OrdersInPage;i++){
                        if(this.orders[i].orderId!=res.orders[i].orderId){
                            //reset order list and return;
                            resolve(res); // please reset order list 
                        }else{ //update order 
                            this.orders[i]=this.convertOrderInfo(res.orders[i]);
                            resolve(false); // just update order list
                        }
                    }
                    return;
                }
                res.orders.forEach(order=>{
                    console.log("order.ordrId:"+order.orderId);
                    this.orders.push(this.convertOrderInfo(order));
                    //console.log("orders:"+JSON.stringify(this.orders));
                });
                resolve(true);
            }else if(res.orders=="0"){ //Please check if it works or not
                console.log("no more orders");
                resolve(false);
            }else{
                console.log("What happen? !!!sw bug!!!");
            }
         },(err)=>{
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

     doInfinite(infiniteScroll) {
        console.log('Begin async operation');
        var lastOrderId=this.orders[this.orders.length-1].orderId;
        this.getOrders(lastOrderId,false).then((more)=>{
          if(more){
              console.log("more is true");
              infiniteScroll.complete();
          }else{
              console.log("more is false");
              infiniteScroll.enable(false); //stop infinite scroll
              this.infiniteScroll=infiniteScroll;
          }
        });
     }

      historySelect(){
        this.myPageMenu="orderHistory";
      }

      couponSelect(){
        this.myPageMenu="couponHistory";
      }

      cancelOrder(order){
        console.log("cancel order:"+JSON.stringify(order));
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        console.log("server:"+ this.storageProvider.serverAddress);
        let body  = JSON.stringify({ orderId:order.orderId,
                                     cancelReason:"",
                                     cashId:this.storageProvider.cashId});
         
         this.serverProvider.post(this.storageProvider.serverAddress+"/cancelOrder",body).then((res:any)=>{
            console.log("cancelOrder-res:"+JSON.stringify(res));
            var result:string=res.result;
            if(result==="success"){
                this.storageProvider.cashInfoUpdateEmitter.emit("all");
                let alert = this.alertController.create({
                    title: '주문 취소가 정상 처리 되었습니다.',
                    buttons: ['OK']
                });
                alert.present();
              //update order status
              this.ngZone.run(()=>{
                var i;
                for(i=0;i<this.orders.length;i++){
                    if(this.orders[i].orderId==order.orderId){
                        this.orders[i].orderStatus="cancelled";  
                        this.orders[i].statusString=this.getStatusString("cancelled");
                        break;
                    }
                }
              });
                this.serverProvider.orderNoti().then((orders:any)=>{
                        if(orders==undefined || orders==null || orders.length==0){
                           // off run_in_background 
                           console.log("no more order in progress within 24 hours");
                           this.storageProvider.order_in_progress_24hours=false;   
                           this.storageProvider.tabMessageEmitter.emit("stopEnsureNoti");                         
                        }
                },(err)=>{
                    if(err=="NetworkFailure"){
                        let alert = this.alertController.create({
                                    title: "서버와 통신에 문제가 있습니다.",
                                    buttons: ['OK']
                                });
                                alert.present();
                    }else{
                        console.log("orderNotiMode error");
                    } 
                });

            }else{
              //Please give user a notification
              let alert = this.alertController.create({
                    title: '주문취소에 실패했습니다.',
                    subTitle: '주문 상태를 확인해 주시기바랍니다',
                    buttons: ['OK']
                });
                alert.present();
            }
         },(err)=>{
           let alert = this.alertController.create({
                title: '서버와 통신에 문제가 있습니다',
                subTitle: '네트웍상태를 확인해 주시기바랍니다',
                buttons: ['OK']
            });
            alert.present();
         });
      }

      toggleOrder(order){
        order.hidden=(!order.hidden);
      }

      ionViewWillUnload(){
          console.log("ionViewWillUnload-ShopMyPage");
           if(this.messageEmitterSubscription) {
              this.messageEmitterSubscription.unsubscribe();
           }
     }

     refresh(){
            // refresh status of orders at front 
            console.log("refresh orders");
     }
/*
    update(){
        console.log("update");
        this.orders=[];
        if(this.infiniteScroll!=undefined)
            this.infiniteScroll.enable(true);
        this.getOrders(-1);
    }
*/    
}
