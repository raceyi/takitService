
import {Component,ViewChild} from '@angular/core';
import {Platform,NavController,NavParams,Content,Segment,AlertController} from 'ionic-angular';
import {Http,Headers} from '@angular/http';
import 'rxjs/add/operator/map';
import {StorageProvider} from '../../providers/storageProvider';
import {OrderPage} from '../order/order';
import {App} from 'ionic-angular';
import {TabsPage} from '../tabs/tabs';
import {Device} from 'ionic-native';
import {ServerProvider} from '../../providers/serverProvider';

@Component({
  selector:'page-shophome',  
  templateUrl: 'shophome.html'
})
export class ShopHomePage {
  @ViewChild('segmentBar') segmentBarRef: Content;
  @ViewChild('menusContent') menusContentRef: Content;
  @ViewChild('recommendation') recommendationRef: Content;
  @ViewChild('categorySegment') categorySegmentRef: Segment;

  shopname:string;
  categorySelected:number=1;
  categories=[];

  //isAndroid: boolean = false;
  takitId:string;

  shop;

  menuRows=[];
  categoryMenuRows=[];
  dummyMenuRows:number=0; // Just for android version less than 5.0

  recommendMenuNum:number;
  recommendMenu=[];

  todayMenuHideFlag=true;
  //minVersion:boolean=false;
   
  constructor(private app:App, private platform: Platform, private navController: NavController
      ,private navParams: NavParams,private http:Http,private storageProvider:StorageProvider
      ,private alertController:AlertController,private serverProvider:ServerProvider) {
  }

  ionViewDidEnter(){
      console.log("shophomePage - ionViewDidEnter")
        if(this.takitId==undefined){
          this.takitId=this.storageProvider.takitId;
          this.loadShopInfo();
          this.segmentBarRef.resize();
          this.menusContentRef.resize();
        }
  }
  
