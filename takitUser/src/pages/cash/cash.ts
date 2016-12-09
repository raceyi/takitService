import {Component} from '@angular/core';
import {App,NavController,NavParams,Tabs,AlertController} from 'ionic-angular';
import {Platform} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {ViewChild} from '@angular/core';
import {Content} from 'ionic-angular';
import {Device,InAppBrowserEvent,InAppBrowser} from 'ionic-native';
import {CashIdPage} from '../cashid/cashid';
import {StorageProvider} from '../../providers/storageProvider';
import {ServerProvider} from '../../providers/serverProvider';

@Component({
  selector: 'page-cash',
  templateUrl: 'cash.html'
})
export class CashPage {
  cashMenu: string = "cashIn";
  available: string ="15000";
  //isAndroid: boolean = false;
  browserRef:InAppBrowser;

  //minVersion:boolean=(this.platform.is('android') && parseInt(Device.device.version[0])<=4);

  @ViewChild("cashContent") contentRef: Content;

  constructor(private app:App,private platform:Platform, private navController: NavController
  ,private navParams: NavParams,public http:Http ,private alertController:AlertController
  ,public storageProvider:StorageProvider,private serverProvider:ServerProvider) {
      //this.isAndroid = platform.is('android');
      console.log(" param: "+this.navParams.get('param'));

  }
/*
 ionViewDidEnter(){
    let dimensions=this.contentRef.getContentDimensions();
    let height=this.contentRef.getNativeElement().parentElement.offsetHeight-dimensions.contentTop;
    console.log("pageHeight:"+this.contentRef.getNativeElement().parentElement.offsetHeight+"top:"+dimensions.contentTop+"menusHeight:"+height);
    this.contentRef.getScrollElement().setAttribute("style","height:"+height+"px;margin-top:0px;");
 }
*/
    createTimeout(timeout) {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(null),timeout)
        })
    }

  cashInCheck(confirm){
      console.log("cashInCheck comes(confirm)");
      this.createTimeout(15000)
                .then(() => {
                    console.log(`done after 300ms delay`);
                    this.contentRef.scrollToTop(); 
                    let body = JSON.stringify({});
                    let headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    console.log("server:"+ ConfigProvider.serverAddress);
                    //this.http.post(ConfigProvider.serverAddress+"/triggerCashCheck",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                    this.serverProvider.post(ConfigProvider.serverAddress+"/triggerCashCheck",body).then((res:any)=>{    
                        var result:string=res.result;
                        if(result=="success"){
                            console.log("triggerCashCheck sent successfully");
                        }
                    },(err)=>{
                            console.log("triggerCashCheck err "+err);
                            if(err=="NetworkFailure"){
                                let alert = this.alertController.create({
                                    title: '서버와 통신에 문제가 있습니다',
                                    subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                    buttons: ['OK']
                                });
                                alert.present();
                            }
                    });
                });
  }

  cashInComplete(event){
      console.log("cashInComplete");
      this.available="20000";
      //this.content.scrollToTop();
  }
  
  configureCashId(){
   // this.app.getRootNav().push(CashIdPage);
   if(this.storageProvider.isAndroid){
        let confirm = this.alertController.create({
        title: '회원정보와 휴대폰 본인인증 정보가 동일해야만 합니다.',
        message: '다를 경우 회원정보 수정후 진행해주시기바랍니다.',
        buttons: [
            {
            text: '아니오',
            handler: () => {
                console.log('Disagree clicked');
                return;
            }
            },
            {
            text: '네',
            handler: () => {
                console.log('Agree clicked');
                this.mobileAuth().then(()=>{ // success
                    this.app.getRootNav().push(CashIdPage);
                },(err)=>{ //failure
                    if(err=="invalidUserInfo"){
                        console.log("invalidUserInfo");
                        let alert = this.alertController.create({
                                title: '사용자 정보가 일치하지 않습니다.',
                                subTitle: '회원정보를 수정해주시기 바랍니다',
                                buttons: ['OK']
                            });
                            alert.present();
                    }
                });
            }
            }
        ]
        });
        confirm.present();    
    }else{
                this.mobileAuth().then(()=>{ // success
                this.app.getRootNav().push(CashIdPage);
                },(err)=>{ //failure
                    if(err=="invalidUserInfo"){
                        console.log("invalidUserInfo");
                        let alert = this.alertController.create({
                                title: '사용자 정보가 일치하지 않습니다.',
                                subTitle: '회원정보를 수정해주시기 바랍니다',
                                buttons: ['OK']
                            });
                            alert.present();
                    }
                });
    }
  }

  mobileAuth(){
    return new Promise((resolve,reject)=>{
      // move into CertPage and then 
      if(this.storageProvider.isAndroid){
            this.browserRef=new InAppBrowser("https://takit.biz:8443/NHPintech/kcpcert_start.jsp","_blank" ,'toolbar=no');
      }else{ // ios
            this.browserRef=new InAppBrowser("https://takit.biz:8443/NHPintech/kcpcert_start.jsp","_blank" ,'location=no,closebuttoncaption=종료');
      }
              this.browserRef.on("exit").subscribe((event)=>{
                  console.log("InAppBrowserEvent(exit):"+JSON.stringify(event)); 
                  this.browserRef.close();
              });
              this.browserRef.on("loadstart").subscribe((event:InAppBrowserEvent)=>{
                  console.log("InAppBrowserEvent(loadstart):"+String(event.url));
                  if(event.url.startsWith("https://takit.biz/oauthSuccess")){ // Just testing. Please add success and failure into server 
                        console.log("cert success");
                        var strs=event.url.split("userPhone=");    
                        if(strs.length>=2){
                            var nameStrs=strs[1].split("userName=");
                            if(nameStrs.length>=2){
                                var userPhone=nameStrs[0];
                                var userName=nameStrs[1];
                                console.log("userPhone:"+userPhone+" userName:"+userName);
                                let body = JSON.stringify({userPhone:userPhone,userName:userName});
                                this.serverProvider.post(ConfigProvider.serverAddress+"/validUserInfo",body).then((res:any)=>{
                                    if(res.result=="success"){
                                        // forward into cash id page
                                        resolve();
                                    }else{
                                        // change user info
                                        //    
                                        reject("invalidUserInfo");
                                    }
                                },(err)=>{
                                    if(err=="NetworkFailure"){
                                        let alert = this.alertController.create({
                                            title: '서버와 통신에 문제가 있습니다',
                                            subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                            buttons: ['OK']
                                        });
                                        alert.present();
                                    }
                                    reject(err);
                                });
                            }
                        }
                        this.browserRef.close();
                        return;
                  }else if(event.url.startsWith("https://takit.biz/oauthFailure")){
                        console.log("cert failure");
                        this.browserRef.close();
                         reject();
                        return;
                  }
              });
    });
  }
}
