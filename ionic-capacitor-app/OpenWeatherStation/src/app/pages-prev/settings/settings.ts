import {Component} from '@angular/core';
import {AlertController} from 'ionic-angular';
import {Storage} from '@ionic/storage';
import {PowerManagement} from '@ionic-native/power-management';
import {Autostart} from '@ionic-native/autostart';

@Component({
    selector: 'page-settings',
    templateUrl: 'settings.html'
})
export class SettingsPage {

    storageAppSettingsName: string = "appSettings";

    appSettings: any = {
        keep_screen_on: false,
        start_on_boot: false
    };

    constructor(public alertCtrl: AlertController, public storage: Storage, public powerManagement: PowerManagement, public autostart: Autostart) {}

    ionViewDidLeave() {}

    ionViewDidEnter() {
        this.storage.get(this.storageAppSettingsName).then((appSettings) => {
            if (appSettings) {
                this.appSettings = appSettings;
            }
        }).catch();
    }

    save() {
        let confirm = this.alertCtrl.create({
            title: "Save settings",
            message: "Are you sure you want to apply the current settings?",
            buttons: [
                {
                    text: 'Accept',
                    handler: () => {
                        if (!this.appSettings.keep_screen_on) {
                            this.powerManagement.release();
                        } else {
                            this.powerManagement.dim();
                        }
                        if(this.appSettings.start_on_boot){
                            this.autostart.enable();
                        }else{
                            this.autostart.disable();
                        }
                        this.storage.set(this.storageAppSettingsName, this.appSettings).then(() => {
                            this.showAlert("Settings saved", "");
                        }).catch(() => {
                            this.showAlert("Error saving settings", "There was an unexpected error saving your settings, try again later or restart the app.");
                        });
                    }
                },
                {
                    text: 'Cancel',
                    handler: () => {}
                }
            ]
        });
        confirm.present();
    }

    showAlert(title: string, msg: string) {
        let alert = this.alertCtrl.create({
            title: title,
            subTitle: msg,
            buttons: ['OK']
        });
        alert.present();
    }

}
