import {Component,NgZone} from "@angular/core";
import {ViewController,NavParams,NavController,AlertController,App} from 'ionic-angular';
import {ServerProvider} from '../../providers/serverProvider';
import {StorageProvider} from '../../providers/storageProvider';
import {CashDepositDeletePage} from '../cash-deposit-delete/cash-deposit-delete';

@Component({
  selector: 'page-cashconfirm',
  templateUrl: 'cashconfirm.html',
})

export class CashConfirmPage{

  depositAmount;
  depositBank;
  depositMemo;
  depositDate;
  depositBranch;
  tuno;
  userAgree=false;
  
  constructor(params: NavParams,public viewCtrl: ViewController
      ,private alertController:AlertController,public storageProvider:StorageProvider,
      private serverProvider:ServerProvider,private ngZone:NgZone,
      private navController: NavController,public app:App) {
      console.log('CashConfirmPage -constructor custom:'+ JSON.stringify(params.get('custom')));
      let custom=params.get('custom');
      
      //let custom=JSON.parse("{\"depositMemo\":\"이경주\",\"amount\":\"2\",\"depositDate\":\"2017-01-06\",\"branchCode\":\"0110013\",\"cashTuno\":\"20170106093158510\",\"bankName\":\"농협\"}");
      //let custom:any={"depositMemo":"이경주","amount":"2","depositDate":"2017-01-06","branchCode":"0110013","cashTuno":"20170106093158510","bankName":"농협"};

      this.depositAmount=parseInt(custom.amount);
      console.log("depositAmount:"+this.depositAmount);

      this.depositBank=custom.bankName;
      console.log("depositBank:"+this.depositBank);

      if(custom.hasOwnProperty("branchName")){
          this.depositBranch=custom.branchName;
      }else{
          this.depositBranch=custom.branchCode;
      }

      if(custom.hasOwnProperty("depositMemo")){
            this.depositMemo=custom.depositMemo;
      }else{
            this.depositMemo=custom.cashId;
      }

      console.log("depositBank:"+this.depositMemo);

      if(custom.hasOwnProperty("depositDate")){
          this.depositDate=custom.depositDate;     
      }else{
        var date:string=custom.transactionTime;
        if(date.includes("-")){
        console.log("date:"+date);
        this.depositDate=date.substr(0,4)+"."+date.substr(5,2)+"."+date.substr(8,2);     
        }else{
        console.log("date:"+date);
        this.depositDate=date.substr(0,4)+"."+date.substr(4,2)+"."+date.substr(6,2);     
        }
      }

      console.log("depositDate:"+this.depositDate);

      this.tuno=custom.cashTuno;
      
      console.log("tuno:"+this.tuno);
  }

/*
  ionViewDidEnter(){
      console.log("ionicViewDidEnter");
      this.ngZone.run(()=>{
      });
  }
 */

  dismiss() {
    this.viewCtrl.dismiss();
    this.storageProvider.cashInfoUpdateEmitter.emit("listOnly");
  }

  agreeChange(flag){
    console.log("[agreeChange] userAgree:"+flag);
    this.ngZone.run(()=>{
        this.userAgree=flag;
    });
  }

  cashInComplete(){
      if(this.userAgree){
          //let body = JSON.stringify({cashId:this.depositMemo, amount:this.depositAmount, cashTuno:this.tuno});
          let body = JSON.stringify({cashId:this.storageProvider.cashId, amount:this.depositAmount, cashTuno:this.tuno});
          
          console.log("cashInComplete:"+body);
          this.serverProvider.post(this.storageProvider.serverAddress+"/addCash",body).then((res:any)=>{
                    console.log("addCash:"+JSON.stringify(res));
                    if(res.result=="success"){
                      this.storageProvider.cashInfoUpdateEmitter.emit("all");
                      this.viewCtrl.dismiss();
                    }else{ 
                          if(res.error=="already checked cash"){
                              let alert = this.alertController.create({
                                  title: "이미 확인된 입금입니다.",
                                  buttons: ['OK']
                              });
                              alert.present();
                          }else{
                            let alert = this.alertController.create({
                                title: "캐쉬입금에 실패했습니다. 전체내역에서 입금 확인이 가능합니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                          }
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
                                title: "캐쉬아이디 설정에 실패했습니다. 잠시후 다시 시도해 주시기 바랍니다.",
                                buttons: ['OK']
                            });
                            alert.present();
                    }
          });         
      }else{
            let alert = this.alertController.create({
                title: "법적 경고 사항에 동의해 주시기 바랍니다.",
                buttons: ['OK']
            });
            alert.present();
      }
  }

  deleteDeposit(){
       var param:any={tuno:this.tuno};
       this.viewCtrl.dismiss();
       this.app.getRootNav().push(CashDepositDeletePage,param);
  }
}



