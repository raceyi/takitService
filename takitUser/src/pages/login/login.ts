import {Component,EventEmitter,ViewChild} from "@angular/core";
import {Content,Platform,AlertController,IonicApp,MenuController} from 'ionic-angular';
import {NavController,NavParams} from 'ionic-angular';
import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';

import {EmailProvider} from '../../providers/LoginProvider/email-provider';
import {TabsPage} from '../tabs/tabs';

import {Splashscreen} from 'ionic-native';
import {SignupPage} from '../signup/signup';
import {SignupSubmitPage} from '../signup_submit/signup_submit';
import {PasswordPage} from '../password/password';

import {StorageProvider} from '../../providers/storageProvider';
import {Storage} from "@ionic/storage";

import {ConfigProvider} from '../../providers/ConfigProvider';
import {Http,Headers} from '@angular/http';

@Component({
  selector:'page-login',
  templateUrl: 'login.html',
})

export class LoginPage {
    password:string="";
    email:string="";
    emailHide:boolean=true;
    @ViewChild('loginPage') loginPageRef: Content;
    focusEmail = new EventEmitter();;
    focusPassword =new EventEmitter();
    scrollTop;

  constructor(private navController: NavController, private navParams: NavParams,
                private fbProvider:FbProvider,private emailProvider:EmailProvider,
                private kakaoProvider:KakaoProvider, public storage:Storage,
                private storageProvider:StorageProvider,private platform:Platform,
                private alertController:AlertController,private ionicApp: IonicApp,
                private menuCtrl: MenuController,private http:Http){
      console.log("LoginPage construtor");
  }
 
  //ionViewDidEnter() {
  ionViewDidLoad(){
        console.log("Login page did enter");
        Splashscreen.hide();
        let dimensions = this.loginPageRef.getContentDimensions();
        this.scrollTop=dimensions.scrollTop;
        this.storageProvider.login=true;
        this.storageProvider.navController=this.navController;
       
        let ready = true;

    this.platform.registerBackButtonAction(()=>{
               console.log("[loginPage]Back button action called");
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

            if (this.navController.canGoBack() || view && view.isOverlay) {
               console.log("popping back");
               this.navController.pop();
            }else{
                console.log("What can I do here? which page is shown now? Error or LoginPage?");
                this.platform.exitApp();
            }
         }, 1);
  }

  emailLoginSelect(event){
      this.emailHide=!this.emailHide;      
  }

  facebookLogin(event){
      console.log('facebookLogin comes');
      this.fbProvider.login().then((res:any)=>{
                                console.log("facebookLogin-login page:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    var encrypted:string=this.storageProvider.encryptValue('id','facebook');
                                    console.log("encrypted "+encrypted);
                                    this.storage.set('id',encodeURI(encrypted));
                                    console.log("shoplist:"+res.userInfo.shopList);
                                    if(res.userInfo.hasOwnProperty("shopList")){
                                        this.storageProvider.shoplistSet(JSON.parse(res.userInfo.shopList));
                                    }
                                    this.storageProvider.userInfoSet(res.userInfo.email,res.userInfo.name,res.userInfo.phone);
                                    console.log("move into TabsPage");
                                    this.navController.setRoot(TabsPage);
                                }else if(res.result=='invalidId'){
                                    console.log("move into SignupPage....");
                                    var param:any={id:res.id};
                                    if(res.hasOwnProperty("email")){
                                        param.email=res.email;
                                    }
                                    if(res.hasOwnProperty("name")){
                                        param.name=res.name;
                                    }
                                    console.log("param:"+JSON.stringify(param));
                                    this.navController.push(SignupSubmitPage,param);
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    let alert = this.alertController.create({
                                        title: '페이스북 로그인 에러가 발생했습니다',
                                        buttons: ['OK']
                                    });
                                    alert.present();
                                    //this.storageProvider.errorReasonSet('페이스북 로그인 에러가 발생했습니다');
                                    //this.navController.setRoot(ErrorPage);
                                }
                            },(login_err) =>{
                                    console.log("login_err"+JSON.stringify(login_err));
                                    let alert = this.alertController.create({
                                        title: '로그인 에러가 발생했습니다',
                                        subTitle: '네트웍 상태를 확인하신후 다시 시도해 주시기 바랍니다.',
                                        buttons: ['OK']
                                    });
                                    alert.present();
                                //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                //this.navController.setRoot(ErrorPage); 
                    }); 

  }

