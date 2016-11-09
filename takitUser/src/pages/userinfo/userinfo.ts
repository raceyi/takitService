import {Component,EventEmitter} from "@angular/core";
import {NavController,NavParams,AlertController} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {App} from 'ionic-angular';

@Component({
  templateUrl: 'userinfo.html',
  selector:'page-userinfo'
})

export class UserInfoPage{
    phone:string;
    email:string;
    name:string;
    loginMethod:string;
    verfiicationCode:string;

    focusEmail=new EventEmitter(); 
    focusName= new EventEmitter();
    focusPassword=new EventEmitter();
    focusPasswordCheck= new EventEmitter();

    paswordGuideHide;
    passwordMatch;
    paswordGuide;

    password;
    passwordCheck;

     constructor(private storageProvider:StorageProvider,private alertController:AlertController,private app: App,private navController: NavController, private navParams: NavParams){
	      console.log("UserInfoPage constructor");
     }

    ionViewWillEnter(){
      this.email=this.storageProvider.email;
      this.name=this.storageProvider.name;
      this.phone=this.storageProvider.phone;
      if(this.storageProvider.id.startsWith("facebook"))
          this.loginMethod="페이스북";
      else if(this.storageProvider.id.startsWith("kakao")){
          this.loginMethod="카카오톡";
      }else{
          this.loginMethod="이메일";
      }  
    }

     smsVerification(){

     }

     smsRequest(){

     }
     //비밀번호 수정 루틴도 추가가 필요하다. 기존 비번 넣고 수정하도록 하자.
     
     modify(){
        let alert = this.alertController.create({
            title: '구현중입니다.',
            buttons: ['OK']
        });
        alert.present();
     }

     scrollUpForKeypad(){

     }
}

