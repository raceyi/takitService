import {Component} from '@angular/core';
import {App,NavController,NavParams,Tabs,AlertController} from 'ionic-angular';
import {Platform} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {ViewChild} from '@angular/core';
import {Content} from 'ionic-angular';
import {Device} from 'ionic-native';
import {CashIdPage} from '../cashid/cashid';

@Component({
  selector: 'page-cash',
  templateUrl: 'cash.html'
})
export class CashPage {
  cashMenu: string = "cashIn";
  available: string ="15000";
  isAndroid: boolean = false;

  //minVersion:boolean=(this.platform.is('android') && parseInt(Device.device.version[0])<=4);

  @ViewChild("cashContent") contentRef: Content;

  constructor(private app:App,private platform:Platform, private navController: NavController
  ,private navParams: NavParams,public http:Http ,private alertController:AlertController) {
      this.isAndroid = platform.is('android');
      console.log(" param: "+this.navParams.get('param'));

  }
/*
 ionViewDidEnter(){
    let dimensions=this.contentRef.getContentDimensions();
    let height=this.contentRef.getNativeElement().parentElement.offsetHeight-dimensions.contentTop;
    console.log("pageHeight:"+this.contentRef.getNativeElement().parentElement.offsetHeight+"top:"+dimensions.contentTop+"menusHeight:"+height);
    this.contentRef.getScrollElement().setAttribute("style","height:"+height+"px;margin-top:0px;");
 }
*/
    createTimeout(timeout) {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(null),timeout)
        })
    }

  cashInCheck(confirm){
      console.log("cashInCheck comes(confirm)");
      this.createTimeout(15000)
                .then(() => {
                    console.log(`done after 300ms delay`);
                    this.contentRef.scrollToTop(); 
                    let body = JSON.stringify({});
                    let headers = new Headers();
                    headers.append('Content-Type', 'application/json');
                    console.log("server:"+ ConfigProvider.serverAddress);
                    this.http.post(ConfigProvider.serverAddress+"/triggerCashCheck",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                        var result:string=res.result;
                        if(result=="success"){
                            console.log("triggerCashCheck sent successfully");
                        }
                    },(err)=>{
                            console.log("http post err");
                            let alert = this.alertController.create({
                                title: '서버와 통신에 문제가 있습니다',
                                subTitle: '네트웍상태를 확인해 주시기바랍니다',
                                buttons: ['OK']
                            });
                            alert.present();
                    });
                });
  }

  cashInComplete(event){
      console.log("cashInComplete");
      this.available="20000";
      //this.content.scrollToTop();
  }
  
  configureCashId(){
      // move into CertPage and then 
    this.app.getRootNav().push(CashIdPage);
  }

}
