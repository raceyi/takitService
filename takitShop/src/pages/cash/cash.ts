import {Component,NgZone} from "@angular/core";
import {NavController,NavParams,AlertController} from 'ionic-angular';
import{ShopTablePage} from '../shoptable/shoptable';
import {Splashscreen} from 'ionic-native';
import {PrinterProvider} from '../../providers/printerProvider';
import {StorageProvider} from '../../providers/storageProvider';
import {Storage} from '@ionic/storage';

@Component({
  selector: 'page-cash',
  templateUrl: 'cash.html',
})

export class CashPage {
    transactions=[];
    infiniteScroll;
    available=10000; // test value
    withdrawAmount;
    bankAccountHidden=true;

  constructor(private navController: NavController, private navParams: NavParams,
                private alertController:AlertController,private ngZone:NgZone,public storage:Storage,
                public storageProvider:StorageProvider){
           console.log("CashPage construtor");
  }

  ionViewDidEnter(){
        console.log("SelectorPage did enter");
  }

  doInfinite(infiniteScroll){

  }

  withdrawCash(){
        
  }

  collapse($event){
     console.log("collpase");
     this.bankAccountHidden=true;
  }

  expand($event){
     console.log("expand");
     this.bankAccountHidden=false;
  }

}
