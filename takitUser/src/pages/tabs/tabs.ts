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
    private storageProvider:StorageProvider,private http:Http, private alertController:AlertController,private ionicApp: IonicApp,
    private menuCtrl: MenuController,public ngZone:NgZone) {
    // this tells the tabs component which Pages
    // should be each tab's root Page
    this.tabHome = HomePage;
    this.tabSearch = SearchPage;
    this.tabCash = CashPage;
    //Please login and then do registration for gcm msg
    // and then move into home page
    this.registerPushService(); 
  }

 ionViewDidLoad(){ 
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
              this.stopEnsureNoti().then(()=>{
                    console.log("stopEnsureNoti was sent to Server");
              },(err)=>{
                    console.log("stopEnsureNoti error");
              });
        }else if(cmd=="backgroundEnable"){
              this.ngZone.run(()=>{
                    this.storageProvider.run_in_background=true;
                    //change color of notification button
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
                                this.platform.exitApp();
                          },(err)=>{
                                console.log("fail in stopEnsureNoti() - Whan can I do here? nothing");
                                this.platform.exitApp();
                          });
                        }
                     }
                  ]
               }).present();
            }
            else if (this.navController.canGoBack() || view && view.isOverlay) {
               console.log("popping back");
               this.navController.pop();
            }else{
                console.log("What can I do here? which page is shown now? Error or LoginPage");
                this.storageProvider.db.close(()=>{

                },(err)=>{
                    console.log("!!!fail to close db!!!");
                });
                this.platform.exitApp();
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
    this.getOrdersInProgress().then((orders)=>{
        if(orders==undefined || orders==null){
            console.log('cordova.plugins.backgroundMode.disable');
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
                let confirm = this.alertController.create({
                    title: '24시간이내에 진행중인 주문이 있습니다.주문알림을 받기 위해 앱을 계속 실행하시겠습니까?',
                    message: '[주의]주문 완료 전에 앱이 중지되면 주문알림을 못받을수 있습니다.',
                    buttons: [
                      {
                        text: '아니오',
                        handler: () => {
                          console.log('cordova.plugins.backgroundMode.disable');
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
                        }
                      },
                      {
                        text: '네',
                        handler: () => {
                          console.log('cordova.plugins.backgroundMode.enable');
                          cordova.plugins.backgroundMode.enable(); 
                              this.ngZone.run(()=>{
                                    this.storageProvider.run_in_background=true;
                                    //change color of notification button
                              });
                        }
                      }
                    ]
                  });
                  confirm.present();
                }
            },(err)=>{
                console.log("getOrdersInProgress error-What should I do here?");
            });
}

  
  ionViewWillLeave(){

  }

  ionViewWillUnload(){
    console.log("!!!ionViewWillUnload-tabs!!!");
    this.storageProvider.db.close(()=>{

    },(err)=>{
        console.log("!!!fail to close db!!!");
    });
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
                    //forceShow: "true" // What is it?
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
              console.log("registration:"+JSON.stringify(response));
              console.log("registration..."+response.registrationId);
              var platform
              if(this.platform.is("android")){
                  platform="android";
              }else if(this.platform.is("ios")){
                  platform="ios";
              }else{
                  platform="unknown";
              }

              let body = JSON.stringify({registrationId:response.registrationId, platform: platform});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);
              this.http.post(ConfigProvider.serverAddress+"/registrationId",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                  console.log("registrationId sent successfully");
                  var result:string=res.result;
                  if(result=="success"){

                  }else{
                    
                  }
             },(err)=>{
                  console.log("registrationId sent failure");
                  //console.log(JSON.stringify(err));
                  this.storageProvider.errorReasonSet('네트웍 연결이 원할하지 않습니다'); 
                  //Please move into ErrorPage!
                  this.app.getRootNav().setRoot(ErrorPage); 
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
                    this.getOrdersInProgress().then((orders)=>{
                          if(orders==undefined || orders==null){
                              // off run_in_background 
                              console.log("no more order in progress within 24 hours");
                              console.log("cordova.plugins.backgroundMode.disable");
                              cordova.plugins.backgroundMode.disable();
                              this.ngZone.run(()=>{
                                    this.storageProvider.run_in_background=false;
                                    //change color of notification button
                              });
                          }
                    },()=>{

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
                     let alert = this.alertController.create({
                        title: "서버와 통신에 문제가 있습니다.",
                        buttons: ['OK']
                    });
                    alert.present();
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

            this.http.post(encodeURI(ConfigProvider.serverAddress+"/successGCM"),body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                  console.log("res:"+JSON.stringify(res));
                  resolve();
            },(err)=>{
                reject("http error");  
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
                                console.log('cordova.plugins.backgroundMode.disable');
                                cordova.plugins.backgroundMode.disable(); //takitShop always runs in background Mode
                                this.ngZone.run(()=>{
                                    this.storageProvider.run_in_background=false;
                                    //change color of notification button
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
                                cordova.plugins.backgroundMode.enable(); 
                                this.ngZone.run(()=>{
                                    this.storageProvider.run_in_background=true;
                                    //change color of notification button
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


  getOrdersInProgress(){
        return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("!!!server:"+ ConfigProvider.serverAddress+"/orderNotiMode");
            let body = JSON.stringify({});

            this.http.post(encodeURI(ConfigProvider.serverAddress+"/orderNotiMode"),body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                  console.log("res:"+JSON.stringify(res));
                  if(res.result=="success"){
                    resolve(res.order);
                  }else{
                    reject("server error");
                  }
            },(err)=>{
                reject("http error");  
            });
      });         
  }

  stopEnsureNoti(){
        return new Promise((resolve,reject)=>{
            let headers = new Headers();
            headers.append('Content-Type', 'application/json');
            console.log("!!!server:"+ ConfigProvider.serverAddress+"/sleepMode");
            let body = JSON.stringify({});

            this.http.post(encodeURI(ConfigProvider.serverAddress+"/sleepMode"),body,{headers: headers}).timeout(3000/* 3 seconds */).map(res=>res.json()).subscribe((res)=>{
                  console.log("res:"+JSON.stringify(res));
                  if(res.result=="success"){
                    resolve();
                  }else{
                    reject("server error");
                  }
            },(err)=>{
                reject("http error");  
            });
      });    
  }

}
