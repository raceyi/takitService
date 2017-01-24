import {Component,NgZone,EventEmitter,ViewChild,ElementRef} from '@angular/core';
import {NavController,NavParams,TextInput,Content,ActionSheetCmp} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import {Platform,App,AlertController} from 'ionic-angular';
import 'rxjs/add/operator/map';
import {StorageProvider} from '../../providers/storageProvider';
import {ServerProvider} from '../../providers/serverProvider';
import {Keyboard} from 'ionic-native';

declare var cordova:any;

@Component({
  selector:'page-order',  
  templateUrl: 'order.html',
})
export class OrderPage {
  @ViewChild('orderPage') orderPageRef: Content;
  @ViewChild('optionDiv')  optionDivElementRef:ElementRef;
  @ViewChild('takeoutDiv') takeoutDivElementRef:ElementRef;

  userNotiHidden:boolean=false;
  shopname:string;
  menu:any;
  takitId;
  options;

  takeoutAvailable:boolean=false;
  takeout:boolean=false;
  hasOptions:boolean=false;

  quantity:number=1;
  quantityInputType:string;

  discount:number;
  amount:number;
  price:number;
  
  cashPassword:string="";

  focusQunatityNum= new EventEmitter();

  iOSOrderButtonHide=true;

  @ViewChild('quantityNum') inputNumRef: TextInput;

  constructor(private app:App,private navController: NavController,private http:Http,private navParams: NavParams,
        private alertController:AlertController, 
        private platform:Platform,public storageProvider:StorageProvider,
        private ngZone:NgZone,private serverProvider:ServerProvider) {

      this.menu=JSON.parse(navParams.get("menu"));
      this.shopname=navParams.get("shopname");
      console.log("OrderPage-param(menu):"+navParams.get("menu"));
      console.log("OrderPage-param(shopname):"+navParams.get("shopname"));
      var splits=this.menu.menuNO.split(";");
      this.takitId=splits[0];
      console.log("takitId:"+this.takitId);

      this.price=this.menu.price*1;
      this.discount=Math.round(this.price*this.storageProvider.shopInfo.discountRate);
      this.amount=this.price-this.discount;
      console.log(" ["+this.menu.hasOwnProperty("takeout")+"][ "+(this.menu.takeout!=null) +"] ["+ (this.menu.takeout!=false)+"]");
      if(this.menu.hasOwnProperty("takeout") && (this.menu.takeout!=null) && (this.menu.takeout!=false)){ // humm... please add takeout field into all menus...
         this.takeoutAvailable=true;
         this.takeout=false;
      }
      if(this.menu.hasOwnProperty("options") 
      //&& Array.isArray(this.menu.options)
      && this.menu.options!=null && this.menu.options.length>0){
          this.hasOptions=true;         
          this.options=JSON.parse(this.menu.options);
          this.options.forEach((option)=>{
              if(option.hasOwnProperty("choice") && Array.isArray(option.choice)){
                  option.flag=false;
                  option.flags=[];
                  option.disabled=[];
                  var i;
                  for(i=0;i<option.choice.length;i++){
                      option.flags.push(false);
                      option.disabled.push(false);
                  }
              }
          });
      }
      
      this.quantityInputType="select";

      /* It doesn't work in ios 
      if(!this.storageProvider.isAndroid){
          Keyboard.disableScroll(true);
      }
      */
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

  sendSaveOrder(cart,menuName){
      if(this.storageProvider.tourMode==false){
       return new Promise((resolve, reject)=>{
             //check if cash and cashpassword exist             
             var takeout;
             if(this.takeout==true){
                 takeout=1;
             }else
                 takeout=0;

              let body = JSON.stringify({paymethod:"cash",
                                        takitId:this.takitId,
                                        orderList:JSON.stringify(cart), 
                                        orderName:menuName+"("+this.quantity+")",
                                        amount:this.amount,
                                        takeout: takeout,
                                        orderedTime:new Date().toISOString(),
                                        cashId: this.storageProvider.cashId,
                                        password:this.cashPassword
                                        });
              console.log("sendOrder:"+JSON.stringify(body));                          
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ this.storageProvider.serverAddress);

             this.serverProvider.saveOrder(body).then((res)=>{    
                 resolve(res);
             },(err)=>{
                 reject(err);
             });                 
       });
      }
  }