  kakaoLogin(event){
      console.log('kakaoLogin comes');
      this.kakaoProvider.login().then((res:any)=>{
                                console.log("kakaoProvider-login page:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    var encrypted:string=this.storageProvider.encryptValue('id','kakao');
                                    this.storage.set('id',encodeURI(encrypted));

                                    if(res.userInfo.hasOwnProperty("shopList")){
                                        console.log("shoplist:"+res.userInfo.shopList);
                                        this.storageProvider.shoplistSet(JSON.parse(res.userInfo.shopList));
                                    }
                                    this.storageProvider.userInfoSet(res.userInfo.email,res.userInfo.name,res.userInfo.phone);
                                    console.log("move into TabsPage");
                                    this.navController.setRoot(TabsPage);
                                }else if(res.result=='invalidId'){
                                    console.log("move into SignupPage!! SignupPage is not implmented yet");
                                    this.navController.push(SignupSubmitPage ,{id:res.id/* kakaoid*/});
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    let alert = this.alertController.create({
                                        title: '카카오 로그인 에러가 발생했습니다',
                                        buttons: ['OK']
                                    });
                                    alert.present();
                                    //this.storageProvider.errorReasonSet('카카오 로그인 에러가 발생했습니다');
                                    //this.navController.setRoot(ErrorPage);
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                //this.navController.setRoot(ErrorPage); 
                                console.log("login_err"+JSON.stringify(login_err));
                                    let alert = this.alertController.create({
                                        title: '로그인 에러가 발생했습니다',
                                        subTitle: '네트웍 상태를 확인하신후 다시 시도해 주시기 바랍니다.',
                                        buttons: ['OK']
                                    });
                                    alert.present();
                    }); 
  }

  emailLogin(event){
      console.log('emailLogin comes email:'+this.email+" password:"+this.password);    
      //Please check the validity of email and password.
      if(this.email.length==0){
          if(this.platform.is('android'))
            this.focusEmail.emit(true);
          else if(this.platform.is('ios')){ // show alert message
              let alert = this.alertController.create({
                        title: '이메일을 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
          }
          return;
      }
      if(this.password.length==0){
            if(this.platform.is('android'))
                this.focusPassword.emit(true);
            else if(this.platform.is('ios')){
                let alert = this.alertController.create({
                        title: '비밀번호를 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
            }
            return;
      }
      this.emailProvider.EmailServerLogin(this.email,this.password).then((res:any)=>{
                                console.log("emailLogin-login page:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    var encrypted:string=this.storageProvider.encryptValue('id',this.email);
                                    this.storage.set('id',encodeURI(encrypted));
                                    encrypted=this.storageProvider.encryptValue('password',this.password);
                                    this.storage.set('password',encodeURI(encrypted));

                                    console.log("email-shoplist:"+res.userInfo.shopList);
                                    if(res.userInfo.hasOwnProperty("shopList")){
                                        this.storageProvider.shoplistSet(JSON.parse(res.userInfo.shopList));
                                    }
                                    this.storageProvider.userInfoSet(res.userInfo.email,res.userInfo.name,res.userInfo.phone);
                                    console.log("move into TabsPage");
                                    this.navController.setRoot(TabsPage);
                                }else{
                                    let alert = this.alertController.create({
                                                title: '회원 정보가 일치하지 않습니다.',
                                                buttons: ['OK']
                                            });
                                            alert.present().then(()=>{
                                              console.log("alert is done");
                                            });
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                let alert = this.alertController.create({
                                        title: '로그인 에러가 발생했습니다',
                                        subTitle: '네트웍 상태를 확인하신후 다시 시도해 주시기 바랍니다.',
                                        buttons: ['OK']
                                    });
                                    alert.present();
                                //this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                //this.navController.setRoot(ErrorPage); 
                    }); 
  }

  signup(event){ // move into signup page
      this.navController.push(SignupPage);
  }

  emailReset(event){
      console.log("Please send an email with reset password");
      this.navController.push(PasswordPage);
  }

  scrollUpForKeypad(){ // necessary for android?
        console.log("onFocusPassword");
        let dimensions = this.loginPageRef.getContentDimensions();
        console.log("dimensions:"+JSON.stringify(dimensions));
        if(this.scrollTop>= dimensions.scrollTop)
            this.loginPageRef.scrollTo(0, dimensions.contentHeight);
  }

  tour(){
      console.log("tour");
      /*
      this.emailProvider.EmailServerLogin(ConfigProvider.tourEmail,ConfigProvider.tourPassword).then((res:any)=>{
                console.log("emailLogin-login page:"+JSON.stringify(res));
                if(res.result=="success"){

                }else{

                }
      },(err)=>{
                if(err.hasOwnProperty("status") && err.status==401)
                    console.log("Please login again and then call http request with the same parameter");
                });
                let alert = this.alertController.create({
                    title: '네트웍 상태를 확인하신후 다시 시도해 주시기 바랍니다.',
                    buttons: ['OK']
                });
                alert.present();
      });
      */
  }
}
