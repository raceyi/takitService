import { Component } from '@angular/core';
import { Platform,App } from 'ionic-angular';
import { StatusBar,Splashscreen ,Network} from 'ionic-native';

import {StorageProvider} from '../providers/storageProvider';
import {FbProvider} from '../providers/LoginProvider/fb-provider';
import {KakaoProvider} from '../providers/LoginProvider/kakao-provider';
import {EmailProvider} from '../providers/LoginProvider/email-provider';
import {Storage} from '@ionic/storage';

import {LoginPage} from '../pages/login/login';
import {ErrorPage} from '../pages/error/error';
import {ShopTablePage} from '../pages/shoptable/shoptable';
import{SelectorPage} from '../pages/selector/selector';
import{PrinterPage} from '../pages/printer/printer';

@Component({
  selector:'page-menu',
  templateUrl: 'menu.html'
})
export class MyApp {
   public rootPage:any;
  // private disconnectSubscription;
  // private connectSubscription;

   constructor(private platform:Platform,public app:App,
                private fbProvider:FbProvider,private emailProvider:EmailProvider,
                private kakaoProvider:KakaoProvider,private storageProvider:StorageProvider,
                public storage:Storage) {
    
    this.platform=platform;
    ////////////Test-begin//////////
    if(!this.platform.is('cordova')){
        console.log("platform is not cordova");
        this.rootPage=ShopTablePage;
    }
    ////////////Test-end///////////
    
    platform.ready().then(() => {
        console.log("platform ready comes");
        this.storageProvider.open();

        if(Network.connection=="none"){
            this.storageProvider.errorReasonSet('네트웍 연결이 원할하지 않습니다'); 
            //Please check current page and then move into ErrorPage!
            console.log("rootPage:"+JSON.stringify(this.rootPage));
            if(!this.rootPage){
                this.rootPage=ErrorPage;
                 Splashscreen.hide();
            }else{
                console.log("show alert");
            }       
        }else{
            console.log('network connected!');
/*
            this.disconnectSubscription = Network.onDisconnect().subscribe(() => { // Why it doesn't work?
                console.log('network was disconnected :-(');
                this.storageProvider.errorReasonSet('네트웍 연결이 원할하지 않습니다'); 
                //Please check current page and then move into ErrorPage!
                console.log("rootPage:"+JSON.stringify(this.rootPage));
                if(!this.rootPage)
                    this.rootPage=ErrorPage;
                else{
                    console.log("show alert");
                }   
            });
*/
            //Please login if login info exists or move into login page
            this.storage.get("id").then((value:string)=>{
                console.log("value:"+value);
                if(value==null){
                  console.log("id doesn't exist");
                  this.rootPage=LoginPage;
                  return;
                }
                console.log("decodeURI(value):"+decodeURI(value));
                var id=this.storageProvider.decryptValue("id",decodeURI(value));
                if(id=="facebook"){
                    this.fbProvider.login().then((res:any)=>{
                                console.log("...MyApp:"+JSON.stringify(res));
                                console.log("res.shopUserInfo:"+JSON.stringify(res.shopUserInfo));
                                if(res.result=="success"){
                                    //save shoplist
                                    this.shoplistHandler(res.shopUserInfo);
                                }else if(res.result=='invalidId'){
                                    console.log("You have no right to access this app");
                                    this.storageProvider.errorReasonSet('접근권한이 없습니다.');
                                    this.rootPage=ErrorPage;
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                    this.rootPage=ErrorPage;   
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                this.rootPage=ErrorPage;
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
                                    this.storageProvider.errorReasonSet('접근권한이 없습니다.');
                                    this.rootPage=ErrorPage;
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                    this.rootPage=ErrorPage;   
                                }
                            },login_err =>{
                                //console.log(JSON.stringify(login_err));
                                this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                this.rootPage=ErrorPage;
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
                                    this.storageProvider.errorReasonSet('접근권한이 없습니다.');
                                    this.rootPage=ErrorPage;
                                }else{
                                    //console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                    this.rootPage=ErrorPage;   
                                }
                            },login_err =>{
                                //console.log(JSON.stringify(login_err));
                                this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                this.rootPage=ErrorPage;
                        });
                    });
                }
            },err=>{
                console.log("id doesn't exist. move into LoginPage");
                this.rootPage=LoginPage;
            });
        }

        //this.connectSubscription = Network.onConnect().subscribe(() => { 
        //    console.log('network connected!');
        //});

        // Okay, so the platform is ready and our plugins are available.
        // Here you can do any higher level native things you might need.
        StatusBar.styleDefault();
    });
  }

    shoplistHandler(userinfo){
        console.log("myshoplist:"+userinfo.myShopList);
        if(!userinfo.hasOwnProperty("myShopList")|| userinfo.myShopList==null){
            this.storageProvider.errorReasonSet('등록된 상점이 없습니다.');
            this.rootPage=ErrorPage;
        }else{
             this.storageProvider.myshoplist=JSON.parse(userinfo.myShopList);
             if(this.storageProvider.myshoplist.length==1){
                console.log("move into ShopTablePage");
                this.storageProvider.myshop=this.storageProvider.myshoplist[0];
                this.rootPage=ShopTablePage;
             }else{ 
                console.log("multiple shops");
                this.rootPage=SelectorPage;
             }
        }
  }

   openPrint(){
        this.app.getRootNav().push(PrinterPage);
   }
}

