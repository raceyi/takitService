
import {Component,NgZone,EventEmitter,ViewChild,Inject} from "@angular/core";
import {Platform,Content,NavController,NavParams,AlertController} from 'ionic-angular';
//import {ErrorPage} from '../error/error';
import {TabsPage} from '../tabs/tabs';
//import {Sim} from 'ionic-native';
import {StorageProvider} from '../../providers/storageProvider';
import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';
import {EmailProvider} from '../../providers/LoginProvider/email-provider';
//import {Focuser} from "../../components/focuser/focuser";
import {Storage} from "@ionic/storage";
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';

declare var window:any;
declare var plugins;
declare var getemail:any;
declare var cordova:any;

@Component({
  selector:'page-signup_submit',   
  templateUrl: 'signup_submit.html'
})

export class SignupSubmitPage {
      userAgreementHidden:boolean=true;
      personalInfoHidden:boolean=true;
      pictureInfoHidden:boolean=true;

      userAgreement:boolean=false;
      personalInfo:boolean=false;
      pictureInfo:boolean=false;

      email:string="";
      password:string="";
      phone:string="";
      country:string="82"; // So far, only Korea is available.
      name:string=""; 
      id:string;
      verfiicationCode:string="";
      phoneValidity:boolean=false; // please initialize it as false and implement 'sms read'
      verfifiedPhone:string="";
      focusPhone= new EventEmitter();
      focusEmail= new EventEmitter();
      focusName = new EventEmitter();
      smsInboxPlugin;

     scrollTop;

      @ViewChild('signupPage') signupPageRef: Content;

  constructor(private navController: NavController, private navParams: NavParams, 
                private fbProvider:FbProvider,private emailProvider:EmailProvider,
                private kakaoProvider:KakaoProvider,private alertController:AlertController,
                private platform: Platform, private storageProvider:StorageProvider,
                public storage:Storage,private http:Http, private ngZone:NgZone){
      console.log("SignupPage construtor");
      if(navParams.get("id")!=undefined){
          this.id=navParams.get("id");
          console.log("[SignupSubmitPage constructor]id:"+navParams.get("id"));
          if(navParams.get("email")!=undefined){
              this.email=navParams.get("email");
          }
          if(navParams.get("name")!=undefined){
              this.name=navParams.get("name");
          }
          // show email, phone #
      }else if(navParams.get("email")!=undefined){
          this.email=navParams.get("email");
          this.password=navParams.get("password");
          console.log("[SignupSubmitPage constructor]email:"+this.email);
      }
  }
 
  ionViewDidEnter() {
       let dimensions = this.signupPageRef.getContentDimensions();
       this.scrollTop=dimensions.scrollTop;

      console.log("SignupPage page did enter");
        if(this.navParams.get("email")==undefined && this.platform.is("cordova") && this.platform.is('android')){
            getemail.getEmail((result:any)=>{
                console.log("GetEmail returns "+JSON.stringify(result));
//                var type;
                function findGoogleAccount(info){
                    return info.type === "com.google";
                }
                this.email=result.find(findGoogleAccount).name;
                console.log("google account:"+result.find(findGoogleAccount).name);
            });
        }
        // get phone number with sim plugin

        if(this.platform.is("android")){
            window.signupPage=this;
            window.plugins.sim.hasReadPermission((result)=>{
                console.log("result:"+JSON.stringify(result));
                if(result){
                    // Why Sim.getSimInfo doesn't work? Workaround solution.
                    window.plugins.sim.getSimInfo(function(result){
                        console.log("sim info:"+JSON.stringify(result));
                        console.log("phone Number:"+result.phoneNumber);
                        let page:SignupSubmitPage=window.signupPage;
                        page.phone=result.phoneNumber;
                    }, function(err){
                        console.log("sim info not found:"+JSON.stringify(err));
                    });
                }else{            
                    //request sim permission. Please check this code API level 23.
                    window.plugins.sim.requestReadPermission((result)=>{
                        if(result){
                                window.plugins.sim.getSimInfo(function(result){
                                let page:SignupSubmitPage=window.signupPage;
                                page.phone=result.phoneNumber;
                            }, function(err){
                                console.log("sim info not found:"+JSON.stringify(err));
                            });
                        }
                    },(error)=>{
                        //console.log("error:"+JSON.stringify(error));
                    })
                }
            }, (error)=>{
                //console.log("error:"+JSON.stringify(error));
            });
        }
  }

