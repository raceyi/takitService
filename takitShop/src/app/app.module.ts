import { NgModule } from '@angular/core';
import { IonicApp, IonicModule } from 'ionic-angular';
import { MyApp } from './app.component';
import {FbProvider} from '../providers/LoginProvider/fb-provider';
import {EmailProvider} from '../providers/LoginProvider/email-provider';
import {KakaoProvider} from '../providers/LoginProvider/kakao-provider';
import {PrinterProvider} from '../providers/printerProvider';
import {StorageProvider} from '../providers/storageProvider';

import {Storage} from '@ionic/storage';
import {LoginPage} from '../pages/login/login';
import {ErrorPage} from '../pages/error/error';
import {PrinterPage} from '../pages/printer/printer';
import {SelectorPage} from '../pages/selector/selector';
import {ShopTablePage} from '../pages/shoptable/shoptable';
import {UserSecretPage} from '../pages/usersecret/usersecret';
import{Focuser} from '../components/focuser/focuser';


@NgModule({
  declarations: [
    MyApp,
    LoginPage,
    ErrorPage,
    SelectorPage,
    ShopTablePage,
    UserSecretPage,
    PrinterPage,
    Focuser
  ],
  imports: [
    IonicModule.forRoot(MyApp)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    LoginPage,
    ErrorPage,
    SelectorPage,
    ShopTablePage,
    UserSecretPage,
    PrinterPage
  ],
  providers: [
    FbProvider,
    EmailProvider,
    KakaoProvider,
    StorageProvider,
    PrinterProvider,
    Storage
  ]
})
export class AppModule {}
