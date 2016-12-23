import {Component,EventEmitter,NgZone} from '@angular/core'

import {HomePage} from '../home/home';
import {CashPage} from '../cash/cash';
import {SearchPage} from '../search/search';
import {CashConfirmPage} from '../cashconfirm/cashconfirm';
import {ErrorPage} from '../error/error';
import {Platform,IonicApp,MenuController} from 'ionic-angular';
import {ViewController,App,NavController,AlertController,ModalController} from 'ionic-angular';
import {Push,PushNotification} from 'ionic-native';
import {Http,Headers} from '@angular/http';
import {StorageProvider} from '../../providers/storageProvider';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {ServerProvider} from '../../providers/serverProvider';

import 'rxjs/add/operator/timeout';
import 'rxjs/add/operator/map';

declare var cordova:any;

@Component({
  templateUrl: 'tabs.html',
  selector:'page-tabs'  
})
export class TabsPage {

  public tabCash: any;
  public tabHome: any;
  public tabSearch: any;

  pushNotification:PushNotification;
  askExitAlert:any;

  constructor(public modalCtrl: ModalController,private navController: NavController,private app:App,private platform:Platform,public viewCtrl: ViewController,
    public storageProvider:StorageProvider,private http:Http, private alertController:AlertController,private ionicApp: IonicApp,
    private menuCtrl: MenuController,public ngZone:NgZone,private serverProvider:ServerProvider) {
    // this tells the tabs component which Pages
    // should be each tab's root Page
    this.tabHome = HomePage;
    this.tabSearch = SearchPage;
    this.tabCash = CashPage;
    //Please login and then do registration for gcm msg
    // and then move into home page
    if(this.storageProvider.tourMode==false){
        this.registerPushService(); 
    }
  }

