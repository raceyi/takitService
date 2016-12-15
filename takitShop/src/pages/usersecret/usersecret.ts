import {Component} from "@angular/core";
//import {Platform,Content} from 'ionic-angular';
import {NavController,NavParams} from 'ionic-angular';
//import {Splashscreen} from 'ionic-native';
import {FbProvider} from '../../providers/LoginProvider/fb-provider';
import {KakaoProvider} from '../../providers/LoginProvider/kakao-provider';
import {EmailProvider} from '../../providers/LoginProvider/email-provider';
import {ErrorPage} from '../error/error';
import{ShopTablePage} from '../shoptable/shoptable';
import{SelectorPage} from '../selector/selector';
import {StorageProvider} from '../../providers/storageProvider';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {Storage} from '@ionic/storage';
import {ServerProvider} from '../../providers/serverProvider';

@Component({
  selector: 'page-usersecret',  
  templateUrl: 'usersecret.html',
})

export class UserSecretPage {
    password:string;
    email:string;
    id:string;
    accessToken:string;

  constructor(private navController: NavController, private navParams: NavParams,
                private fbProvider:FbProvider,private emailProvider:EmailProvider,
                private kakaoProvider:KakaoProvider,private storageProvider:StorageProvider,
                private http:Http,public storage:Storage,private serverProvider:ServerProvider){
      console.log("userSecretPage construtor");
      if(navParams.get("id")!=undefined){
          this.id=navParams.get("id");
          console.log("[UserSecretPage constructor]id:"+navParams.get("id"));
          if(navParams.get("email")!=undefined){
              this.email=navParams.get("email");
          }
          if(navParams.get("accessToken")!=undefined){
              this.accessToken=navParams.get("accessToken");
          }
      }else{
          console.log("[UserSecretPage]move into error Page");
          this.storageProvider.errorReasonSet('앱(페이스북 또는 카카오)으로부터 아이디를 가져올수 없습니다.');
          this.navController.setRoot(ErrorPage);
      }
      
      if(navParams.get("email")!=undefined){
          this.email=navParams.get("email");
      }
  }

    shoplistHandler(userinfo){
      console.log("myshoplist:"+userinfo.myShopList);
        if(!userinfo.hasOwnProperty("myShopList")|| userinfo.myShopList==null){
            this.storageProvider.errorReasonSet('등록된 상점이 없습니다.');
            this.navController.setRoot(ErrorPage);
        }else{
            this.storageProvider.myshoplist=JSON.parse(userinfo.myShopList);
            this.storageProvider.userInfoSetFromServer(userinfo);
            if(this.storageProvider.myshoplist.length==1){
                console.log("move into ShopTablePage myshoplist[0]:"+JSON.stringify(userinfo.myShopList[0]));
                this.storageProvider.myshop=this.storageProvider.myshoplist[0];
                console.log("call navController.push");
                this.navController.setRoot(ShopTablePage);
            }else{ 
                console.log("multiple shops");
                this.navController.setRoot(SelectorPage);
            }
        }
  }


  
  secretSubmit(event){
      this.serverSecretSubmit().then((res:any)=>{
                                console.log("secretSubmit "+JSON.stringify(res));
                                if(res.result=="success"){
                                    if(this.id.startsWith("facebook_")){
                                        var encrypted:string=this.storageProvider.encryptValue('id','facebook');
                                        this.storage.set('id',encodeURI(encrypted));
                                    }else if(this.id.startsWith("kakao_")){    
                                        var encrypted:string=this.storageProvider.encryptValue('id','kakao');
                                        this.storage.set('id',encodeURI(encrypted));
                                    }
                                    this.shoplistHandler(res.shopUserInfo);
                                }else if(res.result=='invalidId'){
                                    console.log("You have no right to access this app");
                                    this.storageProvider.errorReasonSet('접근권한이 없습니다.');
                                    this.navController.setRoot(ErrorPage);
                                }else{
                                    console.log("invalid result comes from server-"+JSON.stringify(res));
                                    this.storageProvider.errorReasonSet('서버로 부터 알수 없는 응답을 받았습니다.');
                                    this.navController.setRoot(ErrorPage);
                                }
      },(err)=>{
           this.storageProvider.errorReasonSet('서버로 응답이 없습니다. 네트웍상태를 확인해주시기 바랍니다.');
           this.navController.setRoot(ErrorPage);
      });
  }
   
  serverSecretSubmit(){
      return new Promise((resolve, reject)=>{

              let body;
              if(this.id.startsWith("facebook_"))
                body = JSON.stringify({referenceId:this.id,email:this.email,password:this.password,token:this.accessToken});
              else
                body = JSON.stringify({referenceId:this.id,email:this.email,password:this.password});

              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);

             //this.http.post(ConfigProvider.serverAddress+"/shop/secretLogin",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
             this.serverProvider.post("/shop/secretLogin",body).then((res:any)=>{     
                 console.log("secretLogin res:"+JSON.stringify(res));
                 resolve(res); // 'success'(move into home page) or 'invalidId'(move into signup page)
             },(err)=>{
                 console.log("secretLogin no response");
                 reject(err);
             });
         });
  } 
}
