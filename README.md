# takit 
Takit App source based on ionic2 and Server source based on node 

License: GPL 
  참조 코드로 공개합니다.
  특허 요소가 있는 일부 기능은 GPL로도 사용불가합니다.

# takitUser

 $ionic start takitUser --v2

 $cd takitUser
  => config.xml의 id,name 수정ex)biz.takitApp.user,타킷

 $ionic platform add android
 
 $ionic platform add ios

 $ionic plugin add https://github.com/taejaehan/cordova-kakaotalk.git --variable KAKAO_APP_KEY={takitUser.kakao.appId}

 =>takitUser/plugins/cordova-plugin-htj-kakaotalk/src/android/kakao.gradle, 
   takitUser/platforms/android/cordova-plugin-htj-kakaotalk/user-kakao.gradle 파일에 sdk version수정 
   현재 SDK버전: com.kakao.sdk:kakaotalk:1.1.21  

 $ionic plugin add https://github.com/loicknuchel/cordova-device-accounts.git

 $ionic plugin add cordova-plugin-facebook4 --save --variable APP_ID="{takitUser.facebook.appId}" --variable APP_NAME="takitUser"

 $ionic plugin add cordova-plugin-network-information

 $ionic plugin add cordova-plugin-file-transfer

 $ionic plugin add cordova-plugin-camera

 $ionic plugin add cordova-plugin-filepath

 $ionic plugin add https://github.com/protonet/cordova-plugin-image-resizer.git

 $ionic plugin add phonegap-plugin-push --variable SENDER_ID={takitUser.fcm.senderId}

 $ionic plugin add cordova-sqlite-storage

 $ionic plugin add https://github.com/46cl/cordova-android-focus-plugin

 $ionic plugin add cordova-plugin-sim

 $ionic plugin add cordova-plugin-inappbrowser

 $ionic plugin add cordova-plugin-appavailability

 $ionic plugin add https://github.com/raceyi/GetEmail.git

 $ionic plugin add https://github.com/sidchilling/Phonegap-SMS-reception-plugin.git

 $npm install crypto-js

 $npm install @types/crypto-js --save 

 $ionic g directive focuser

 $ionic build ios

 $git checkout takitUser/platforms/android/src/com/htj/plugin/kakao/KakaoTalk.java

 $git checkout takitUser/plugins/cordova-plugin-htj-kakaotalk/src/android/KakaoTalk.java

 $ionic build android 

 takitUser/platforms/ios/타킷/타킷-Info.plist 수정  

     <key>LSApplicationQueriesSchemes</key>
     <array>
        <string>kakaotalk</string>
     </array>

 xcode에서 옵션 수정및 코드 수정(참조 kakao plugin git)
    open platforms/ios/*.xcodeproj Build Settings > Linking > Other Linker Flags > add '-all_load'

 $cd ..

 $git checkout takitUser

 takitUser/src/providers/configProvider.ts파일 아래 형식으로 생성 

    import {Injectable} from '@angular/core';

    @Injectable()
    export class ConfigProvider{
        public static serverAddress:string="XXXXX"; // server ip and port 

        public static awsS3OCR:string="XXXXX";
        public static awsS3:string="XXXXX";  
        public static homeJpegQuality=100;
        public static menusInRow=3;
        public static networkTimeout=3000; //3 seconds
        public static OrdersInPage:number=10; // The number of orders shown in a page 

        public static userSenderID="XXXX"; //gcm senderID

        public static version="0.0.1";

        public static kakaoTakitUser="xxxxx";////Rest API key
        public static kakaoOauthUrl="xxxx"; //return url

        constructor(){
            console.log("ConfigProvider constructor"); 
        }
    }

 $cd takitUser
 
 $ionic run android

 $ionic run ios 


# takitShop

  $ionic start takitShop --v2

  $cd takitShop => config.xml의 id,name 수정ex)biz.takitApp.shop,타킷운영자

  $ionic platform add android

  $ionic platform add ios

  $ionic plugin add https://github.com/taejaehan/cordova-kakaotalk.git --variable KAKAO_APP_KEY={takitShop.kakao.appId} 
   => takitShop/plugins/cordova-plugin-htj-kakaotalk/src/android/kakao.gradle, 
      takitShop/platforms/android/cordova-plugin-htj-kakaotalk/shop-kakao.gradle 파일에 sdk version수정 
      현재 SDK버전: com.kakao.sdk:kakaotalk:1.1.21 (KakaoTalk.java파일 수정=>git checkout takitShop이수행함) 
      takitUser/platforms/android/build삭제 (재빌드를 위해)

 $ionic plugin add cordova-plugin-facebook4 --save --variable APP_ID="{takitShop.facebook.appId}" --variable APP_NAME="takitShop"

 $ionic plugin add cordova-plugin-network-information

 $ionic plugin add cordova-plugin-file-transfer

 $ionic plugin add cordova-plugin-camera

 $ionic plugin add cordova-plugin-file

 $ionic plugin add cordova-plugin-filepath

 $ionic plugin add phonegap-plugin-push --variable SENDER_ID={takitShop.fcm.senderId}

 $ionic plugin add cordova-sqlite-storage

 $ionic plugin add cordova-plugin-inappbrowser

 $ionic plugin add cordova-plugin-appavailability

 $npm install crypto-js

 $npm install @types/crypto-js --save

 $ionic build android

 $ionic build ios

 $ionic run android

 $ionic run ios

 $git checkout takitShop

 takitShop/src/providers/configProvider.ts파일 아래 형식으로 생성

    import {Injectable} from '@angular/core';

    @Injectable()
    export class ConfigProvider{
        public static serverAddress:string="XXXXX"; // server ip and port

        public static awsS3OCR:string="XXXXX";
        public static awsS3:string="XXXXX";
        public static homeJpegQuality=100;
        public static menusInRow=3;
        public static networkTimeout=3000; //3 seconds
        public static OrdersInPage:number=10; // The number of orders shown in a page

        public static userSenderID="XXXX"; //gcm senderID

        public static version="0.0.1";

        public static kakaoTakitShop="xxxxx";////Rest API key
        public static kakaoOauthUrl="xxxx"; //return url

        constructor(){
            console.log("ConfigProvider constructor");
        }
    }


# Schedule
 11월20일  안드로이드 앱완료 
 12월5일   아이폰앱 승인 완료 

# Ionic2 무료 강의 
 강의 장소 섭외 도움주실분 연락주세요~~ 
 kalen.lee@takit.biz
 
# Ionic2 주말 유료 강의 
 Takit open source기반 실제 앱/서비스 개발 교육  