 ionViewDidLoad(){ 
  //get discount rate of each shoptab
  this.storageProvider.shoplist.forEach(shop=>{
      let body = JSON.stringify({takitId:shop.takitId});
      console.log("request discount rate of "+shop.takitId);
        this.serverProvider.post(ConfigProvider.serverAddress+"/getDiscountRate",body).then((res:any)=>{
            console.log("getDiscountRate-res:"+JSON.stringify(res));
            if(res.result=="success"){
                shop.discountRate=res.discountRate;
                console.log("shopinfo:"+JSON.stringify(this.storageProvider.shoplist));
            }else{
                console.log("couldn't get discount rate of "+shop.takitId+" due to unknwn reason");
            }
        },(err)=>{
                if(err=="NetworkFailure"){
                            let alert = this.alertController.create({
                                title: "서버와 통신에 문제가 있습니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                 }else{
                     console.log("Hum...getDiscountRate-HttpError");
                 } 
        })    
  });

 if(this.storageProvider.tourMode==false){    
    //open database file
        this.storageProvider.open().then(()=>{

        },()=>{
            let alert = this.alertController.create({
                            title: "디바이스 문제로 인해 장바구니가 정상동작하지 않습니다.",
                            buttons: ['OK']
                        });
            alert.present();

        })

        this.storageProvider.tabMessageEmitter.subscribe((cmd)=>{
            if(cmd=="stopEnsureNoti"){
                cordova.plugins.backgroundMode.disable();
                this.ngZone.run(()=>{
                        this.storageProvider.run_in_background=false;
                        //change color of notification button
                });
                this.stopEnsureNoti().then(()=>{
                        console.log("stopEnsureNoti was sent to Server");
                },(err)=>{
                        console.log("stopEnsureNoti error "+err);
                        if(err=="NetworkFailure"){
                            let alert = this.alertController.create({
                                title: "서버와 통신에 문제가 있습니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                        }
                });
            }else if(cmd=="wakeupNoti"){ //wake up notification
                this.wakeupNoti().then(()=>{
                cordova.plugins.backgroundMode.enable(); 
                this.ngZone.run(()=>{
                        this.storageProvider.run_in_background=true;
                        //change color of notification button
                });
                },(err)=>{
                        console.log("wakeupNoti error "+err);
                        if(err=="NetworkFailure"){
                            let alert = this.alertController.create({
                                title: "서버와 통신에 문제가 있습니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                        }
                });
            }
        }); 

    // register backbutton handler
        let ready = true;
    //refer to https://github.com/driftyco/ionic/issues/6982
        this.platform.registerBackButtonAction(()=>{
                console.log("Back button action called");

                let activePortal = this.ionicApp._loadingPortal.getActive() ||
                this.ionicApp._modalPortal.getActive() ||
                this.ionicApp._toastPortal.getActive() ||
                this.ionicApp._overlayPortal.getActive();

                if (activePortal) {
                ready = false;
                activePortal.dismiss();
                activePortal.onDidDismiss(() => { ready = true; });

                console.log("handled with portal");
                return;
                }

                if (this.menuCtrl.isOpen()) {
                this.menuCtrl.close();

                console.log("closing menu");
                return;
                }

                let view = this.navController.getActive();
                let page = view ? this.navController.getActive().instance : null;

                if (this.app.getRootNav().getActive()==this.viewCtrl){
                console.log("Handling back button on  tabs page");
                if(this.storageProvider.order_in_progress_24hours){
                        this.alertController.create({
                            title: '앱을 종료하시겠습니까?',
                            message: '진행중인 주문에 대해 주문알림을 받지 못할수 있습니다.',
                            buttons: [
                                {
                                    text: '아니오',
                                    handler: () => {
                                    }
                                },
                                {
                                    text: '네',
                                    handler: () => {
                                    console.log("call stopEnsureNoti");
                                    console.log("cordova.plugins.backgroundMode.disable");
                                    cordova.plugins.backgroundMode.disable();
                                    this.ngZone.run(()=>{
                                        this.storageProvider.run_in_background=false;
                                        //change color of notification button
                                    });
                                    this.stopEnsureNoti().then(()=>{
                                            console.log("success stopEnsureNoti()");
                                            this.storageProvider.db.close(()=>{
                                                this.platform.exitApp();
                                            },(err)=>{
                                                console.log("!!!fail to close db!!!");
                                                this.platform.exitApp();
                                            });
                                            //this.platform.exitApp();
                                    },(err)=>{
                                            console.log("fail in stopEnsureNoti() - Whan can I do here? nothing");
                                            this.storageProvider.db.close(()=>{
                                                this.platform.exitApp();
                                            },(err)=>{
                                                console.log("!!!fail to close db!!!");
                                                this.platform.exitApp();
                                            });
                                            //this.platform.exitApp();
                                    });
                                    }
                                }
                            ]
                        }).present();
                }else{
                        cordova.plugins.backgroundMode.disable();
                        this.storageProvider.db.close(()=>{
                            this.platform.exitApp();
                        },(err)=>{
                            console.log("!!!fail to close db!!!");
                            this.platform.exitApp();
                        });
                        //this.platform.exitApp();
                }
                }
                else if (this.navController.canGoBack() || view && view.isOverlay) {
                console.log("popping back");
                this.navController.pop();
                }else{
                    console.log("What can I do here? which page is shown now? Error or LoginPage");
                    this.storageProvider.db.close(()=>{
                        this.platform.exitApp();
                    },(err)=>{
                        console.log("!!!fail to close db!!!");
                        this.platform.exitApp();
                    });
                    //this.platform.exitApp();
                }
            }, 100/* high priority rather than login page */);
    
        /////////////////////////////////////// 
        this.platform.pause.subscribe(()=>{
            console.log("pause event comes");
        }); //How about reporting it to server?
        this.platform.resume.subscribe(()=>{
            console.log("resume event comes");
        }); //How about reporting it to server?

        cordova.plugins.backgroundMode.onactivate(()=>{
            console.log("background mode has been activated");
        });

        cordova.plugins.backgroundMode.ondeactivate (()=> {
        console.log("background mode has been deactivated");
        });

        cordova.plugins.backgroundMode.setDefaults({
            title:  '타킷이 실행중입니다',
            ticker: '주문알림 대기',
            text:   '타킷이 실행중입니다'
        });

        //get the orders in progress within 24 hours from server
        this.serverProvider.orderNoti().then((orders:any)=>{
            if(orders==undefined || orders==null ||orders.length==0){
                console.log('no orders in progress');
                this.storageProvider.order_in_progress_24hours=false;
                cordova.plugins.backgroundMode.disable(); 
                this.ngZone.run(()=>{
                        this.storageProvider.run_in_background=false;
                        //change color of notification button
                });
                // report it to server
                this.stopEnsureNoti().then(()=>{
                    console.log("stopEnsureNoti success"); 
                },(err)=>{
                    console.log(" stopEnsureNot failure-What should I do here?");
                }); 
                return;
            }else{    
                this.storageProvider.order_in_progress_24hours=true;            
                this.wakeupNoti().then(()=>{
                    console.log('cordova.plugins.backgroundMode.enable');
                    cordova.plugins.backgroundMode.enable(); 
                        this.ngZone.run(()=>{
                            this.storageProvider.run_in_background=true;
                            //change color of notification button
                        });
                },(err)=>{
                        let alert = this.alertController.create({
                            title: "주문 알림을 키는데 실패했습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
                });
            }
        },(err)=>{
            if(err=="NetworkFailure"){
                let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
            }else{
                console.log("getOrderInProgress error");
            }
        });
 }else{
        console.log("tour mode is true");
        this.storageProvider.open().then(()=>{

        },()=>{
            let alert = this.alertController.create({
                            title: "디바이스 문제로 인해 장바구니가 정상동작하지 않습니다.",
                            buttons: ['OK']
                        });
            alert.present();

        });
        //backbutton handler(?) 장바구니 나가기 모드가 있어야 한다. back button이 정상 동작하는지 보면 된다.
        //ionViewWillUnload가 정상 동작하는지 보자.
 }
}

  ionViewWillLeave(){

  }

  ionViewWillUnload(){
    console.log("!!!ionViewWillUnload-tabs!!!");
    if(this.storageProvider.tourMode==true){
        //drop table
        console.log("tourMode drop table");
        this.storageProvider.dropCartInfo().then(()=>{
            this.storageProvider.db.close();    
        },()=>{
            this.storageProvider.db.close();
        });
    }else{
        this.storageProvider.db.close(()=>{

        },(err)=>{
            console.log("!!!fail to close db!!!");
        });
    }
  }

  home(event){
    console.log("home tab selected"); 
  }

  search(event){
    console.log("search tab selected"); 
 }

  cash(event){
     console.log("cash tab selected"); 
  }

    registerPushService(){ // Please move this code into tabs.ts
            this.pushNotification=Push.init({
                android: {
                    senderID: ConfigProvider.userSenderID,
                    sound: "true"
                },
                ios: {
                    senderID: ConfigProvider.userSenderID,
                    "gcmSandbox": "true",
                    "alert": "true",
                    "sound": "true"
                },
                windows: {}
            });
                        
            this.pushNotification.on('registration',(response)=>{
              console.log("registration:"+JSON.stringify(response));
              console.log("registration..."+response.registrationId);
              var platform;
              if(this.platform.is("android")){
                  platform="android";
              }else if(this.platform.is("ios")){
                  platform="ios";
              }else{
                  platform="unknown";
              }

              let body = JSON.stringify({registrationId:response.registrationId, platform: platform});
              //let headers = new Headers();
              //headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress +" body:"+JSON.stringify(body));
              //this.http.post(ConfigProvider.serverAddress+"/registrationId",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
              this.serverProvider.post(ConfigProvider.serverAddress+"/registrationId",body).then((res:any)=>{
                  console.log("registrationId sent successfully");
                  var result:string=res.result;
                  if(result=="success"){

                  }else{
                    
                  }
             },(err)=>{
                 if(err=="NetworkFailure"){
                        console.log("registrationId sent failure");
                        this.storageProvider.errorReasonSet('네트웍 연결이 원할하지 않습니다'); 
                        //Please move into ErrorPage!
                        this.app.getRootNav().setRoot(ErrorPage);
                 }else{
                     console.log("Hum...registrationId-HttpError");
                 } 
                });
            });

            this.pushNotification.on('notification',(data)=>{
                console.log("[home.ts]pushNotification.on-data:"+JSON.stringify(data));
                console.log("[home.ts]pushNotification.on-data.title:"+JSON.stringify(data.title));
                
                var additionalData:any=data.additionalData;
                if(additionalData.GCMType==="order"){
                    this.storageProvider.messageEmitter.emit(additionalData.custom);//  만약 shoptab에 있다면 주문목록을 업데이트 한다. 만약 tab이라면 메시지를 보여준다. 
                    console.log("show alert");
                    let alert = this.alertController.create({
                        title: data.title,
                        subTitle: data.message,
                        buttons: ['OK']
                    });
                    alert.present();
                    // check if order in progress exists or not
                    this.serverProvider.orderNoti().then((orders:any)=>{
                          if(orders==undefined || orders==null || orders.length==0){
                              // off run_in_background 
                              console.log("no more order in progress within 24 hours");
                              console.log("cordova.plugins.backgroundMode.disable");
                              cordova.plugins.backgroundMode.disable();
                              this.ngZone.run(()=>{
                                    this.storageProvider.run_in_background=false;
                                    this.storageProvider.order_in_progress_24hours=false;
                                    //change color of notification button
                              });
                          }
                    },(err)=>{
                        console.log("getOrdersInProgress error");
                        let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
                    });
                }else if(additionalData.GCMType==="cash"){
                /*
                  let cashConfirmModal = this.modalCtrl.create(CashConfirmPage, { userId: 8675309 });
                  cashConfirmModal.present();
                */
                }
                this.confirmMsgDelivery(additionalData.notId).then(()=>{
                      console.log("confirmMsgDelivery success");
                },(err)=>{
                    if(err=="NetworkFailure"){
                        let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
                    }else{
                        console.log("hum...successGCM-HttpFailure");
                    }
                });

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

    confirmMsgDelivery(messageId){
        return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("messageId:"+messageId);
            console.log("!!!server:"+ ConfigProvider.serverAddress);
            let body = JSON.stringify({messageId:messageId});

            //this.http.post(encodeURI(ConfigProvider.serverAddress+"/successGCM"),body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
            this.serverProvider.post(ConfigProvider.serverAddress+"/successGCM",body).then((res:any)=>{    
                  console.log("res:"+JSON.stringify(res));
                  resolve();
            },(err)=>{
                reject(err);  
            });
      });   
    }

  configureBackgrondMode(){
    console.log("[configureBackgrondMode]");
    // give notification on to off
    if(this.storageProvider.run_in_background){
      this.alertController.create({
                  title: '주문 알림모드를 종료하시겠습니까?',
                  message: '진행중인 주문에 대해 주문알림을 받지 못할수 있습니다.',
                  buttons: [
                     {
                        text: '아니오',
                        handler: () => {
                        }
                     },
                     {
                        text: '네',
                        handler: () => {
                                this.stopEnsureNoti().then(()=>{
                                                console.log('cordova.plugins.backgroundMode.disable');
                                                cordova.plugins.backgroundMode.disable(); //takitShop always runs in background Mode
                                                this.ngZone.run(()=>{
                                                    this.storageProvider.run_in_background=false;
                                                    //change color of notification button
                                                });
                                },(err)=>{
                                        let alert = this.alertController.create({
                                                title: "주문알림을 끄는데 실패했습니다.",
                                                buttons: ['OK']
                                            });
                                            alert.present();  
                                });
                        }
                     }
                  ]
               }).present();
    }else {
      // please ask server the current orders in progress and then show user this notification. 
      this.alertController.create({
                  title: '주문 알림 모드를 실행하시겠습니까?',
                  message: '진행중인 주문 종료시까지 타킷이 계속 실행됩니다.',
                  buttons: [
                     {
                        text: '아니오',
                        handler: () => {
                        }
                     },
                     {
                        text: '네',
                        handler: () => {
                                console.log('enable background mode');
                                this.wakeupNoti().then(()=>{
                                    cordova.plugins.backgroundMode.enable(); 
                                    this.ngZone.run(()=>{
                                        this.storageProvider.run_in_background=true;
                                        //change color of notification button
                                    });
                                },(err)=>{
                                    console.log("wakeupNoti fail");
                                    let alert = this.alertController.create({
                                        title: "주문알림을 키는데 실패했습니다.",
                                        buttons: ['OK']
                                    });
                                    alert.present();
                                });
                        }
                     }
                  ]
               }).present();
    }
  }

  getColorBackgroundMode(){
    if(this.storageProvider.run_in_background){
      return "primary";
    }else{
      return "gray";
    }
  }

  stopEnsureNoti(){
        return new Promise((resolve,reject)=>{
            console.log("!!!server:"+ ConfigProvider.serverAddress+"/sleepMode");
            let body = JSON.stringify({});

            //Why default timeout doesn't work?
            //this.http.post(encodeURI(ConfigProvider.serverAddress+"/sleepMode"),body,{headers: headers}).timeout(3000/* 3 seconds */).map(res=>res.json()).subscribe((res:any)=>{
            this.serverProvider.post(ConfigProvider.serverAddress+"/sleepMode",body).then((res:any)=>{    
                  console.log("sleepMode-res:"+JSON.stringify(res));
                  if(res.result=="success"){
                    resolve();
                  }else{
                    reject("HttpFailure");
                  }
            },(err)=>{
                reject(err);  
            });
      });    
  }

  wakeupNoti(){
        return new Promise((resolve,reject)=>{
            console.log("!!!server:"+ ConfigProvider.serverAddress+"/wakeMode");
            let body = JSON.stringify({});

            //this.http.post(encodeURI(ConfigProvider.serverAddress+"/wakeMode"),body,{headers: headers}).timeout(3000/* 3 seconds */).map(res=>res.json()).subscribe((res:any)=>{
            this.serverProvider.post(ConfigProvider.serverAddress+"/wakeMode",body).then((res:any)=>{
                  console.log("wakeMode-res:"+JSON.stringify(res));
                  console.log("res is ..."+res.result);
                  if(res.result=="success"){
                    resolve();
                  }else{
                    reject("HttpFailure");
                  }
            },(err)=>{
                reject(err);  
            });
      });    
  }

}