  cancelBtn(event){
      this.navController.pop();
  }

  validateEmail(email){   //http://www.w3resource.com/javascript/form/email-validation.php 
    if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)){  
        return (true);  
      }  
      return (false);  
  }  

  signUpBtn(event){
      console.log("signUpBtn");
      // check the validity of phone(sms)
      if(this.phone.length<10){
               if(this.platform.is("android")){
                // give focus into email
                this.focusPhone.emit(true);
              }else{
                let alert = this.alertController.create({
                        title: '휴대폰 번호를 정확히 입력해 주시기바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                    return;
              }  
      }
      if(!this.phoneValidity){
          // give focus into sms checker
           let alert = this.alertController.create({
                title: '휴대폰 번호인증을 수행해 주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
          return;
      }
      // check the validity of email
      if(this.id!=undefined){ // kakao and facebook signup=> check email.
          if(!this.validateEmail(this.email)){
              if(this.platform.is("android")){
                // give focus into email
                this.focusEmail.emit(true);
              }else{
                let alert = this.alertController.create({
                        title: '이메일을 정확히 입력해 주시기바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
              }
              return;
          }
      }
      // check the validity of name      
      if(this.name.trim().length<3){ // The length of name must be more than or equal to 3 
          if(this.platform.is("android")){
            //give focus into name
            this.focusName.emit(true);
          }else{
             let alert = this.alertController.create({
                        title: '이름을 입력해 주시기바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present(); 
          }
          return;
      }
      if(this.userAgreement==false){
            let alert = this.alertController.create({
                title: ' 이용 약관에 동의해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      }
      if(this.personalInfo==false){
            let alert = this.alertController.create({
                title: '개인 정보 처리방침에 동의해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      } 
      if(this.pictureInfo==false){
            let alert = this.alertController.create({
                title: '문자인식 사진정보 사용에 동의해주시기바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
      }

      // call server's signup 
        var phone=this.phone;
        if(this.phone.startsWith("+82")){
                phone="0"+this.phone.slice(3);
        }
        console.log("phone:"+phone);

      if(this.id!=undefined){
          if(this.id.startsWith("kakao_")){
              this.kakaoProvider.kakaoServerSignup(this.id,this.country,phone,this.email,this.name).then(
                (result:any)=>{
                    var serverCode:string=result.result;
                    if(serverCode=="success"){
                        var encrypted:string=this.storageProvider.encryptValue('id','kakao');// save kakao id 
                        this.storage.set('id',encodeURI(encrypted));
                        this.storageProvider.shoplist=[];
                        this.storageProvider.userInfoSet(this.email,this.name,this.phone);
                        this.navController.setRoot(TabsPage);
                    }else if(serverCode=="duplication"){ // result.result=="exist"
                        let alert = this.alertController.create({
                            title: '이미존재하는 아이디입니다.',
                            buttons: ['OK']
                        });
                        alert.present();
                    }else{ 
                        console.log("kakao server signup-unknown result:"+serverCode);
                    }
                    // move into home page.
                    //this.navController.setRoot(... );
                },(error)=>{
                    // You already signed up! please click a link of an email that we sent you. 
                    // It will link your existing account with the way you select at this time.  
                    // Save kakao and exit App.
                });
          }else if(this.id.startsWith("facebook_")){
              this.fbProvider.facebookServerSignup(this.id,this.name,this.email,this.country,phone).then(
                (result:any)=>{
                    // move into home page.  
                    console.log("result..:"+JSON.stringify(result));
                    var serverCode:string=result.result;
                    if(serverCode=="success"){
                        var encrypted:string=this.storageProvider.encryptValue('id','facebook');// save facebook id 
                        this.storage.set('id',encodeURI(encrypted));
                        this.storageProvider.shoplist=[];
                        this.storageProvider.userInfoSet(this.email,this.name,this.phone);
                        this.navController.setRoot(TabsPage);
                    }else  if(serverCode=="duplication"){ // result.result=="exist"
                        let alert = this.alertController.create({
                            title: '이미존재하는 아이디입니다.',
                            buttons: ['OK']
                        });
                        alert.present();
                    }else{
                        console.log("unknown result:"+serverCode);
                    }
                },(error)=>{
                    // You already signed up! please click a link of an email that we sent you. 
                    // It will link your existing account with the way you select at this time.  
                    // Save facebook and exit App.
                });
           }else{
              console.log("unknown login reference id:"+this.id);
          }
        }else{
           this.emailProvider.emailServerSignup(this.password,this.name,this.email,this.country,phone).then( 
            (result:any)=>{
                    // move into home page.  
                    var output:string=result.result;
                    if(output=="success"){
                        var encrypted:string=this.storageProvider.encryptValue('id',this.email);// save kakao id 
                        this.storage.set('id',encodeURI(encrypted));
                        encrypted=this.storageProvider.encryptValue('password',this.password);// save email id 
                        this.storage.set('password',encodeURI(encrypted));
                        this.storageProvider.shoplist=[];
                        this.storageProvider.userInfoSet(this.email,this.name,this.phone);
                        this.navController.setRoot(TabsPage);
                    }else if(output == "duplication"){ // result.result=="exist"
                        let alert = this.alertController.create({
                            title: '이미존재하는 아이디입니다.',
                            buttons: ['OK']
                        });
                        alert.present();
                    }else{ //result.result=="exist"
                        console.log("unknown result:"+output);
                    }
                },(error)=>{
                    // You already signed up! please click a link of an email that we sent you. 
                    // It will link your existing account with the way you select at this time.  
                    // Save email, password and exit App.
                });
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
                    console.log("verificationCode:"+ this.verfiicationCode);
                    this.verfiicationCode=msg.substr(startIdx,6);
                });
                return true;
            }
      }
      
      return false;
  }

  smscheck(){
    console.log("smscheck");
    //https://github.com/Pyo25/Phonegap-SMS-reception-plugin
    if(this.platform.is("android")){
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

   expand(sectionNum){
        console.log("expand:"+sectionNum);
        if(sectionNum==1){
           this.userAgreementHidden=false;
        }else if(sectionNum==2){
           this.personalInfoHidden=false;
        }else if(sectionNum==3){
           this.pictureInfoHidden=false;
        }else{
          console.log("invalid sectionNum:"+sectionNum);
        }

     }

     collapse(sectionNum){
        console.log("collapse:"+sectionNum);
        if(sectionNum==1){
           this.userAgreementHidden=true;
        }else if(sectionNum==2){
           this.personalInfoHidden=true;
        }else if(sectionNum==3){
           this.pictureInfoHidden=true;
        }else{
          console.log("invalid sectionNum:"+sectionNum);
        }
     }

  scrollUpForKeypad(event){
        console.log("scrollUpForKeypad");
        let dimensions = this.signupPageRef.getContentDimensions();
        console.log("dimensions:"+JSON.stringify(dimensions));
        if(this.scrollTop>= dimensions.scrollTop)
            this.signupPageRef.scrollTo(0, dimensions.contentHeight); //humm...
  }

    smsRequest(){
        console.log("smsRequest");
        if(this.phone.length==0){
                    let alert = this.alertController.create({
                        title: '폰번호를 입력해주시기바랍니다.',
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
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress+ " body:"+JSON.stringify(body));

             this.http.post(ConfigProvider.serverAddress+"/SMSCertification",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 console.log(res); 
                 var result:string=res.result;
                 if(result=="success"){
                    //this.phoneValidity=true;
                    this.verfifiedPhone=this.phone;
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
                 console.log("SMSCertification err ");
                 let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
             });                 
        }
    }

    smsVerification(){
        console.log("smsVerification");
        if(this.verfiicationCode.length==6 && this.phone==this.verfifiedPhone){
              var number=this.phone;
              if(this.phone.startsWith("+82")){
                  number="0"+this.phone.slice(3);
              }
              let body = JSON.stringify({phone:number,code:this.verfiicationCode});
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);
              console.log("body:"+JSON.stringify(body)); 
             this.http.post(ConfigProvider.serverAddress+"/checkSMSCode",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 console.log(JSON.stringify(res)); 
                 var result:string=res.result;
                 if(result=="success"){
                    this.phoneValidity=true;
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

    checkPhoneNumberChange(){
        if(this.phoneValidity && this.verfifiedPhone!=this.phone){
            // reset verification
            this.phoneValidity=false;
            this.verfifiedPhone="";
            if(this.platform.is("android")){
                this.smsInboxPlugin.stopReception(()=>{
                        console.log("stop SMS reception");
                    },(err)=>{
                        console.log("stopReception error:"+JSON.stringify(err));
                    });
            }
        }
    }
}






