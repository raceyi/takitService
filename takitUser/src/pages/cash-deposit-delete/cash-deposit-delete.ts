import { Component } from '@angular/core';
import { NavController,App, NavParams,AlertController } from 'ionic-angular';
import {ServerProvider} from '../../providers/serverProvider';
import {StorageProvider} from '../../providers/storageProvider';

/*
  Generated class for the CashDepositDelete page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-cash-deposit-delete',
  templateUrl: 'cash-deposit-delete.html'
})
export class CashDepositDeletePage {
  tuno;

  constructor(public navCtrl: NavController, public navParams: NavParams,private app:App, 
      private serverProvider:ServerProvider,public storageProvider:StorageProvider, params: NavParams
      ,private alertController:AlertController) {
      console.log("CashDepositDeletePage constructor "+JSON.stringify(params.get('tuno')));
      this.tuno=params.get('tuno');
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad CashDepositDeletePage');
  }

  deleteDepositInput(){
    let body = JSON.stringify({cashTuno:this.tuno});
          
    console.log("removeWrongCashList:"+body);
    this.serverProvider.post(this.storageProvider.serverAddress+"/removeWrongCashList",body).then((res:any)=>{
            console.log("removeWrongCashList:"+JSON.stringify(res));
            if(res.result=="success"){
                this.app.getRootNav().pop();
            }else{
                  let alert = this.alertController.create({
                      title: "캐쉬입금 삭제에 실패했습니다. 잠시후 다시 시도해 주시기 바랍니다.",
                      subTitle:res.error,
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
                                title: "캐쉬입금 삭제에 실패했습니다. 잠시후 다시 시도해 주시기 바랍니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                    }
    });

  }

  dismiss(){
    this.app.getRootNav().pop();
  }
}
