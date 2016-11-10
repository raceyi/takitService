import {Component,EventEmitter,ViewChild} from "@angular/core";
import {Content} from 'ionic-angular';
import {NavController,NavParams} from 'ionic-angular';
import {Splashscreen} from 'ionic-native';
import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';
import {EmailProvider} from '../../providers/LoginProvider/email-provider';
import {Platform,AlertController} from 'ionic-angular';
import {ErrorPage} from '../error/error';
import{ShopTablePage} from '../shoptable/shoptable';
import{SelectorPage} from '../selector/selector';
import {UserSecretPage} from '../usersecret/usersecret';
import {StorageProvider} from '../../providers/storageProvider';
import {Storage} from '@ionic/storage';

@Component({
  selector: 'page-login',  
  templateUrl: 'login.html',
})

export class LoginPage {
    password:string;
    email:string;
    emailHide:boolean=true;
    @ViewChild('loginPage') loginPageRef: Content;
    scrollTop;
    focusEmail = new EventEmitter();;
    focusPassword =new EventEmitter();

  constructor(private navController: NavController, private navParams: NavParams,
                private fbProvider:FbProvider,private emailProvider:EmailProvider,
                private kakaoProvider:KakaoProvider,private storageProvider:StorageProvider,
                public storage:Storage,private platform:Platform,
                private alertController:AlertController){
      console.log("LoginPage construtor");
  }
 
   ionViewDidEnter() {
        console.log("Login page did enter");
        Splashscreen.hide();
        let dimensions = this.loginPageRef.getContentDimensions();
        this.scrollTop=dimensions.scrollTop;
  }

  shoplistHandler(userinfo){
      console.log("myshoplist:"+userinfo.myShopList);
        if(!userinfo.hasOwnProperty("myShopList")|| userinfo.myShopList==null){
            this.storageProvider.errorReasonSet('등록된 상점이 없습니다.');
            this.navController.setRoot(ErrorPage);
        }else{
            this.storageProvider.myshoplist=JSON.parse(userinfo.myShopList);
            if(this.storageProvider.myshoplist.length==1){
                console.log("move into ShopTablePage");
                this.storageProvider.myshop=this.storageProvider.myshoplist[0];
                this.navController.setRoot(ShopTablePage);
            }else{ 
                console.log("multiple shops");
                this.navController.setRoot(SelectorPage);
            }
        }
  }

  dummyHandler(id,fbProvider,accessToken){
      console.log("dummyHandler called");
      return new Promise((resolve, reject)=>{
          console.log("dummyHandler with id "+id);
            resolve({id:id,accessToken:accessToken});
      });
  }

  facebookLogin(event){
      console.log('facebookLogin comes');
          this.fbProvider.fblogin(this.dummyHandler,this.fbProvider).then((res:any)=>{
              console.log("res:"+JSON.stringify(res));
              var param:any={id:res.id};
              if(res.hasOwnProperty("email")){
                  param.email=res.email;
              }
              if(res.hasOwnProperty("id")){
                  param.id=res.id;
              }
              if(res.hasOwnProperty("accessToken")){
                  param.accessToken=res.accessToken;
              }
              this.navController.push(UserSecretPage,param);
          },(err)=>{
              console.log("facebook login failure");              
          });    
  }

  dummyHandlerKakao(id){
      console.log("dummyHandler called");
      return new Promise((resolve, reject)=>{
          console.log("dummyHandler with id "+id);
          resolve({id:id});
      });
  }

  kakaoLogin(event){
      console.log('kakaoLogin comes');
                this.kakaoProvider.kakaologin(this.dummyHandlerKakao,this.kakaoProvider).then((res:any)=>{
              var param:any={id:res.id};
              this.navController.push(UserSecretPage,param);
          },(err)=>{
              console.log("kakao login failure");              
          });   
  }

  emailLogin(event){
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

      console.log('emailLogin comes email:'+this.email+" password:"+this.password);          
      this.emailProvider.EmailServerLogin(this.email,this.password).then((res:any)=>{
                                console.log("emailLogin-login page:"+JSON.stringify(res));
                                if(res.result=="success"){
                                    var encrypted:string=this.storageProvider.encryptValue('id',this.email);
                                    this.storage.set('id',encodeURI(encrypted));
                                    encrypted=this.storageProvider.encryptValue('password',this.password);
                                    this.storage.set('password',encodeURI(encrypted));
                                    this.shoplistHandler(res.shopUserInfo);   
                                }else if(res.result=='invalidId'){
                                    console.log("You have no right to access this app");
                                    this.storageProvider.errorReasonSet('접근권한이 없습니다.');
                                    this.navController.setRoot(ErrorPage);
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                    this.navController.setRoot(ErrorPage);
                                }
                            },login_err =>{
                                console.log(JSON.stringify(login_err));
                                this.storageProvider.errorReasonSet('로그인 에러가 발생했습니다');
                                this.navController.setRoot(ErrorPage); 
                    }); 
  }

  emailReset(event){
      console.log("Please send an email with reset password");
  }

  scrollUpForKeypad(event){
        console.log("onFocusPassword");
        let dimensions = this.loginPageRef.getContentDimensions();
        console.log("dimensions:"+JSON.stringify(dimensions));
        if(this.scrollTop>= dimensions.scrollTop)
            this.loginPageRef.scrollTo(0, dimensions.contentHeight);
  }

  emailLoginSelect(event){
      this.emailHide=!this.emailHide;      
  }

}
