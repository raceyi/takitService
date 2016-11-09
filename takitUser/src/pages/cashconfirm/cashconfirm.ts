import {Component} from "@angular/core";
import {ViewController,NavParams} from 'ionic-angular';

@Component({
  selector: 'page-cashconfirm',
  templateUrl: 'cashconfirm.html',
})

export class CashConfirmPage{

  constructor(params: NavParams,private viewCtrl: ViewController) {
     // console.log('UserId', params.get('userId'));
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

  cashInComplete(){

  }
}



