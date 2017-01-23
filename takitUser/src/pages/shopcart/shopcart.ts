import {Component,NgZone,ViewChild,ElementRef} from "@angular/core";
import {NavController,NavParams,Content,AlertController,Tabs} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ServerProvider} from '../../providers/serverProvider';
import {Keyboard} from 'ionic-native';

declare var cordova:any;

@Component({
    selector:'page-shopcart',
    templateUrl: 'shopcart.html'
})

export class ShopCartPage{
    @ViewChild('shopcartPage') orderPageRef: Content;
    @ViewChild('takeoutDiv') takeoutDivElementRef:ElementRef;

    shopname:string;
    userNotiHidden:boolean =false;
    price:number=0;    //total price
    discount:number=0; //total discount
    amount:number=0;   //total amount. acutual price with discount
    cart:any={};
    takeoutAvailable:boolean=false;
    takeout:boolean=false;
    cashPassword="";

    iOSOrderButtonHide=true;

     constructor(private navController: NavController,private http:Http,
            private navParams: NavParams,public storageProvider:StorageProvider,
            private alertController:AlertController,private serverProvider:ServerProvider,
            private ngZone:NgZone,){
	      console.log("ShopCartPage constructor");
        this.shopname=this.storageProvider.currentShopname();
        this.cart=this.storageProvider.cart;
        if(this.cart!=undefined){
            this.price=this.cart.total;
            this.discount=Math.round(this.cart.total*this.storageProvider.shopInfo.discountRate);
            this.amount=this.price-this.amount;
        }
        if(!this.storageProvider.isAndroid){ //ios
            Keyboard.onKeyboardShow().subscribe((e)=>{
                console.log("keyboard show");
                this.ngZone.run(()=>{
                    this.iOSOrderButtonHide=false;
                });
            });
            Keyboard.onKeyboardHide().subscribe((e)=>{
                console.log("keyboard hide");
                 setTimeout(() => {
                    this.ngZone.run(()=>{
                        this.iOSOrderButtonHide=true;
                    });
                  }, 1000); 
            });
        }
     }

    checkTakeoutAvailable(){
        //console.log("checkTakeoutAvailable-begin");
        if(this.cart.hasOwnProperty("menus")){
          var i;
          var takeoutAvailable=true;
          for(i=0;i<this.cart.menus.length;i++){
              if( !this.cart.menus[i].hasOwnProperty("takeout") || 
                  (this.cart.menus[i].takeout==null) || 
                  (this.cart.menus[i].takeout==false)){ // humm... please add takeout field into all menus...
                     takeoutAvailable=false;
                     break; 
              }
          }
          this.takeoutAvailable=takeoutAvailable;
        }
        //console.log("checkTakeoutAvailable-end");
    }


    ionViewWillEnter(){
        //console.log("shopcartPage-ionViewWillEnter");
        this.cart=this.storageProvider.cart;        
        this.price=this.cart.total;
        this.discount=Math.round(this.cart.total*this.storageProvider.shopInfo.discountRate);
        this.amount=this.price-this.discount;
        this.checkTakeoutAvailable();
        //console.log("takeoutAvailable:"+this.takeoutAvailable);
        if(this.takeoutAvailable==false){
            this.takeoutDivElementRef.nativeElement.style.border="none";
            //console.log(".."+this.takeoutDivElementRef.nativeElement.style.border);
        }
    }

    ionViewDidEnter(){
        //console.log("shopcartPage-ionViewDidEnter");
    }

     emptyCart(){
        //console.log("return "+(this.cart.menus==undefined || this.cart.menus.length==0));
        return(this.cart.menus==undefined || this.cart.menus.length==0);
     }

     nonEmptyCart(){
       return(this.cart.menus!=undefined && this.cart.menus.length>0);
     }

