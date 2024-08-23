import {Component, NgZone} from '@angular/core';
import {AlertController} from 'ionic-angular';
import {LoadingController} from 'ionic-angular';
import {Events} from 'ionic-angular';
import {OWSEvents} from "../../app/services/OWSEvents";
import {OWSCloudConfig} from "../../app/models/OWSCloudConfig";

declare var cordova: any;


@Component({
    selector: 'page-remotes',
    templateUrl: 'remotes.html'
})
export class RemotesPage {

    mainConfig: OWSCloudConfig = new OWSCloudConfig();
    secondaryConfig: OWSCloudConfig = new OWSCloudConfig("secondary");
    showRemoteLog = false;
    remoteLogData = "";
    loading: any = null;
    exportFilePath: string = null;
    exportFileName: string = null;

    constructor(public alertCtrl: AlertController, public loadingCtrl: LoadingController, public events: Events, public zone: NgZone) {}

    ionViewDidLeave() {
        this.events.unsubscribe(OWSEvents.CLOUD_CONFIGS, this.setRemoteConfigsHandler);
        this.events.unsubscribe(OWSEvents.CLOUD_SEND_DATA_ATTEMPT, this.httpLogHandler);
        this.events.unsubscribe(OWSEvents.CLOUD_LOGS, this.httpLogHandler);
        this.events.unsubscribe(OWSEvents.CLOUD_SAVE_CONFIGS, this.saveConfigsResponseHandler);
        this.events.unsubscribe(OWSEvents.CLOUD_CLEAR_CONFIGS, this.clearConfigsResponseHandler);
        this.events.unsubscribe(OWSEvents.DB_REQUEST_EXPORT_FINISHED, this.processExportData);
    }

    ionViewDidEnter() {
        this.events.subscribe(OWSEvents.CLOUD_CONFIGS, this.setRemoteConfigsHandler);
        this.events.subscribe(OWSEvents.CLOUD_SEND_DATA_ATTEMPT, this.httpLogHandler);
        this.events.subscribe(OWSEvents.CLOUD_LOGS, this.httpLogHandler);
        this.events.subscribe(OWSEvents.CLOUD_SAVE_CONFIGS, this.saveConfigsResponseHandler);
        this.events.subscribe(OWSEvents.CLOUD_CLEAR_CONFIGS, this.clearConfigsResponseHandler);
        this.events.subscribe(OWSEvents.DB_REQUEST_EXPORT_FINISHED, this.processExportData);

        this.events.publish(OWSEvents.CLOUD_REQUEST_CONFIGS);
    }

    private httpLogHandler = (response) => {
        this.zone.run(() => {
            let logs = response.responseLog;
            this.remoteLogData = "";
            for (let i = 0; i < logs.length; i++) {
                this.remoteLogData = this.remoteLogData + "Server url:" + logs[i].url + "<br>Treated as successfull? " + logs[i].success;
                this.remoteLogData += "<br>Status code:" + logs[i].status + "<br>Response:" + logs[i].text + "<br>Datetime:" + logs[i].datetime + "<hr>";
            }
            if (!logs.length) {
                this.remoteLogData = "There are no cloud responses to show";
            } else {
                this.remoteLogData = "Showing past " + logs.length + " server responses... <br><br>" + this.remoteLogData;
            }
        });
    }

    private clearConfigsResponseHandler = (result) => {
        if (result) {
            let alert = this.alertCtrl.create({
                title: "Configuration deleted",
                subTitle: "Primary and secondary remote configuration removed.",
                buttons: ['OK']
            });
            alert.present();
        } else {
            let alert = this.alertCtrl.create({
                title: "Configuration removal failed",
                subTitle: "There was an unexpected failure, the configuration cannot be deleted",
                buttons: ['OK']
            });
            alert.present();
        }
    }
    private saveConfigsResponseHandler = (result) => {
        if (result) {
            let alert = this.alertCtrl.create({
                title: "Configuration saved",
                subTitle: "Primary and secondary remote configuration saved.",
                buttons: ['OK']
            });
            alert.present();
        } else {
            let alert = this.alertCtrl.create({
                title: "Configuration save failed",
                subTitle: "There was an unexpected failure, the configuration cannot be saved",
                buttons: ['OK']
            });
            alert.present();
        }
    }