  configureShopInfo(){
    this.shop.categories.forEach(category => {
        var menus=[];
        this.shop.menus.forEach(menu=>{
                //console.log("menu.no:"+menu.menuNO+" index:"+menu.menuNO.indexOf(';'));
                var no:string=menu.menuNO.substr(menu.menuNO.indexOf(';')+1);
                //console.log("category.category_no:"+category.categoryNO+" no:"+no);
                if(no==category.categoryNO){
                menu.filename=encodeURI(this.storageProvider.awsS3+menu.imagePath);
                menu.category_no=no;
                //console.log("menu.filename:"+menu.filename);
                let menu_name=menu.menuName.toString();
                //console.log("menu.name:"+menu_name);
                if(menu_name.indexOf("(")>0){
                    //console.log("name has (");
                    menu.menuName = menu_name.substr(0,menu_name.indexOf('('));
                    //console.log("menu.name:"+menu.name);
                    menu.description = menu_name.substr(menu_name.indexOf('('));
                    menu.descriptionHide=false;
                }else{
                    menu.descriptionHide=true;
                }
                menus.push(menu);
            }
        });
        this.categories.push({no:parseInt(category.categoryNO),name:category.categoryName,menus:menus});
        //console.log("[categories]:"+JSON.stringify(this.categories));
        //console.log("menus.length:"+menus.length);
        });
        //console.log("categories len:"+this.categories.length);
        this.categories.forEach(category => {
        //console.log("category:"+JSON.stringify(category));
        var menuRows=[];
        for(var i=0;i<category.menus.length;){
            var menus=[];
            for(var j=0;j<this.storageProvider.menusInRow && i<category.menus.length;j++,i++){
                menus.push(category.menus[i]);
            }
            menuRows.push({menus:menus});
        }
        this.categoryMenuRows.push(menuRows);                        
        });

        this.menuRows=this.categoryMenuRows[0];
        this.categorySelected=1; // hum...
        //console.log("menus for 0:"+JSON.stringify(this.menuRows));  
        //////////////////////////////////
        //todayMenus
        if(this.shop.shopInfo.hasOwnProperty("todayMenus"))
        console.log("todayMenus:"+JSON.stringify(this.shop.shopInfo.todayMenus));

        //////////////////////////////////
        // Is it correct location? Just assume that the height of recommendation area.
        //console.log("segmentBar:"+JSON.stringify(this.segmentBarRef.getDimensions()));
        //console.log("recommendation:"+JSON.stringify(this.recommendationRef.getDimensions()));
        let menusDimensions=this.menusContentRef.getContentDimensions();
        let menusHeight=this.menusContentRef.getNativeElement().parentElement.offsetHeight-menusDimensions.contentTop;
        if(this.shop.shopInfo.hasOwnProperty("todayMenu")){
            menusHeight=menusHeight-(100+20); //100: button height, 20:name,price height
        }
        console.log("pageHeight:"+this.menusContentRef.getNativeElement().parentElement.offsetHeight+"top:"+menusDimensions.contentTop+"menusHeight:"+menusHeight);
        this.menusContentRef.getScrollElement().setAttribute("style","height:"+menusHeight+"px;margin-top:0px;");
        /////////////////////////////////*/
        if(this.shop.shopInfo.hasOwnProperty("todayMenus")){
            //console.log("todayMenus num:"+ this.shop.shopInfo.todayMenus.length+"todayMenus:"+JSON.stringify(this.shop.shopInfo.todayMenus));
            this.recommendMenuNum=this.shop.shopInfo.todayMenus.length;
            this.todayMenuHideFlag=false;
            this.shop.shopInfo.todayMenus.forEach(todaymenuString=>{
                //console.log("todaymenu:"+todaymenuString);
                var todayMenu=JSON.parse(todaymenuString);
                var recommendMenu;
                    //console.log("category:" +todayMenu.categoryNO+" menu name:"+ todayMenu.menu_name);
                    for(var i=0;i<this.categories[todayMenu.categoryNO-1].menus.length;i++){
                        //console.log("menu:"+this.categories[todayMenu.categoryNO-1].menus[i].name);
                        if(this.categories[todayMenu.categoryNO-1].menus[i].name==todayMenu.menu_name){
                            recommendMenu=this.categories[todayMenu.categoryNO-1].menus[i];
                        break;
                    }
                }
                //console.log("recommendMenu:"+JSON.stringify(recommendMenu));
                this.recommendMenu.push(recommendMenu);
            });
        }else{
            this.todayMenuHideFlag=true;
        }
  }

  loadShopInfo()
  {
        this.categorySelected=1;
        this.categories=[];
        this.menuRows=[];
        this.categoryMenuRows=[];
        this.recommendMenu=[];

        var shop=this.storageProvider.shopResponse;
        /*
        console.log("shop.menus:"+JSON.stringify(shop.menus));
        console.log("shop.categories:"+JSON.stringify(shop.categories));
        console.log("shop.shopInfo:"+JSON.stringify(shop.shopInfo));
        //console.log("shop.menus.length:"+shop.menus.length);
        */
        //console.log("shop.categories.length:"+shop.categories.length);
        //console.log("shop.shopInfo:"+JSON.stringify(shop.shopInfo));
        this.shop=shop;
        this.shopname=shop.shopInfo.shopName;
        this.storageProvider.shopInfoSet(shop.shopInfo);
        this.configureShopInfo();

        // update shoplist at Serve (takitId,s3key)
        var thisShop:any={takitId:this.takitId ,s3key: this.shop.shopInfo.imagePath, discountRate:(this.shop.shopInfo.discountRate*100).toString()+"%"};
        if(this.shop.shopInfo.imagePath.startsWith("takitId/")){

        }else{
            thisShop.filename=this.storageProvider.awsS3+this.shop.shopInfo.imagePath;
        }
        //read shop cart 
        this.storageProvider.loadCart(this.takitId);
        this.storageProvider.shoplistCandidate=this.storageProvider.shoplist;
        this.storageProvider.shoplistCandidateUpdate(thisShop);
        let body = JSON.stringify({shopList:JSON.stringify(this.storageProvider.shoplistCandidate)});
        console.log("body:",body);
        let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        if(this.storageProvider.tourMode==false){    
            this.serverProvider.post(this.storageProvider.serverAddress+"/shopEnter",body).then((res:any)=>{
                console.log("res.result:"+res.result);
                var result:string=res.result;
                if(result=="success"){

                }else{
                    
                }
            },(err)=>{
                console.log("shopEnter-http post err "+err);
                //Please give user an alert!
                if(err=="NetworkFailure"){
                let alert = this.alertController.create({
                        title: '서버와 통신에 문제가 있습니다',
                        subTitle: '네트웍상태를 확인해 주시기바랍니다',
                        buttons: ['OK']
                    });
                    alert.present();
                }
            });
        }
        /////////////////////////////////
      //this.isAndroid = this.platform.is('android');                        
  }