     order(){
         if(this.storageProvider.tourMode){
            let alert = this.alertController.create({
                title: '둘러보기 모드에서는 주문이 불가능합니다.',
                subTitle: '로그인후 사용해주시기 바랍니다.',
                buttons: ['OK']
            });
            alert.present();
             return;
         }

        if(this.storageProvider.cashId==undefined ||
                    this.storageProvider.cashId.length<5){
            let alert = this.alertController.create({
                subTitle: '캐쉬아이디를 설정해 주시기 바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;               
        }
        if(this.cashPassword.length<6){
            let alert = this.alertController.create({
                subTitle: '캐쉬비밀번호(6자리)를 입력해 주시기 바랍니다.',
                buttons: ['OK']
            });
            alert.present();
            return;               
        }         
         if(this.storageProvider.cashAmount<this.amount){
             let alert = this.alertController.create({
                subTitle: '캐쉬잔액이 부족합니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
         }
       if(this.storageProvider.tourMode==false){  
            console.log("order ");
             ////////////////////////////////////////////////////
             var takeout;
             if(this.takeout==true){
                 takeout=1;
             }else
                 takeout=0;
              let body = JSON.stringify({paymethod:"cash",
                                        takitId:this.storageProvider.takitId,
                                        orderList:JSON.stringify(this.cart), 
                                        orderName:this.cart.menus[0].menuName+"이외"+ this.cart.menus.length+"종",
                                        amount:this.amount,
                                        takeout: takeout,
                                        orderedTime:new Date().toISOString(),
                                        cashId:this.storageProvider.cashId,
                                        password:this.cashPassword});
              console.log("order:"+JSON.stringify(body));

              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ this.storageProvider.serverAddress);
                 this.serverProvider.saveOrder(body).then((res:any)=>{
                 console.log(res); 
                 this.cashPassword="";  
                 var result:string=res.result;
                  if(result=="success"){
                    this.storageProvider.messageEmitter.emit(res.order);
                    this.storageProvider.cashInfoUpdateEmitter.emit("all");
                    var cart={menus:[],total:0};
                    this.storageProvider.saveCartInfo(this.storageProvider.takitId,JSON.stringify(cart)).then(()=>{
                        
                    },()=>{
                            //move into shophome
                            let alert = this.alertController.create({
                                    title: '장바구니 정보 업데이트에 실패했습니다',
                                    buttons: ['OK']
                                });
                                alert.present();
                    });
                    console.log("storageProvider.run_in_background: "+this.storageProvider.run_in_background);
                    if(this.storageProvider.run_in_background==false){
                        let confirm = this.alertController.create({
                            title: '주문에 성공하였습니다.'+'주문번호['+res.order.orderNO+']',
                            message: '[주의]앱을 종료하시면 주문알림을 못받을수 있습니다. 주문알림을 받기 위해 앱을 계속 실행하시겠습니까?',
                            buttons: [
                            {
                                text: '아니오',
                                handler: () => {
                                    console.log('Disagree clicked');
                                    // report it to tabs page
                                    this.storageProvider.tabMessageEmitter.emit("stopEnsureNoti"); 
                                    //move into shophome
        +                           this.storageProvider.shopTabRef.select(3);
                                    return;
                                }
                            },
                            {
                                text: '네',
                                handler: () => {
                                    console.log('cordova.plugins.backgroundMode.enable');
                                    this.storageProvider.tabMessageEmitter.emit("backgroundEnable");
                                    cordova.plugins.backgroundMode.enable(); 
        +                           this.storageProvider.shopTabRef.select(3);
                                    return;
                                }
                            }
                            ]
                        });
                        confirm.present();
                    }else{
                        let alert = this.alertController.create({
                                title: '주문에 성공하였습니다.'+'주문번호['+res.order.orderNO+']',
                                subTitle: '[주의]앱을 종료하시면 주문알림을 못받을수 있습니다.' ,
                                buttons: ['OK']
                        });
                        alert.present().then(()=>{
                            this.storageProvider.shopTabRef.select(3);
                        });  
                    }
                 }else{
                    let alert = this.alertController.create({
                        title: '주문에 실패하였습니다.',
                        subTitle: '다시 주문해주시기 바랍니다.',
                        buttons: ['OK']
                    });
                    alert.present();
                 }
             },(error)=>{
                  console.log("saveOrder err "+error);
                  this.cashPassword="";                  
                 if(error=="NetworkFailure"){
                    let alert = this.alertController.create({
                            title: '서버와 통신에 문제가 있습니다',
                            subTitle: '네트웍상태를 확인해 주시기바랍니다',
                            buttons: ['OK']
                        });
                        alert.present();
                 }else if(error=="shop's off"){
                    let alert = this.alertController.create({
                            title: '상점이 문을 열지 않았습니다.',
                            buttons: ['OK']
                        });
                        alert.present();
                 }else if(error=="invalid cash password"){
                    let alert = this.alertController.create({
                            title: '비밀번호가 일치하지 않습니다.',
                            buttons: ['OK']
                        });
                        alert.present();
                 }else{
                    let alert = this.alertController.create({
                            title: '주문에 실패했습니다.',
                            buttons: ['OK']
                        });
                        alert.present();                     
                 }
             });
       }
     }

     collapse($event){
     console.log("collpase");
     this.userNotiHidden=true;
    }

    expand($event){
      console.log("expand");
      this.userNotiHidden=false;
    }

    deleteMenu(menu){
      console.log("delete Menu "+JSON.stringify(menu));
      var cart=this.cart;
      cart.total=cart.total-menu.amount;     
      var index = cart.menus.indexOf(menu);
      if(index!=-1){
          cart.menus.splice(index, 1);
      }
      this.storageProvider.saveCartInfo(this.storageProvider.takitId,JSON.stringify(cart)).then(()=>{
          this.cart=this.storageProvider.cart;
          this.price=this.cart.total;
          this.discount=Math.round(this.cart.total*this.storageProvider.shopInfo.discountRate);
          this.amount=this.price-this.discount;
      });
    }

    deleteAll(){
      var cart={menus:[],total:0};
      this.storageProvider.saveCartInfo(this.storageProvider.takitId,JSON.stringify(cart)).then(()=>{
          this.cart=this.storageProvider.cart;
          this.price=this.cart.total;
          this.discount=Math.round(this.cart.total*this.storageProvider.shopInfo.discountRate);
          this.amount=this.price-this.discount;
      });
    }

     onFocusPassword(event){
         if(!this.storageProvider.isAndroid){
            console.log("onFocusPassword");
            let dimensions = this.orderPageRef.getContentDimensions();
            console.log("dimensions:"+JSON.stringify(dimensions));
            this.orderPageRef.scrollTo(0, dimensions.contentHeight);
         }
    }

}
