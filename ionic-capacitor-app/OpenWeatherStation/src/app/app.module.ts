import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { Drivers } from '@ionic/storage';
import { IonicStorageModule } from '@ionic/storage-angular';
import * as CordovaSQLiteDriver from 'localforage-cordovasqlitedriver';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AppVersion } from '@awesome-cordova-plugins/app-version/ngx';
import { BatteryStatus } from '@awesome-cordova-plugins/battery-status/ngx';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { PowerManagement } from '@awesome-cordova-plugins/power-management/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { SQLite } from '@awesome-cordova-plugins/sqlite/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';
import {BluetoothSerial} from '@awesome-cordova-plugins/bluetooth-serial/ngx';
import {OWSCloudService} from './services/OWSCloudService';
import {OWSDataService} from './services/OWSDataService';
import {OWSDeviceService } from './services/OWSDeviceService';
import {OWSLieFiService} from './services/OWSLieFiService';
@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot({ mode: "md" }),
    AppRoutingModule,
    IonicStorageModule.forRoot({ name: 'openWeatherStation', driverOrder: [CordovaSQLiteDriver._driver, Drivers.IndexedDB, Drivers.LocalStorage] }),
  ],
  providers: [
    AppVersion,
    PowerManagement,
    BatteryStatus,
    BackgroundMode,
    Device,
    InAppBrowser,
    SQLite,
    File,
    BluetoothSerial,
    OWSCloudService,
    OWSDataService,
    OWSDeviceService,
    OWSLieFiService,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideHttpClient(withInterceptorsFromDi())
  ]
})
export class AppModule { }
