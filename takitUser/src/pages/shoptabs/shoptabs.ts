import {Component,ViewChild} from '@angular/core'
import {ShopHomePage} from '../shophome/shophome';
import {ShopExitPage} from '../shopexit/shopexit';
import {ShopMyPage} from '../shopmypage/shopmypage';
import {ShopCartPage} from '../shopcart/shopcart';
//import {TabsPage} from '../tabs/tabs';
import {NavController,NavParams,Tabs,Tab,Platform,App} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Device } from 'ionic-native';

@Component({
  //selector:'page-shoptabs', 
  templateUrl: 'shoptabs.html'
})

export class ShopTabsPage {

@ViewChild('shopTabs') tabRef: Tabs;
@ViewChild('shopExitTab') shopExitTabRef: Tab;

  public tabShopExit: any;
  public tabShopHome: any;
  public tabShopCart: any;
  public tabMyPage: any;

  constructor(private platform:Platform, private navController: NavController
  ,private navParams: NavParams,private storageProvider:StorageProvider, private app: App) {
   console.log('Device version is: ' + Device.device.version);

    this.tabShopCart = ShopCartPage;
    this.tabMyPage = ShopMyPage;
    this.tabShopExit=ShopExitPage; 
    this.tabShopHome = ShopHomePage;

    console.log("constructor ShopTabsPage");
    console.log("param(takitId):"+navParams.get("takitId"));
    //Any other way to pass takitId into ShopHome page?
    this.storageProvider.takitId=navParams.get("takitId");
  }

  ionViewDidEnter	(){
    this.storageProvider.shopTabRef=this.tabRef;
  }

  shopExit(event){
     console.log("shopExit tab selected"); 
       this.app.getRootNav().pop();
  }

  shopCart(event){
     console.log("shopCart tab selected"); 
  }

  shopHome(event){
     console.log("shopHome tab selected"); 
  }

  shopOrder(event){
     console.log("shopOrder tab selected"); 
  }

  ionViewWillUnload(){
       console.log("ionViewWillUnload-ShopTabsPage.. "+JSON.stringify(this.storageProvider.shoplistCandidate));
       this.storageProvider.shoplistSet(this.storageProvider.shoplistCandidate);
  }

}
