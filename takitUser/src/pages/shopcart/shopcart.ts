import {Component,ViewChild,ElementRef} from "@angular/core";
import {NavController,NavParams,Content,AlertController} from 'ionic-angular';
import {StorageProvider} from '../../providers/storageProvider';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';

@Component({
    selector:'page-shopcart',
    templateUrl: 'shopcart.html'
})

export class ShopCartPage{
    @ViewChild('shopcartPage') orderPageRef: Content;
    @ViewChild('takeoutDiv') takeoutDivElementRef:ElementRef;

    shopname:string;
    userNotiHidden:boolean =true;
    price:number=0;    //total price
    discount:number=0; //total discount
    amount:number=0;   //total amount. acutual price with discount
    cart:any={};
    takeoutAvailable:boolean=false;
    takeout:boolean=false;

     constructor(private navController: NavController,private http:Http,
            private navParams: NavParams,private storageProvider:StorageProvider,
            private alertController:AlertController){
	      console.log("ShopCartPage constructor");
        this.shopname=this.storageProvider.currentShopname();
        this.cart=this.storageProvider.cart;
        if(this.cart!=undefined){
            this.price=this.cart.total;
            this.discount=Math.round(this.cart.total*0.005);
            this.amount=Math.round(this.price*0.995);
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
        this.discount=Math.round(this.cart.total*0.005);
        this.amount=Math.round(this.price*0.995);
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
                                        amount:Math.round(this.amount),
                                        takeout: takeout,
                                        orderedTime:new Date().toISOString()});
              console.log("order:"+JSON.stringify(body));

              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);

             this.http.post(ConfigProvider.serverAddress+"/saveOrder",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 console.log(res); 
                 var result:string=res.result;
                 if(result=="success"){
                        let alert = this.alertController.create({
                            title: '주문에 성공했습니다.',
                            buttons: ['OK']
                        });
                        alert.present().then(()=>{
                        var cart={menus:[],total:0};
                        this.storageProvider.saveCartInfo(this.storageProvider.takitId,JSON.stringify(cart)).then(()=>{
                            this.navController.pop();   
                        },(err)=>{
                            console.log("saveCartInfo err");
                            this.navController.pop();   
                        });
                        });
                 }
             },(err)=>{
                 console.log("saveOrder err ");
                 let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
             });
     }

     collapse($event){
     console.log("collpase");
     this.userNotiHidden=true;
    }

    expand($event){
      console.log("expand");
      this.userNotiHidden=false;
    }

    onFocusPassword(event){
        console.log("onFocusPassword");
        let dimensions = this.orderPageRef.getContentDimensions();
        console.log("dimensions:"+JSON.stringify(dimensions));
        this.orderPageRef.scrollTo(0, dimensions.contentHeight);
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
          this.discount=Math.round(this.cart.total*0.005);
          this.amount=Math.round(this.price*0.995);
      });
    }

    deleteAll(){
      var cart={menus:[],total:0};
      this.storageProvider.saveCartInfo(this.storageProvider.takitId,JSON.stringify(cart)).then(()=>{
          this.cart=this.storageProvider.cart;
          this.price=this.cart.total;
          this.discount=Math.round(this.cart.total*0.005);
          this.amount=Math.round(this.price*0.995);
      });
    }

}
