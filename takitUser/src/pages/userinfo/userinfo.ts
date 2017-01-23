import {Component,EventEmitter,NgZone} from "@angular/core";
import {NavController,NavParams,AlertController} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {App} from 'ionic-angular';
import {ServerProvider} from '../../providers/serverProvider';
import {Http,Headers} from '@angular/http';
import {Storage} from '@ionic/storage';

declare var cordova:any;
declare var zxcvbn:any;

@Component({
  templateUrl: 'userinfo.html',
  selector:'page-userinfo'
})

export class UserInfoPage{
    phone:string;
    email:string;
    name:string;
    loginMethod:string;
    verficationCode:string;

    focusEmail=new EventEmitter(); 
    focusName= new EventEmitter();
    focusPassword=new EventEmitter();
    focusPasswordCheck= new EventEmitter();
    focusOldPassword= new EventEmitter();

    paswordGuideHide;
    passwordMatch;
    paswordGuide;

    password="";
    passwordCheck;
    oldPassword="";
    existingPassword="";

    phoneChange=false;
    smsInboxPlugin;

    phoneValidity=false;
    verifiedPhone="";
    userPhone;

     constructor(public storageProvider:StorageProvider,private alertController:AlertController
        ,private app: App,private navController: NavController, private navParams: NavParams
        ,private serverProvider:ServerProvider,public ngZone:NgZone,private http:Http
        ,public storage:Storage){

	      console.log("UserInfoPage constructor");
          this.getPassword().then((password:string)=>{
              this.existingPassword=password;
               console.log("existing password:"+this.existingPassword);
          }); 
     }

    ionViewWillEnter(){
      this.email=this.storageProvider.email;
      this.name=this.storageProvider.name;
      this.userPhone=this.storageProvider.phone;
      if(this.storageProvider.id.startsWith("facebook"))
          this.loginMethod="페이스북";
      else if(this.storageProvider.id.startsWith("kakao")){
          this.loginMethod="카카오톡";
      }else{
          this.loginMethod="이메일";
      }  
    }

    changePhone(){
        this.phoneChange=true;    
    }

    cancelChangePhone(){
        this.phoneChange=false;    
    }
    
    checkPhoneNumberChange(){
        if(this.phoneValidity && this.verifiedPhone!=this.phone){
            // reset verification
            this.phoneValidity=false;
            this.verifiedPhone="";
            if(this.storageProvider.isAndroid){
                this.smsInboxPlugin.stopReception(()=>{
                        console.log("stop SMS reception");
                    },(err)=>{
                        console.log("stopReception error:"+JSON.stringify(err));
                    });
            }
        }
    }


     smsCodeVerification(msg:string){
      console.log("..."+msg.includes("(") + msg.includes(")"));
      if(msg.includes("(") && msg.includes(")")){
            var startIdx=msg.indexOf("(")+1;
            var endIdx=msg.indexOf(")")-1;
            console.log("..."+startIdx +" "+endIdx);
            if(endIdx==startIdx+5){
                //this.verfiicationCode=msg.substr(startIdx,6);
                //console.log("verificationCode:"+ this.verfiicationCode);
                this.ngZone.run(()=>{
                    console.log("verificationCode:"+ this.verficationCode);
                    this.verficationCode=msg.substr(startIdx,6);
                });
                return true;
            }
      }
      
      return false;
  }
  
  smscheck(){
    console.log("smscheck");
    //https://github.com/Pyo25/Phonegap-SMS-reception-plugin
    if(this.storageProvider.isAndroid){
        if(this.smsInboxPlugin==undefined)
            this.smsInboxPlugin = cordova.require('cordova/plugin/smsinboxplugin');
        this.smsInboxPlugin.isSupported((supported)=>{
            console.log("supported :"+supported);
            if(supported){
                ////////////////////////////////
                this.smsInboxPlugin.startReception ((msg)=> {
                console.log("sms "+msg);
                if(this.smsCodeVerification(msg)){
                    this.smsInboxPlugin.stopReception(()=>{
                        console.log("stop SMS reception");
                    },(err)=>{
                        console.log("stopReception error:"+JSON.stringify(err));
                    });
                }
                },(err)=>{
                    console.log("startReception error:"+JSON.stringify(err));
                });
            }else{
                console.log("SMS is not supported");
            }
        },(err)=>{
            console.log("isSupported:"+JSON.stringify(err));
        });
    }
  }

