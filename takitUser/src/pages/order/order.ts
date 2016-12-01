import {Component,NgZone,EventEmitter,ViewChild,ElementRef} from '@angular/core';
import {NavController,NavParams,TextInput,Content,ActionSheetCmp} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import {Platform,App,AlertController} from 'ionic-angular';
import 'rxjs/add/operator/map';
import {ConfigProvider} from '../../providers/ConfigProvider';
import {StorageProvider} from '../../providers/storageProvider';
//import {Focuser} from "../../components/focuser/focuser";
//import {Keyboard} from 'ionic-native';
declare var cordova:any;

@Component({
  selector:'page-order',  
  templateUrl: 'order.html',
})
export class OrderPage {
  @ViewChild('orderPage') orderPageRef: Content;
  @ViewChild('optionDiv')  optionDivElementRef:ElementRef;
  @ViewChild('takeoutDiv') takeoutDivElementRef:ElementRef;
  //@ViewChild('actionSheet') actionSheetElementRef:ActionSheetCmp;

  userNotiHidden:boolean =true;
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

  focusQunatityNum= new EventEmitter();

  @ViewChild('quantityNum') inputNumRef: TextInput;

  constructor(private app:App,private navController: NavController,private http:Http,private navParams: NavParams,
        private alertController:AlertController, 
        private platform:Platform,private storageProvider:StorageProvider,
        private ngZone:NgZone) {

      this.menu=JSON.parse(navParams.get("menu"));
      this.shopname=navParams.get("shopname");
      console.log("OrderPage-param(menu):"+navParams.get("menu"));
      console.log("OrderPage-param(shopname):"+navParams.get("shopname"));
      var splits=this.menu.menuNO.split(";");
      this.takitId=splits[0];
      console.log("takitId:"+this.takitId);

      this.price=this.menu.price*1;
      this.discount=Math.round(this.price*0.005);
      this.amount=Math.round(this.price*0.995);
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
                  option.flags=[];
                  var i;
                  for(i=0;i<option.choice.length;i++){
                      option.flags.push(false);
                  }
              }
          });
      }
      
      this.quantityInputType="select";  
 }

  sendSaveOrder(cart,menuName){
       return new Promise((resolve, reject)=>{
             var takeout;
             if(this.takeout==true){
                 takeout=1;
             }else
                 takeout=0;

              let body = JSON.stringify({paymethod:"cash",
                                        takitId:this.takitId,
                                        orderList:JSON.stringify(cart), 
                                        orderName:menuName+"("+this.quantity+")",
                                        amount:Math.round(this.amount),
                                        takeout: takeout,
                                        orderedTime:new Date().toISOString()});

              console.log("sendOrder:"+JSON.stringify(body));                          
              let headers = new Headers();
              headers.append('Content-Type', 'application/json');
              console.log("server:"+ ConfigProvider.serverAddress);

             this.http.post(ConfigProvider.serverAddress+"/saveOrder",body,{headers: headers}).map(res=>res.json()).subscribe((res)=>{
                 resolve(res);
             },(err)=>{
                 console.log("saveOrder err ");
                 reject("서버와 통신에 문제가 있습니다");
             });                 
       });
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
                            price: Math.round(this.amount)});
           cart.total=Math.round(this.amount);
           this.sendSaveOrder(cart,menuName).then((res:any)=>{
                 console.log(JSON.stringify(res)); 
                 var result:string=res.result;
                 if(result=="success"){
                    this.storageProvider.order_in_progress_24hours=true;
                    this.storageProvider.messageEmitter.emit(res.order);
                    console.log("storageProvider.run_in_background: "+this.storageProvider.run_in_background);
                    if(this.storageProvider.run_in_background==false){
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
                 console.log("saveOrder err ");
                 let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
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
    console.log("order comes... "); 
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
        this.sendOrder();
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
          this.quantity=undefined; 
          if(this.platform.is('android') || this.platform.is('ios'))
            this.focusQunatityNum.emit(true);           
      }else{
          this.quantityInputType="select";
          this.price=this.menu.price*quantity;
          this.discount=Math.round(this.price*0.005);
          this.amount=Math.round(this.price*0.995);
      }
  }

  optionChange(option){
      console.log("flag:"+option.flag);
      if(option.flag==true){
          this.price=this.price+option.price*this.quantity;    
          // workaround solution as option.flags[i] is not updated when it is disabled.
          // Please move below codes into option.flag==false... 
            if(Array.isArray(option.flags)){     
                var i;
                for(i=0;i<option.flags.length;i++){
                        console.log("choice:"+option.choice[i]+"flags:"+option.flags[i]);
                        option.flags[i]=false;
                        console.log("choice:"+option.choice[i]+"flags:"+option.flags[i]);
                }
            }
      }else{
          this.price=this.price-option.price*this.quantity;
          console.log("option.select:"+option.select);
          if(option.hasOwnProperty("choice")){
              option.select=undefined;
              console.log("set false to choice flags");
              /*
                var i;
                for(i=0;i<option.flags.length;i++){
                        console.log("choice:"+option.choice[i]+"flags:"+option.flags[i]);
                        option.flags[i]=false;
                        console.log("choice:"+option.choice[i]+"flags:"+option.flags[i]);
                }
                */
          }
      }
      this.discount=this.price*0.005;
      this.amount=Math.round(this.price*0.995);
  }

    choiceChange(option,idx,flag){
        /*
        ////////debug-begin
        console.log("[choiceChange]flag:"+flag);
        for(i=0;i<option.flags.length;i++){
            console.log("choice:"+option.choice[i]+"flags:"+option.flags[i]);
        }
        ////////debug-end
        */
        if(flag==true && Array.isArray(option.flags)){
            option.select=option.choice[idx];
            option.flag=true;
            // other flags become false
            var i;
            for(i=0;i<option.flags.length;i++){
                if(i!=idx){
                    option.flags[i]=false;
                }
            }
        }else{
            option.select=undefined;            
        }
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
          this.discount=Math.round(this.price*0.005);
          this.amount=Math.round(this.price*0.995);
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

    onFocusPassword(event){
        console.log("onFocusPassword");
        let dimensions = this.orderPageRef.getContentDimensions();
        console.log("dimensions:"+JSON.stringify(dimensions));
        this.orderPageRef.scrollTo(0, dimensions.contentHeight);
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
}

