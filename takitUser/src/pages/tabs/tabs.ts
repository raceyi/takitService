import {Component,EventEmitter} from '@angular/core'
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

@Component({
  templateUrl: 'tabs.html'
})
export class TabsPage {

  public tabCash: any;
  public tabHome: any;
  public tabSearch: any;

  pushNotification:PushNotification;
  askExitAlert:any;

  constructor(public modalCtrl: ModalController,private navController: NavController,private app:App,private platform:Platform,public viewCtrl: ViewController,
    private storageProvider:StorageProvider,private http:Http, private alertController:AlertController,private ionicApp: IonicApp,
    private menuCtrl: MenuController) {
    // this tells the tabs component which Pages
    // should be each tab's root Page
    this.tabHome = HomePage;
    this.tabSearch = SearchPage;
    this.tabCash = CashPage;
    //Please login and then do registration for gcm msg
    // and then move into home page
    this.registerPushService(); 
  }

 ionViewDidEnter(){
   /*  So far, no way to handle backbutton clearly T.T*/
    let ready = true;

    this.platform.registerBackButtonAction(()=>{
      /*
      console.log("TabsPage backbutton comes"+" nav:"+this.navController +" active:"+this.app.getActiveNav()+" rootNav:"+this.app.getRootNav());
      if(this.app.getRootNav().getActive()==this.viewCtrl){
        console.log("TabsPage get backbutton. Ask user Do you want to exit App?");
        this.platform.exitApp();
      }else{
          // Why doesn't selector disappear?
          
          console.log("child nav:"+this.app.getActiveNav().getActiveChildNav());
          if(this.app.getActiveNav().getActiveChildNav()!=undefined)
              this.app.getActiveNav().getActiveChildNav().pop(); // it doesn't work
          else
              this.app.getActiveNav().pop();   
          
          console.log("how can it work? noway");
          this.navController.pop();     
      } 
    }); //priority
    */
   /*
   //refer to https://github.com/driftyco/ionic/issues/6982*/
   
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
                           this.platform.exitApp();
                        }
                     }
                  ]
               }).present();
            }
            else if (this.navController.canGoBack() || view && view.isOverlay) {
               console.log("popping back");
               this.navController.pop();
            }else{
                console.log("What can I do here?");
            }
         }, 1);
  }

/*
  askExit(){
     this.askExitAlert = this.alertController.create({
      title: '타킷을 종료합니다.',
      message: '거래중인 주문이 있을 경우 반드시 타킷을 실행해 주시기 바랍니다.',
      buttons: [
        {
          text: '바로 종료',
          handler: () => {
            console.log('agree clicked');
             this.platform.exitApp();
          }
        },
        {
          text: '종료 취소',
          handler: () => {
            console.log('disagree clicked');
            this.askExitAlert=undefined;
          }
        }]
      });
      this.askExitAlert.present();
  }

  ionViewCanLeave(): boolean{
   // here we can either return true or false
   // depending on if we want to leave this view
   console.log("ionViewCanLeave");
   if(this.platform.is("android")){
      if(this.askExitAlert!=undefined)
          return true;
      else{    
          this.askExit();
          return false;
      }   
   }else{
      // Should I give alert here?
      return true;
   }
}
*/

ionViewWillLeave(){
  /*
  console.log("ionViewWillLeave"); // it isn't fired, when app exit.
     this.askExitAlert = this.alertController.create({
      title: '타킷을 종료합니다.',
      message: '거래중인 주문이 있을 경우 반드시 타킷을 실행해 주시기 바랍니다.',
      buttons: [
        {
          text: '바로 종료',
          handler: () => {
            console.log('agree clicked');
             this.platform.exitApp();
          }
        },
        {
          text: '종료 취소',
          handler: () => {
            console.log('disagree clicked');
            this.askExitAlert=undefined;
          }
        }]
      });
      this.askExitAlert.present();
   */
}

ionViewWillUnload(){
  console.log("ionViewWillUnload-tabs");
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
              let body = JSON.stringify({registrationId:response.registrationId});
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
                this.storageProvider.messageEmitter.emit(JSON.parse(additionalData.custom));//  만약 shoptab에 있다면 주문목록을 업데이트 한다. 만약 tab이라면 메시지를 보여준다. 
                  let alert = this.alertController.create({
                        title: data.title,
                        subTitle: data.message,
                        buttons: ['OK']
                    });
                    alert.present();
                }else if(additionalData.GCMType==="cash"){
                /*
                  let cashConfirmModal = this.modalCtrl.create(CashConfirmPage, { userId: 8675309 });
                  cashConfirmModal.present();
                */
                }
                this.confirmMsgDelivery(additionalData.messageId).then(()=>{
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

}
