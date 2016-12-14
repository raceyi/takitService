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

  =>takitUser/platforms/android/cordova-plugin-htj-kakaotalk/user-kakao.gradle 파일에 sdk version수정 
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

 $ionic plugin add https://github.com/katzer/cordova-plugin-background-mode.git 

 $npm install crypto-js

 $npm install @types/crypto-js --save 

 $ionic g directive focuser

 $ionic build ios

 $git checkout takitUser/platforms/android/src/com/htj/plugin/kakao/KakaoTalk.java

 $ionic build android 

 takitUser/platforms/ios/타킷/타킷-Info.plist 수정  

     <key>LSApplicationQueriesSchemes</key>
     <array>
        <string>kakaotalk</string>
     </array>

 xcode에서 옵션 수정
    open platforms/ios/타킷.xcodeproj 
    Build Settings > Linking > Other Linker Flags > add '-all_load' (kakao plugin git)
    Capabilities->Push Notifications -> ON

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

        public static tourEmail="xxxxx";
        public static tourPassword="xxxx";

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
     =>takitShop/platforms/android/cordova-plugin-htj-kakaotalk/shop-kakao.gradle 파일에 sdk version수정 
      현재 SDK버전: com.kakao.sdk:kakaotalk:1.1.21 (KakaoTalk.java파일 수정=>git checkout takitShop이수행함) 

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

 $ionic plugin add https://github.com/srehanuddin/Cordova-Plugin-Bluetooth-Printer.git

 $ionic plugin add https://github.com/sidchilling/Phonegap-SMS-reception-plugin.git

 $ionic plugin add https://github.com/katzer/cordova-plugin-background-mode.git 

 $npm install crypto-js

 $npm install @types/crypto-js --save

 $ionic g directive focuser

 $ionic build ios

 $git checkout takitShop/platforms/android/src/com/htj/plugin/kakao/KakaoTalk.java

 $ionic build android

 takitShop/platforms/ios/타킷운영자/타킷운영자-Info.plist

     <key>LSApplicationQueriesSchemes</key>
     <array>
        <string>kakaotalk</string>
     </array>

 xcode에서 옵션 수정및 코드 수정(참조 kakao plugin git)
    open platforms/ios/타킷운영자.x
    Build Settings > Linking > Other Linker Flags > add '-all_load' (kakao plugin git)
    Capabilities->Push Notifications -> ON

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
 12월24일  안드로이드 앱완료 
 1월11일   아이폰앱 승인 완료 

# Ionic2 무료 강의 

 2시간으로 구성된 Ionic2 소개 강의 

 (타킷 오픈 소스 소개 포함)

 강의 장소 섭외 도움주실분 연락주세요~~ 

 kalen.lee@takit.biz

# Ionic2 주말 유료 강의(4주, 매회 4시간) 

 Takit open source기반 실제 앱/서비스 개발 교육  

1.주차(개발환경 설정,기초) 

  환경 설정:  node, ionic2, 해킨토시, Android, iPhone App빌드/실행

  javascript 구조(promise, async call)

  ionic2 기본 코드(앵귤러 기본 문법포함),디렉토리 구조 설명

  ionic UI 컴포넌트 및 theme설정  (ionic serve)


2.주차(plugin사용)

  ionic2에서 주요 plugin사용하기.  plugin 만들기. 

  로그인(카카오, 페이스북) plugin 

  카메라, 파일  upload plugin등

  ionic UI컴포넌트


3.주차(서버와 통신)

  node server만들기(aws EC2 사용,기초 aws사용법)

  http를 통한 서버와 통신 코드 작성(서버&클라이언트)

  file전송하기(upload,download, 서버&클라이언트)

  gcm구현하기(앱, server) 및 notification 특성(background,forground, 앱종료시)

  gcm설정하기(apple developer, google firebase)

  휴대폰 본인 인증 연동 예시(inAppBrowser 사용)

  ionic UI컴포넌트(infinite scroll)


4.주차(그외 사항들)

  directive 정의

  그외 코드(back key handler, zone, emitter사용을 통한 event전달)

  app스토어 등록방법 

  Q&A,보충설명등