  categoryChange(category_no){
    console.log("[categoryChange] categorySelected:"+category_no+" previous:"+this.categorySelected);
    if(this.categoryMenuRows.length>0){
        //console.log("change menus");
        this.menuRows=this.categoryMenuRows[category_no-1];
        this.categorySelected=category_no; //Please check if this code is correct.
    }
    this.menusContentRef.resize();

    console.log("this.menuRows:"+JSON.stringify(this.menuRows));
    console.log("row num :"+this.menuRows.length+" menus:"+JSON.stringify(this.menuRows));
    ///////////////////////////////////////////////////////////////////////////////////////////
    //console.log("segmentBar:"+JSON.stringify(this.segmentBarRef.getDimensions()));
    //console.log("recommendation:"+JSON.stringify(this.recommendationRef.getDimensions()));
    let menusDimensions=this.menusContentRef.getContentDimensions();
    let menusHeight=this.menusContentRef.getNativeElement().parentElement.offsetHeight-menusDimensions.contentTop+100;
    console.log("pageHeight:"+this.menusContentRef.getNativeElement().parentElement.offsetHeight+"top:"+menusDimensions.contentTop+"menusHeight:"+menusHeight);
    this.menusContentRef.getScrollElement().setAttribute("style","height:"+menusHeight+"px;margin-top:0px;margin-bottom:0px");
    //////////////////////////////////////////////////////////*/
  }

  menuSelected(category_no,menu_name){
    console.log("category:"+category_no+" menu:"+menu_name); 
    var menu;
    for(var i=0;i<this.categories[category_no-1].menus.length;i++){
         //console.log("menu:"+this.categories[category_no-1].menus[i].menuName);
         if(this.categories[category_no-1].menus[i].menuName==menu_name){
             menu=this.categories[category_no-1].menus[i];
            break;
        }
    }
    console.log("menu info:"+JSON.stringify(menu));
    this.app.getRootNav().push(OrderPage,{menu:JSON.stringify(menu), shopname:this.shopname});
  }

  swipeCategory(event){
        console.log("event.direction:"+event.direction+ "categories.length:"+this.categories.length);
        if(this.categories.length>3){
            let dimensions=this.segmentBarRef.getContentDimensions();
            if(this.categorySelected>=3 && event.direction==2){ // increase this.categorySelected
                console.log("call scrollTo with "+(dimensions.contentWidth/3)*(this.categorySelected-1));
                this.segmentBarRef.scrollTo((dimensions.contentWidth/3)*(this.categorySelected-1),0,500);
            }else if(this.categorySelected>=3 && event.direction==4){ //decrease this.categorySelected
                 console.log("call scrollTo with "+(dimensions.contentWidth/3)*(this.categorySelected-3));
                 this.segmentBarRef.scrollTo((dimensions.contentWidth/3)*(this.categorySelected-3),0,500);
            }    
        }
        if(event.direction==4){ //DIRECTION_LEFT = 2
            if(this.categorySelected>1){
                this.categoryChange(this.categorySelected-1);
            }
        }else if(event.direction==2){//DIRECTION_RIGHT = 4
            if(this.categorySelected < this.categories.length){
                this.categoryChange(this.categorySelected+1);
            }
        }        
  }

    hideFlag(flag){
        return flag;
    }

    ionViewWillUnload(){
       //Please update shoplist of storageProvider...
       console.log("ionViewWillUnload-ShopHomePage");
     }
}
