import {Component} from "@angular/core";
import {Platform} from 'ionic-angular';
import {NavController,NavParams,App} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Splashscreen} from 'ionic-native';
import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {EmailProvider} from '../../providers/LoginProvider/email-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';
import {Storage} from '@ionic/storage';

import {TabsPage} from '../tabs/tabs';
import {LoginPage} from '../login/login';

@Component({
  selector: 'page-error',
  templateUrl: 'error.html',
})

export class ErrorPage{
     public reason:string="";
     android_platform:boolean;

     constructor(private navController: NavController, private _navParams: NavParams,
        private platform:Platform,private storageProvider:StorageProvider,
        public fbProvider:FbProvider, public kakaoProvider:KakaoProvider,
        public emailProvider:EmailProvider,public storage:Storage,private app:App){

         console.log("ErrorPage constructor");
         this.android_platform=this.platform.is('android');
         this.reason=this.storageProvider.errorReason;
     }

     ionViewDidEnter(){
        console.log("ErrorPage did enter");
        Splashscreen.hide();
     }

     terminate(event){
        console.log("terminate");
        this.platform.exitApp();
     }

    loginWithExistingId(){
                var id=this.storageProvider.id;
                if(id=="facebook"){
                    this.fbProvider.login().then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    //save shoplist
                                    console.log("res.email:"+res.email +"res.name:"+res.name);
                                    if(res.userInfo.hasOwnProperty("shopList")){
                                        this.storageProvider.shoplistSet(JSON.parse(res.userInfo.shopList));
                                    }
                                    this.storageProvider.userInfoSet(res.userInfo.email,res.userInfo.name,res.userInfo.phone);
                                    console.log("shoplist...:"+JSON.stringify(this.storageProvider.shoplist));
                                    this.app.getRootNav().setRoot(TabsPage);
                                }else if(res.result=='invalidId'){
                                    console.log("사용자 정보에 문제가 발생했습니다. 로그인 페이지로 이동합니다.");
                                    this.app.getRootNav().setRoot(LoginPage);   
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                    this.app.getRootNav().setRoot(ErrorPage);   
                                }
                            },login_err =>{
                                console.log("move into ErrorPage-"+JSON.stringify(login_err));
                                //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                //this.app.getRootNav().setRoot(ErrorPage);
                    });
                }else if(id=="kakao"){ //kakao login
                        //console.log("kakao login is not implemented yet");
                        // read kakao id and try server login
                        this.kakaoProvider.login().then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    //save shoplist
                                    if(res.userInfo.hasOwnProperty("shopList")){
                                        this.storageProvider.shoplistSet(JSON.parse(res.userInfo.shopList));
                                    }
                                    this.storageProvider.userInfoSet(res.userInfo.email,res.userInfo.name,res.userInfo.phone);
                                    this.app.getRootNav().setRoot(TabsPage);
                                }else if(res.result=='invalidId'){
                                    console.log("사용자 정보에 문제가 발생했습니다. 로그인 페이지로 이동합니다.");
                                    this.app.getRootNav().setRoot(LoginPage);
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                    //this.app.getRootNav().setRoot(ErrorPage);   
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                //this.app.getRootNav().setRoot(ErrorPage);
                            });
                }else{ // email login 
                        this.storage.get("password").then((value:string)=>{
                        var password=this.storageProvider.decryptValue("password",decodeURI(value));
                        this.emailProvider.EmailServerLogin(id,password).then((res:any)=>{
                                console.log("MyApp:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    if(res.userInfo.hasOwnProperty("shopList")){
                                        //save shoplist
                                        this.storageProvider.shoplistSet(JSON.parse(res.userInfo.shopList));
                                    }
                                    this.storageProvider.userInfoSet(res.userInfo.email,res.userInfo.name,res.userInfo.phone);
                                    this.app.getRootNav().setRoot(TabsPage);
                                }else{ 
                                    console.log("사용자 정보에 문제가 발생했습니다. 로그인 페이지로 이동합니다.");
                                    this.app.getRootNav().setRoot(LoginPage);
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다'); 
                                //this.app.getRootNav().setRoot(ErrorPage);
                        });
                        },(error)=>{
                                console.log("사용자 정보에 문제가 발생했습니다. 로그인 페이지로 이동합니다.");
                                this.app.getRootNav().setRoot(LoginPage);
                        });
                }
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
}