  sendOrder(){
    // check cash password
           var cart={menus:[],total:0};
           var options=[];
           if(this.options!=undefined){
                this.options.forEach((option)=>{
                    if (option.flag==true){
                        if(option.select!=undefined)
                            options.push({name:option.name,price:option.price,select:option.select});
                        else
                            options.push({name:option.name,price:option.price});
                    }    
                });
           }
           var menuName=this.menu.menuName;
           if(this.menu.hasOwnProperty("description"))
                menuName+=this.menu.description;

           cart.menus.push({menuNO:this.menu.menuNO,
                            menuName:menuName,
                            quantity:this.quantity,
                            options: options,
                            price: this.amount});
           cart.total=this.amount;
           this.sendSaveOrder(cart,menuName).then((res:any)=>{
                 this.cashPassword="";
                 console.log(JSON.stringify(res)); 
                 var result:string=res.result;
                 if(result=="success"){
                    this.storageProvider.order_in_progress_24hours=true;
                    this.storageProvider.messageEmitter.emit(res.order);
                    console.log("storageProvider.run_in_background: "+this.storageProvider.run_in_background);
                    this.storageProvider.cashInfoUpdateEmitter.emit("all");
                    if(this.storageProvider.run_in_background==false){
                        //refresh cashAmount
                        let confirm = this.alertController.create({
                            title: '주문완료['+res.order.orderNO+']'+' 앱을 계속 실행하여 주문알림을 받으시겠습니까?',
                            message: '앱이 중지되면 주문알림을 못받을수 있습니다.',
                            buttons: [
                            {
                                text: '아니오',
                                handler: () => {
                                    console.log('Disagree clicked');
                                    // report it to tabs page
                                    this.storageProvider.tabMessageEmitter.emit("stopEnsureNoti"); 
                                    this.app.getRootNav().pop();
                                    return;
                                }
                            },
                            {
                                text: '네',
                                handler: () => {
                                    this.storageProvider.tabMessageEmitter.emit("wakeupNoti");
                                    this.app.getRootNav().pop();
                                    return;
                                }
                            }
                            ]
                        });
                        confirm.present();
                    }else{
                        console.log("give alert on order success");
                        let alert = this.alertController.create({
                                title: '주문에 성공하였습니다.'+'주문번호['+res.order.orderNO+']',
                                subTitle: '[주의]앱을 종료하시면 주문알림을 못받을수 있습니다.' ,
                                buttons: ['OK']
                        });
                        alert.present().then(()=>{
                            this.app.getRootNav().pop();
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
                 this.cashPassword="";
                 console.log("saveOrder err "+error);
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
           })        
  }  

 checkOptionValidity(){
     return new Promise((resolve, reject)=>{
            var i;
            console.log("options:"+JSON.stringify(this.options));
            if(this.options!=undefined && this.options!=null && Array.isArray(this.options)){
                for(i=0;i<this.options.length;i++){
                        var option=this.options[i];
                        if(option.hasOwnProperty("choice")==true && option.flag){
                            console.log("option.select:"+option.select);
                            if(option.select==undefined && option.name!=undefined){
                                reject(option.name);
                            }
                        }
                }
            }
            resolve();
     });
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

    console.log("order comes... "); 
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

    if(this.quantity==undefined){
        let alert = this.alertController.create({
            subTitle: '수량을 입력해주시기 바랍니다',
            buttons: ['OK']
        });
        console.log("hum...");
        alert.present().then(()=>{
            console.log("alert done");
        });
        return;
    }
    // check options
    this.checkOptionValidity().then(()=>{
        if(this.storageProvider.cashAmount >= this.amount){
            this.sendOrder();
        }else{
            let alert = this.alertController.create({
                subTitle: '캐쉬잔액이 부족합니다.',
                buttons: ['OK']
            });
            alert.present();
            return;
        }
    },(name)=>{
        console.log("option.select is undefined");
        let alert = this.alertController.create({
            subTitle: name+'을 선택해주십시오',
            buttons: ['OK']
        });
        alert.present();
        return;
    });
  }

  shopcart(){
        console.log("orderPage->shopcart");
        if(this.quantity==undefined){
            if(this.platform.is('android'))
                this.focusQunatityNum.emit(true); 
            else if(this.platform.is('ios')){
             //show alert
         }      
        }

        this.checkOptionValidity().then(()=>{
        this.saveShopcart();
    },(name)=>{
        console.log("option.select is undefined");
        let alert = this.alertController.create({
            subTitle: name+'을 선택해주십시오',
            buttons: ['OK']
        });
        console.log("hum...");
        alert.present().then(()=>{
            console.log("alert done");
            return;
        });
    });

  }

  saveShopcart(){    
    this.cashPassword="";  
    this.storageProvider.getCartInfo(this.takitId).then((result:any)=>{
        var cart;
        if(Array.isArray(result) && result.length==1){
            cart=JSON.parse(result[0].cart);
        }else{
            console.log("no cart info");
            cart={menus:[],total:0};
        }
        var options=[];
        if(this.options!=undefined){
            this.options.forEach((option)=>{
                if (option.flag==true){
                    if(option.select!=undefined)
                        options.push({name:option.name,price:option.price,select:option.select});
                    else
                        options.push({name:option.name,price:option.price});
                }    
            });
        }
        var menuName=this.menu.menuName;
        if(this.menu.hasOwnProperty("description"))
            menuName+=this.menu.description;

        cart.menus.push({menuNO:this.menu.menuNO,
                    menuName:menuName,
                    quantity:this.quantity,
                    options: options,
                    price: this.menu.price,
                    amount: this.price,
                    discountAmount:this.price-Math.round(this.price*this.storageProvider.shopInfo.discountRate),
                    takeout:this.takeoutAvailable});
        cart.total=cart.total+this.price;
        console.log("cart:"+JSON.stringify(cart));
        this.storageProvider.saveCartInfo(this.takitId,JSON.stringify(cart)).then(()=>{
            this.navController.pop(); 
        });
    },(err)=>{
        console.log("getCartInfo error");
        // Please show error alert
    });
  }

 ionViewWillEnter(){
     //console.log("orderPage-ionViewWillEnter");
     
     if(this.hasOptions==false){
        //console.log(".."+this.optionDivElementRef.nativeElement.style.border);
        this.optionDivElementRef.nativeElement.style.border="none";
     }
     if(this.takeoutAvailable==false){
        //console.log(".."+this.takeoutDivElementRef.nativeElement.style.border);
        this.takeoutDivElementRef.nativeElement.style.border="none";
     }
 }


  getQuantity(quantity){
      console.log("quantity change:"+quantity);

      if(quantity==6){ // show text input box 
          this.quantityInputType="input";
          //this.quantity=undefined;
          this.quantity=1; //keypad doesn't work for password if quantity is undefined.
          if(this.platform.is('android') || this.platform.is('ios'))
            this.focusQunatityNum.emit(true);           
      }else{
          this.quantityInputType="select";
          this.price=this.menu.price*quantity;
          this.discount=Math.round(this.price*this.storageProvider.shopInfo.discountRate);
          this.amount=this.price-this.discount;
      }
  }

  computeAmount(option){
      console.log("[computeAmount]flag:"+option.flag);
      if(option.flag==true){
          this.price=this.price+option.price*this.quantity;    
      }else{
          this.price=this.price-option.price*this.quantity;
          console.log("option.select:"+option.select);
          if(option.hasOwnProperty("choice")){
              option.select=undefined;
              console.log("set false to choice flags");              
                var i;
                for(i=0;i<option.flags.length;i++){
                        //console.log("choice:"+option.choice[i]+"flags:"+option.flags[i]);
                        option.flags[i]=false;
                }
          }
      }
      this.discount=Math.round(this.price*this.storageProvider.shopInfo.discountRate);
      this.amount=this.price-this.discount;
  }

    choiceChange(option,idx,flag){
        var prevOptionFlag=option.flag;
        console.log("prevOptionFlag:"+prevOptionFlag);
        this.ngZone.run(()=>{
            if(flag==true && Array.isArray(option.flags)){
                option.select=option.choice[idx];
                option.flag=true;
                if(prevOptionFlag==false){
                    console.log("compute amount again(add)");
                    this.computeAmount(option);
                }
                // other flags become false
                var i;
                for(i=0;i<option.flags.length;i++){
                    if(i!=idx){
                        option.flags[i]=false;
                    }else{
                        option.flags[i]=true;
                    }
                }
            }else{
                option.select=undefined;
                var i;
                for(i=0;i<option.flags.length;i++){
                    if(option.flags[i]==true)
                        break;
                }
                if(i==option.flags.length){
                    option.flag=false;
                    if(prevOptionFlag==true){
                        this.computeAmount(option);            
                        console.log("compute amount again(remove)");
                    }
                }

            }
        });
    }

  optionChange(option){
      console.log("flag:"+option.flag);
      if(option.flag==true){
          this.price=this.price+option.price*this.quantity;    
      }else{
          this.price=this.price-option.price*this.quantity;
          console.log("option.select:"+option.select);
      }
      this.discount=Math.round(this.price*this.storageProvider.shopInfo.discountRate);
      this.amount=this.price-this.discount;
  }

  quantityInput(flag){
    // console.log("flag:"+flag+" quantityInputType:"+this.quantityInputType);
     if(flag){ // number selection
        if(this.quantityInputType=="select"){
          return false;
        }else  
          return true;   
     }else{ //text input
        if(this.quantityInputType=="select"){
          return true;
        }else{
          return false;   
        }
     }
   }

  onBlur($event){
      console.log("onBlur this.quantity:"+this.quantity);
    if(this.quantity==undefined || this.quantity==0 || this.quantity.toString().length==0){
        this.focusQunatityNum.emit(true);  
        /*
           let alert = this.alertController.create({
                    title: '수량을 입력해주시기바랍니다.',
                    buttons: ['OK']
                    });
                    alert.present().then(()=>{
                        console.log("alert done");
                        //this.focusQunatityNum.emit(true);  
                    });
           */         
    }else{
        var unitPrice=this.menu.price;
        this.options.forEach(option=>{
            if(option.flag){
                unitPrice+=option.price;
            }
        });
        console.log("unitPrice:"+unitPrice);
          this.price=unitPrice*this.quantity;
          this.discount=Math.round(this.price*this.storageProvider.shopInfo.discountRate);
          this.amount=this.price-this.discount;
    }      
  }

  closePage(event){
      console.log("close Order Page");
      //this.navController.pop();
     // this.app.getRootNav(); 
     this.app.getRootNav().pop();
  }

collapse($event){
     //console.log("collpase");
     this.userNotiHidden=true;
  }

  expand($event){
     //console.log("expand");
     this.userNotiHidden=false;
  }

    hasChoice(option){
        //console.log("option:"+option.hasOwnProperty("choice"));
        if(option.hasOwnProperty("choice")==true && Array.isArray(option.choice)){
            return option.choice.length;
        }
        return 0;
    }

    optionSelect(option){
        if(option.select!=undefined)
            option.flag=true;    
    }
/*
     onFocusPassword(event){
         if(!this.storageProvider.isAndroid){
            console.log("onFocusPassword");
            let dimensions = this.orderPageRef.getContentDimensions();
            console.log("dimensions:"+JSON.stringify(dimensions));
            this.orderPageRef.scrollTo(0, dimensions.contentHeight);
         }
    }
*/
}

