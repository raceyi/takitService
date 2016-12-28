import {Component,NgZone} from "@angular/core";
import {Platform} from 'ionic-angular';
import {NavController,NavParams,App} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Splashscreen} from 'ionic-native';
import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {EmailProvider} from '../../providers/LoginProvider/email-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';
import {PrinterProvider} from '../../providers/printerProvider';

import {Storage} from '@ionic/storage';

import {LoginPage} from '../login/login';
import {ShopTablePage} from '../shoptable/shoptable';
import {SelectorPage} from '../selector/selector';

@Component({
  selector: 'page-error',
  templateUrl: 'error.html',
})

export class ErrorPage{
     public reason:string="";
     android_platform:boolean;
     hasNoMyShop:boolean=false;

     constructor(private navController: NavController, private _navParams: NavParams,
        private platform:Platform,private storageProvider:StorageProvider,
        public fbProvider:FbProvider, public kakaoProvider:KakaoProvider,
        public emailProvider:EmailProvider,public storage:Storage,private app:App,
        public printerProvider:PrinterProvider,private ngZone:NgZone){

         console.log("ErrorPage constructor");
         this.android_platform=this.platform.is('android');
         this.reason=this.storageProvider.errorReason;
         if(this.storageProvider.myshoplist.length==0){
             this.hasNoMyShop=true; 
         }
     }
    
     ionViewDidEnter(){
        console.log("ErrorPage did enter");
        Splashscreen.hide();
     }

     terminate(event){
        console.log("terminate");
        this.platform.exitApp();
     }

    tryLogin(event){
        if(this.storageProvider.id==undefined){
                this.storage.get("id").then((value:string)=>{
                        console.log("value:"+value);
                        if(value==null){
                            console.log("id doesn't exist");
                            this.app.getRootNav().setRoot(LoginPage); 
                            return;
                        }else{
                            var id=this.storageProvider.decryptValue("id",decodeURI(value));
                            console.log("id:"+id);
                            this.loginWithExistingId();
                        }
                });        
        }else{
            this.loginWithExistingId();
        }
    }

    loginWithExistingId(){
                var id=this.storageProvider.id;
                console.log("tryLogin id:"+id);
                if(id=="facebook"){
                    this.fbProvider.login().then((res:any)=>{
                                console.log("...MyApp:"+JSON.stringify(res));
                                console.log("res.shopUserInfo:"+JSON.stringify(res.shopUserInfo));
                                if(res.result=="success"){
                                    //save shoplist
                                    this.shoplistHandler(res.shopUserInfo);
                                }else if(res.result=='invalidId'){
                                    console.log("You have no right to access this app");
                                    this.app.getRootNav().setRoot(LoginPage);
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                    });
                }else if(id=="kakao"){ //kakao login
                        console.log("kakao login is not implemented yet");
                        this.kakaoProvider.login().then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    //save shoplist
                                    this.shoplistHandler(res.shopUserInfo);
                                }else if(res.result=='invalidId'){
                                    console.log("You have no right to access this app");
                                    this.app.getRootNav().setRoot(LoginPage);
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                }
                            },login_err =>{
                                //console.log(JSON.stringify(login_err));
                                this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                    });
                }else{ // email login 
                    this.storage.get("password").then((value:string)=>{
                        var password=this.storageProvider.decryptValue("password",decodeURI(value));
                        this.emailProvider.EmailServerLogin(id,password).then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    //save shoplist
                                    this.shoplistHandler(res.shopUserInfo);
                                }else if(res.result=='invalidId'){
                                    //console.log("You have no right to access this app");
                                    this.app.getRootNav().setRoot(LoginPage);
                                }else{
                                    //console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                        });
                    },(err)=>{
                        this.app.getRootNav().setRoot(LoginPage);
                    });
                }
    }

    shoplistHandler(userinfo){
        console.log("myshoplist:"+userinfo.myShopList);
        if(!userinfo.hasOwnProperty("myShopList")|| userinfo.myShopList==null){
            this.storageProvider.errorReasonSet('등록된 상점이 없습니다.');
        }else{
             this.storageProvider.myshoplist=JSON.parse(userinfo.myShopList);
             this.storageProvider.userInfoSetFromServer(userinfo);
             if(this.storageProvider.myshoplist.length==1){
                console.log("move into ShopTablePage");
                this.storageProvider.myshop=this.storageProvider.myshoplist[0];
                this.app.getRootNav().setRoot(ShopTablePage);
             }else{ 
                console.log("multiple shops");
                this.app.getRootNav().setRoot(SelectorPage);
             }
        }
        this.storage.get("printer").then((value:string)=>{
            this.storageProvider.printerName=value;
            this.printerProvider.setPrinter(value);
            this.storage.get("printOn").then((value:string)=>{
                console.log("printOn:"+value);
                this.storageProvider.printOn= JSON.parse(value);
            },()=>{
                this.storageProvider.printOn=false;
            });
        },()=>{
            this.storageProvider.printOn=false;
        });
    }

}