    smsRequest(){
        console.log("smsRequest");
        if(this.phone.length<9){
                    let alert = this.alertController.create({
                        title: '폰번호를 정확히 입력해주시기바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                          console.log("alert done");
                          
                    });
        }else{
              var number=this.phone;
              if(this.phone.startsWith("+82")){
                  number="0"+this.phone.slice(3);
              }
              console.log("number:"+number); 

              let body = JSON.stringify({phone:number});
              this.serverProvider.post(this.storageProvider.serverAddress+"/SMSCertification",body).then((res:any)=>{
                 console.log(res); 
                 var result:string=res.result;
                 if(result=="success"){
                    //this.phoneValidity=true;
                    this.verifiedPhone=this.phone;
                    this.smscheck();
                    let alert = this.alertController.create({
                        title: '인증번호를 발송했습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                          console.log("alert done");
                    });
                 }else{
                    let alert = this.alertController.create({
                        title: '인증번호 발송에 실패했습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                          console.log("alert done");
                    });
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
             });                 
        }
    }
     
    smsVerification(){
        console.log("smsVerification");
        if(this.verficationCode.length==6 && this.phone==this.verifiedPhone){
              var number=this.phone;
              if(this.phone.startsWith("+82")){
                  number="0"+this.phone.slice(3);
              }
              let body = JSON.stringify({phone:number,code:this.verficationCode});
              console.log("body:"+JSON.stringify(body)); 
              this.serverProvider.post(this.storageProvider.serverAddress+"/checkSMSCode",body).then((res:any)=>{
                 console.log(JSON.stringify(res)); 
                 var result:string=res.result;
                 if(result=="success"){
                    this.phoneValidity=true;

                    this.userPhone=this.verifiedPhone;
                    this.phoneChange=false;

                    let alert = this.alertController.create({
                        title: '인증에 성공했습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                          console.log("alert done");
                    });
                 }else{
                    let alert = this.alertController.create({
                        title: '인증에 실패했습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                          console.log("alert done");
                    });
                 }
             },(err)=>{
                 console.log("SMSCertification err ");
                 let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
             });                   
        }else{
                    let alert = this.alertController.create({
                        title: '인증문자가 형식에 맞지 않습니다.',
                        buttons: ['OK']
                    });
                    alert.present().then(()=>{
                          console.log("alert done");
                    });
        }

    }

    validateEmail(email){   //http://www.w3resource.com/javascript/form/email-validation.php 
        if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)){  
            return (true);  
        }  
        return (false);  
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

  getPassword(){
      return new Promise((resolve, reject)=>{
            this.storage.get("password").then((value:string)=>{
                var password=this.storageProvider.decryptValue("password",decodeURI(value));
                resolve(password);
            },(err)=>{
                reject();
            });
      });
  }

  restPasswordMatch(){
      this.passwordMatch=true;
  }

  modify(){
         console.log("modify");
         /*
         if((this.loginMethod!="이메일" && 
                this.email==this.storageProvider.email &&
                this.phone==this.storageProvider.phone &&
                this.name==this.storageProvider.name)||(
                this.loginMethod=="이메일" &&
                this.email==this.storageProvider.email &&
                this.phone==this.storageProvider.phone &&
                this.name==this.storageProvider.name &&
                this.existingPassword==this.password)){
                    console.log("no modification");
                return;
         }*/

         console.log("modify-1");
         if(this.phoneChange && this.phone!=this.storageProvider.phone){
             if(!this.phoneValidity || this.phone!=this.verifiedPhone){
                 let alert = this.alertController.create({
                    title: '휴대폰 번호인증을 수행해 주시기바랍니다.',
                    buttons: ['OK']
                });
                alert.present();
                return;
             }
         }

         console.log("modify-2");
         
         if(!this.validateEmail(this.email)){
          console.log("invalid email");
          if(this.storageProvider.isAndroid){
            this.focusEmail.emit(true);    
          }else{ //ios
              let alert = this.alertController.create({
                        title: '정상 이메일을 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
          }
          return;
        }

       console.log("modify-3");
      if(this.loginMethod=="이메일" && !this.passwordValidity(this.password)){
          this.paswordGuideHide=false;
          if(this.storageProvider.isAndroid)
                this.focusPassword.emit(true);
          return;
      }else{
          this.paswordGuideHide =true; 
      }

       console.log("modify-4"); 
      if(this.loginMethod=="이메일" && this.password!=this.passwordCheck){
          console.log("password:"+this.password+ "passwordCheck:"+this.passwordCheck);
          this.passwordMatch=false;
          if(this.storageProvider.isAndroid)
            this.focusPasswordCheck.emit(true);
          return;
      }else
          this.passwordMatch=true;

      console.log("modify-5 "); 
      if(this.loginMethod=="이메일" && this.oldPassword.length==0){
          if(this.storageProvider.isAndroid){
            this.focusOldPassword.emit(true);    
          }else{ //ios
              let alert = this.alertController.create({
                        title: '기존 비밀번호를 입력해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
          }
          return;
      }

        console.log("modify-6"); 
        if(this.loginMethod=="이메일" && this.existingPassword!=this.oldPassword){
                let alert = this.alertController.create({
                            title: '기존 비밀번호가 일치하지 않습니다.',
                            buttons: ['OK']
                        });
                        alert.present();
        }
         console.log("modify-7"); 

         let body = JSON.stringify({email:this.email.trim(),
                                    newPassword:this.password,
                                    oldPassword:this.oldPassword, 
                                    phone:this.userPhone.trim(), 
                                    name:this.name.trim()});

         console.log("call modifyUserInfo "+JSON.stringify(body));
         console.log("existing password:"+this.existingPassword);

         this.serverProvider.post(this.storageProvider.serverAddress+"/modifyUserInfo",body).then((res:any)=>{
             console.log("res:"+JSON.stringify(res));
             if(res.result=="success"){
                 this.storageProvider.email=this.email.trim();
                 this.storageProvider.phone=this.userPhone.trim();
                 this.storageProvider.name=this.name.trim();
                 var encrypted=this.storageProvider.encryptValue('password',this.password);// save email id 
                 this.storage.set('password',encodeURI(encrypted));
                 this.existingPassword=this.password;
                 
                let alert = this.alertController.create({
                            title: "회원 정보가 수정되었습니다",
                            buttons: ['OK']
                        });
                        alert.present();
             }else{
                let alert = this.alertController.create({
                            title: "회원 정보 수정에 실패했습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
             }
         },(err)=>{
             if(err=="NetworkFailure"){
                let alert = this.alertController.create({
                            title: "서버와 통신에 문제가 있습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
            }else{
                let alert = this.alertController.create({
                            title: "회원 정보 수정에 실패했습니다.",
                            buttons: ['OK']
                        });
                        alert.present();
            }
         });
     }

}

