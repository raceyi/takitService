import {Component,EventEmitter,ViewChild} from "@angular/core";
import {Content,NavController,NavParams,Platform,AlertController} from 'ionic-angular';
//import {Splashscreen} from 'ionic-native';
import{SignupSubmitPage} from "../signup_submit/signup_submit";

//import {Focuser} from "../../components/focuser/focuser";

import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';
import {EmailProvider} from '../../providers/LoginProvider/email-provider';

import {Splashscreen} from 'ionic-native';

declare var zxcvbn:any;

@Component({
  selector:'page-signup',    
  templateUrl: 'signup.html',
})

export class SignupPage {
    password:string;
    email:string;
    passwordCheck:string;

    emailHide:boolean=true;
    passwordMatch:boolean=true;
    paswordGuideHide:boolean=false;

    paswordGuide:string="영문대문자,영문소문자,특수문자,숫자 중 3개 이상 선택, 8자리 이상으로 구성하세요";

    focusEmail= new EventEmitter();
    focusPassword= new EventEmitter();
    focusPasswordCheck= new EventEmitter();

    scrollTop;

    @ViewChild('signupPage') signupPageRef: Content;

  constructor(private navController: NavController, private navParams: NavParams,
                private fbProvider:FbProvider,private emailProvider:EmailProvider,
                private kakaoProvider:KakaoProvider,private platform:Platform,
                private alertController:AlertController){
      console.log("SignupPage construtor");
      if(navParams.get("email")!=undefined){
          this.email=navParams.get("email");
      }
  }
 
   ionViewDidEnter() {
        console.log("Login page did enter");
        Splashscreen.hide();
        let dimensions = this.signupPageRef.getContentDimensions();
        this.scrollTop=dimensions.scrollTop;
  }

  emailSignupSelect(event){
      this.emailHide=!this.emailHide;      
  }

  dummyHandler(id){
      console.log("dummyHandler called");
      return new Promise((resolve, reject)=>{
          console.log("dummyHandler with id "+id);
          resolve({id:id});
      });
  }

  facebookSignup(event){
          console.log("facebookSignup");
        // call facebook sign up with email, facebookid.
          this.fbProvider.fblogin(this.dummyHandler,this.fbProvider).then((res:any)=>{
              var param:any={id:res.id};
              if(res.hasOwnProperty("email")){
                  param.email=res.email;
              }
              if(res.hasOwnProperty("name")){
                  param.name=res.name;
              }
              this.navController.push(SignupSubmitPage,param);
          },(err)=>{
              console.log("facebook login failure");              
          });    
  }

  kakaoSignup(event){
      // call kakao sign up with kakaoid.
          this.kakaoProvider.kakaologin(this.dummyHandler,this.kakaoProvider).then((res:any)=>{
              var param:any={id:res.id};
              this.navController.push(SignupSubmitPage,param);
          },(err)=>{
              console.log("kakao login failure");              
          });   
  }
  
  passwordValidity(password){
      var number = /\d+/.test(password);
      var smEng = /[a-z]+/.test(password);
      var bigEng= /[A-Z]+/.test(password);
      var special = /[^\s\w]+/.test(password);
      var digits = /.{8,}/.test(password);
      var result = zxcvbn(password);

      if(result.guesses >1000000000){
        if(number && smEng && bigEng && digits){
          return true;
        }
        else if(number && smEng && special && digits){
          return true;
        }
        else if(smEng && bigEng && special && digits){
          return true;
        }
        else if(number && bigEng && special && digits){
          return true;
        }
        else{
          this.paswordGuide = "영문대문자,영문소문자,특수문자,숫자 중 3개 이상 선택, 8자리 이상으로 구성하세요";
          return false;
        }
      }
      else{
        this.paswordGuide ="비밀번호는 연속문자,숫자 및 영단어를 사용할 수 없습니다.";
        return false;
      }
  }

  validateEmail(email){   //http://www.w3resource.com/javascript/form/email-validation.php 
    if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)){  
        return (true);  
      }  
      return (false);  
  }  

  emailSignup(event){
      // How to check if email is valid or not
      if(!this.validateEmail(this.email)){
          console.log("invalid email");
          if(this.platform.is('android')){
            this.focusEmail.emit(true);    
          }else if(this.platform.is('ios')){
              let alert = this.alertController.create({
                        title: '정상 이메일을 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
          }
          return;
      }
      if(!this.passwordValidity(this.password)){
          this.paswordGuideHide=false;
          if(this.platform.is('android'))
                this.focusPassword.emit(true);
          return;
      }else{
          this.paswordGuideHide =true; 
      }

      if(this.password!=this.passwordCheck){
          this.passwordMatch=false;
          if(this.platform.is('android'))
            this.focusPasswordCheck.emit(true);
          return;
      }else
          this.passwordMatch=true;
      // move into signup_submit page
      console.log("move into signup_submit page");
      this.navController.push(SignupSubmitPage,{
         email:this.email,
         password:this.password
      });
  }

  scrollUpForKeypad(){ // necessary for android?
        console.log("scrollUpForKeypad");
        let dimensions = this.signupPageRef.getContentDimensions();
        console.log("dimensions:"+JSON.stringify(dimensions));
        if(this.scrollTop>= dimensions.scrollTop){
            this.signupPageRef.scrollTo(0, dimensions.contentHeight);
        }
  }

}