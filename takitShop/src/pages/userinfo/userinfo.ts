import {Component,EventEmitter,NgZone} from "@angular/core";
import {NavController,NavParams,AlertController} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {App} from 'ionic-angular';
import {ServerProvider} from '../../providers/serverProvider';
import {ConfigProvider} from '../../providers/ConfigProvider';
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
    
     constructor(public storageProvider:StorageProvider,private alertController:AlertController
        ,private app: App,private navController: NavController, private navParams: NavParams
        ,private serverProvider:ServerProvider,public ngZone:NgZone,private http:Http
        ,public storage:Storage){
	      console.log("UserInfoPage constructor");
     }

    ionViewWillEnter(){
      this.email=this.storageProvider.email;
      this.name=this.storageProvider.name;
      this.phone=this.storageProvider.phone;
      console.log("UserInfoPage- email:"+this.storageProvider.email);      
      if(this.storageProvider.id.startsWith("facebook"))
          this.loginMethod="페이스북";
      else if(this.storageProvider.id.startsWith("kakao")){
          this.loginMethod="카카오톡";
      }else{
          this.loginMethod="이메일";
      }  
    }


}