    private setRemoteConfigsHandler = (configs) => {
        this.zone.run(() => {
            this.mainConfig = configs.main;
            this.secondaryConfig = configs.secondary;
        });
    }

    private processExportData = (succeed) => {
        if (!succeed) {
            this.dismissLoading();
            this.showAlert("Error exporting data", "There was an error exporting your data");
            return;
        }
        this.dismissLoading();
        this.exportFilePath = succeed.exportPath;
        this.exportFileName = succeed.exportFileName;
        this.showAlert("Data exported!", "The SQLlite db file is ready and stored locally under: " + succeed.exportPath + succeed.exportFileName + ", now you can send it using the share icon below");
    }

    saveConfig() {
        if (this.mainConfig.enabled && this.mainConfig.service == "custom" && !this.mainConfig.url.trim().length) {
            this.showAlert("Main server error", "You must define the custom endpoint URL");
            return;
        }
        if (this.secondaryConfig.enabled && this.secondaryConfig.service == "custom" && !this.secondaryConfig.url.trim().length) {
            this.showAlert("Secondary server error", "You must define the custom endpoint URL");
            return;
        }

        let confirm = this.alertCtrl.create({
            title: "Save current cloud configuration?",
            message: "As soon as the configuration is saved the device will attempt to connect and sync any pending data",
            buttons: [
                {
                    text: 'Accept',
                    handler: () => {
                        this.events.publish(OWSEvents.CLOUD_REQUEST_SAVE_CONFIGS, {main: this.mainConfig, secondary: this.secondaryConfig});
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

    deleteConfig() {
        let confirm = this.alertCtrl.create({
            title: "Remove current configuration?",
            message: "This action cannot be reverted...",
            buttons: [
                {
                    text: 'Accept',
                    handler: () => {
                        this.events.publish(OWSEvents.CLOUD_REQUEST_CLEAR_CONFIGS);
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

    setServiceConfigs(config: OWSCloudConfig) {
        this.zone.run(() => {config.setServiceDefaults();});
    }

    showMonitor() {
        this.showRemoteLog = !this.showRemoteLog;
        if (this.showRemoteLog) {
            this.events.publish(OWSEvents.CLOUD_REQUEST_LOGS);
        }
    }

    showAlert(title: string, msg: string) {
        let alert = this.alertCtrl.create({
            title: title,
            subTitle: msg,
            buttons: ['OK']
        });
        alert.present();
    }

    showLoading(msg: string = "", duration: number = 60 * 1000) {
        if (msg == "") {
            msg = 'Refreshing charts...';
        }
        this.loading = this.loadingCtrl.create({
            content: msg,
            spinner: 'crescent',
            duration: duration
        });
        this.loading.present();
    }

    dismissLoading() {
        if (this.loading) {
            try {
                this.loading.dismiss();
            } catch (e) {}
        }
    }

    export() {
        let confirm = this.alertCtrl.create({
            title: "Export samples database?",
            message: "Previous exported file will be overwriten with the new data. Continue?",
            buttons: [
                {
                    text: 'Accept',
                    handler: () => {
                        let waitAlertBody = "Data is being prepared for export, this action may take several minutes...";
                        this.showLoading(waitAlertBody, 120 * 1000);
                        this.events.publish(OWSEvents.DB_REQUEST_EXPORT);
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

    sendExport() {
        if (this.exportFilePath == null || this.exportFileName == null) {
            this.showAlert("There is no exported data", "Please generate an export file first");
            return;
        }

        let confirm = this.alertCtrl.create({
            title: "Share previously exported database?",
            message: "You can update the latest db export by touching the export button.",
            buttons: [
                {
                    text: 'Accept',
                    handler: () => {
                        if (cordova && cordova.plugins) {
                            cordova.plugins.email.isAvailable((available: boolean) => {
                                if (available) {
                                    let emailOptions: any = {
                                        body: "OpenWeatherStation data attached",
                                        attachments: this.exportFilePath + this.exportFileName, // file paths or base64 data streams
                                    }
                                    cordova.plugins.email.open(emailOptions);
                                } else {
                                    this.showAlert("Unable to open local mail app", "Please make sure you have granted privileges for the app to open your email and ensure you have gmail or similar installed");
                                }
                            });
                        } else {
                            this.showAlert("Share error", "Sending the export file is not available at this moment");
                        }
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

}
