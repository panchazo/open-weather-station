import {BrowserModule} from '@angular/platform-browser';
import {ErrorHandler, NgModule} from '@angular/core';
import {IonicApp, IonicErrorHandler, IonicModule} from 'ionic-angular';

import {MyApp} from './app.component';
import {HomePage} from '../pages/home/home';
import {DevicesPage} from '../pages/devices/devices';
import {RemotesPage} from '../pages/remotes/remotes';
import {SettingsPage} from '../pages/settings/settings';

import {StatusBar} from '@ionic-native/status-bar';
import {SplashScreen} from '@ionic-native/splash-screen';
import {BluetoothSerial} from '@ionic-native/bluetooth-serial';

import {IonicStorageModule} from '@ionic/storage';
import {SQLite} from '@ionic-native/sqlite';
import {HttpModule} from '@angular/http';

import {OWSDeviceService} from '../app/services/OWSDeviceService';
import {OWSDataService} from '../app/services/OWSDataService';
import {OWSCloudService} from '../app/services/OWSCloudService';
import {OWSEvents} from '../app/services/OWSEvents';
import {OWSLieFiService} from '../app/services/OWSLieFiService';

import {BackgroundMode} from '@ionic-native/background-mode';
import {Autostart} from '@ionic-native/autostart';
import {AppVersion} from '@ionic-native/app-version';
import {InAppBrowser} from '@ionic-native/in-app-browser';
import {BatteryStatus} from '@ionic-native/battery-status';
import {PowerManagement} from '@ionic-native/power-management';
import {Device} from '@ionic-native/device';
import {File} from '@ionic-native/file';

@NgModule({
    declarations: [
        MyApp,
        HomePage,
        DevicesPage,
        RemotesPage,
        SettingsPage
    ],
    imports: [
        BrowserModule,
        HttpModule,
        IonicModule.forRoot(MyApp),
        IonicStorageModule.forRoot()
    ],
    bootstrap: [IonicApp],
    entryComponents: [
        MyApp,
        HomePage,
        DevicesPage,
        RemotesPage,
        SettingsPage
    ],
    providers: [
        Autostart,
        AppVersion,
        BluetoothSerial,
        OWSDeviceService,
        OWSDataService,
        OWSCloudService,
        OWSLieFiService,
        OWSEvents,
        BackgroundMode,
        StatusBar,
        InAppBrowser,
        SplashScreen,
        SQLite,
        BatteryStatus,
        PowerManagement,
        Device,
        File,
        {provide: ErrorHandler, useClass: IonicErrorHandler}
    ]
})
export class AppModule {}
