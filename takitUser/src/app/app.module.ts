import { NgModule ,ChangeDetectorRef} from '@angular/core';
import { IonicApp, IonicModule} from 'ionic-angular';
import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { TabsPage } from '../pages/tabs/tabs';
import { LoginPage } from '../pages/login/login'; 
import {ErrorPage} from '../pages/error/error';

import {FbProvider} from '../providers/LoginProvider/fb-provider';
import {EmailProvider} from '../providers/LoginProvider/email-provider';
import {KakaoProvider} from '../providers/LoginProvider/kakao-provider';
import {StorageProvider} from '../providers/storageProvider';
import {Storage} from '@ionic/storage';

import {SignupPage} from '../pages/signup/signup';
import {SignupSubmitPage} from '../pages/signup_submit/signup_submit';
import {ServiceInfoPage} from '../pages/serviceinfo/serviceinfo';
import {UserInfoPage} from '../pages/userinfo/userinfo';
import { CashPage } from '../pages/cash/cash';
import { OrderPage } from '../pages/order/order';
import { SearchPage } from '../pages/search/search';
import { ShopCartPage } from '../pages/shopcart/shopcart';
import { ShopExitPage } from '../pages/shopexit/shopexit';
import { ShopHomePage } from '../pages/shophome/shophome';
import { ShopMyPage } from '../pages/shopmypage/shopmypage';
import { ShopTabsPage } from '../pages/shoptabs/shoptabs';
import { PasswordPage } from '../pages/password/password';
import {CashConfirmPage} from '../pages/cashconfirm/cashconfirm';
import {CashIdPage} from '../pages/cashid/cashid';

import{Focuser} from '../components/focuser/focuser';

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    TabsPage,
    LoginPage,    
    ErrorPage,
    SignupPage,
    SignupSubmitPage,
    ServiceInfoPage,
    UserInfoPage,
    CashPage,
    OrderPage,
    SearchPage,
    ShopCartPage,
    ShopExitPage,
    ShopHomePage,
    ShopMyPage,
    ShopTabsPage,
    PasswordPage,
    Focuser,
    CashConfirmPage,
    CashIdPage
  ],
  imports: [
    IonicModule.forRoot(MyApp)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    TabsPage,
    LoginPage,
    ErrorPage,
    SignupPage,
    SignupSubmitPage,
    ServiceInfoPage,
    UserInfoPage,
    CashPage,
    OrderPage,
    SearchPage,
    ShopCartPage,
    ShopExitPage,
    ShopHomePage,
    ShopMyPage,
    ShopTabsPage,
    PasswordPage,
    CashConfirmPage,
    CashIdPage
  ],
  providers: [
    FbProvider,
    EmailProvider,
    KakaoProvider,
    StorageProvider,
    Storage 
  ]
})
export class AppModule {}
