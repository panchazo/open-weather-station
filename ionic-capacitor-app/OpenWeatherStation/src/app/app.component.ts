import { Component } from '@angular/core';
import { Platform, NavController } from '@ionic/angular'; // Import NavController
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { Storage } from '@ionic/storage';
import * as CordovaSQLiteDriver from 'localforage-cordovasqlitedriver';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PowerManagement } from '@awesome-cordova-plugins/power-management/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { AppVersion } from '@awesome-cordova-plugins/app-version/ngx';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { BatteryStatus } from '@awesome-cordova-plugins/battery-status/ngx';
import { OWSDataService } from './services/OWSDataService';
import { OWSDeviceService } from './services/OWSDeviceService';
import { OWSLieFiService } from './services/OWSLieFiService';
import { OWSEventMgr } from './services/OWSEventMgr';
import { OWSEventsTypes } from './services/OWSEventsTypes';
import { OWSCloudService } from './services/OWSCloudService';

declare var cordova: any;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {

  pages: Array<{ title: string, url: string }>;
  version: string = "n/a";
  storageAppSettingsName: string = "appSettings";
  appSettings: any = {};
  localStorage: any = null;

  constructor(
    private platform: Platform, private inAppBrowser: InAppBrowser,
    private StorageSystem: Storage, public powerManagement: PowerManagement,
    public bgMode: BackgroundMode, public appVersion: AppVersion,
    public batteryStatus: BatteryStatus, public device: Device,
    private nav: NavController, public owsCloud: OWSCloudService,
    public owsData: OWSDataService,
    public owsDevice: OWSDeviceService, public lieFi: OWSLieFiService
  ) {

    this.initializeApp();

    // used for an example of ngFor and navigation
    this.pages = [
      { title: 'Home', url: '/home' },
      { title: 'OWS module', url: '/devices' },
      { title: 'Remote servers', url: '/remotes' },
      { title: 'Settings', url: '/settings' }
    ];
  }

  async initializeApp() {
    try {
      await this.platform.ready();
      window.open = (url?: any, target?: string, _features?: string): Window | null | any => {
        /*Browser.open({ url: url, windowName: target ? target : "_blank" }).then(() => { }).catch((e) => {
          console.error("Browser.open", e);
        });*/
        //uso este plugin porque el google maps no abre todas las direcciones con el plugin de Capacitor
        this.inAppBrowser.create(url, target ? target : "_blank", _features ? _features : '');
      };


      await this.StorageSystem.defineDriver(CordovaSQLiteDriver);
      this.localStorage = await this.StorageSystem.create();

      this.localStorage.get(this.storageAppSettingsName).then((appSettings: any) => {
        this.appSettings = appSettings;


        //check if the app is running on a device
        if (this.platform.is("hybrid")) {

          SplashScreen.hide();

          if (this.appSettings && this.appSettings.keep_screen_on) {
            this.powerManagement.dim();
          }

          let cordovaPlugins: any = cordova && cordova.plugins ? cordova.plugins : {};
          if (this.appSettings && this.appSettings.start_on_boot) {
            if (cordovaPlugins.autoStart) {
              cordovaPlugins.enable();
            } else {
              console.error("AutoStart plugin not found");
            }
          }

          this.bgMode.setDefaults({
            title: "Processing weather data",
            text: "Touch to open the app",
            icon: 'icon', // this will look for icon.png in platforms/android/res/drawable|mipmap
            color: "FFFFFF",// hex format like 'F14F4D'
            hidden: true
          });
          this.bgMode.enable();

          this.batteryStatus.onChange().subscribe(
            (status) => {
              OWSEventMgr.send(OWSEventsTypes.CLOUD_BATTERY_STATUS, status);
            }
          );
          if (this.device.platform == "Android" && this.device.version < "6.0.0") {
            console.log("legacy device detected...");
          }
          this.appVersion.getVersionNumber().then((ver) => { this.version = ver; });

          this.owsDevice.initialize();
          this.lieFi.initialize();
          this.owsData.initialize();
        }


        this.owsCloud.initialize();
        //this.monitorAllEvents();
      });
    }
    catch (e) { console.log('platform ready', e); };
  }

  monitorAllEvents() {
    const owsevents = Object.keys(OWSEventsTypes);
    for (let ev of owsevents) {
      //check if the owsevents is a propery of OWSEventsTypes then listen to it
      if (typeof OWSEventsTypes[ev] === 'string') {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes[ev]);
        observable.subscribe({
          next: (data: any) => {
            console.log(ev, data);
          },
          error: (e: any) => { },
          complete: (r: any) => { }
        });
      }
    }
  }

  goToPage(name: string) {
    // Reset the content nav to have just this page
    // we wouldn't want the back button to show in this scenario
    this.nav.navigateRoot(name);
  }

  openUrl(url: string) {
    window.open(url, "_blank");
  }

}
