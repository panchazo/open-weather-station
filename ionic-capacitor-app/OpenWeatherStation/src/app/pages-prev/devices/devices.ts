import {Component, NgZone} from '@angular/core';
import {AlertController} from 'ionic-angular';
import {LoadingController} from 'ionic-angular';
import {ActionSheetController} from 'ionic-angular';
import {OWSEvents} from "../../app/services/OWSEvents";
import {Events} from 'ionic-angular';

@Component({
    selector: 'page-devices',
    templateUrl: 'devices.html'
})
export class DevicesPage {

    paired: Array<any>;
    loading: any;
    actionSheet: any;
    actionSheetButtons: Array<any> = [];
    currentDevice: any = null;
    availableDevices: Array<any> = [];
    isCurrentDeviceWithinPaired = false;
    isCurrentDeviceConnected: boolean = false;
    currentRawData: string = "";
    showRawData: boolean = false;

    constructor(public alertCtrl: AlertController, public loadingCtrl: LoadingController, public actionSheetCtrl: ActionSheetController, public events: Events, public zone: NgZone) {
    }

    ionViewDidLeave() {
        this.events.unsubscribe(OWSEvents.BLUETOOTH_CONNECTION_CHANGED, this.connectionChangeHandler);
        this.events.unsubscribe(OWSEvents.BLUETOOTH_NEW_DATA_AVAILABLE, this.dataRxHandler);
        this.events.unsubscribe(OWSEvents.BLUETOOTH_CURRENT_DEVICE, this.currentDeviceHandler);
        this.events.unsubscribe(OWSEvents.BLUETOOTH_PAIRED_DEVICES, this.processPairedHandler);
        this.events.unsubscribe(OWSEvents.BLUETOOTH_ENABLE_STATUS, this.processBTStatusHandler);
    }

    ionViewDidEnter() {
        this.events.subscribe(OWSEvents.BLUETOOTH_CONNECTION_CHANGED, this.connectionChangeHandler);
        this.events.subscribe(OWSEvents.BLUETOOTH_NEW_DATA_AVAILABLE, this.dataRxHandler);
        this.events.subscribe(OWSEvents.BLUETOOTH_CURRENT_DEVICE, this.currentDeviceHandler);
        this.events.subscribe(OWSEvents.BLUETOOTH_PAIRED_DEVICES, this.processPairedHandler);
        this.events.subscribe(OWSEvents.BLUETOOTH_ENABLE_STATUS, this.processBTStatusHandler);

        this.events.publish(OWSEvents.BLUETOOTH_REQUEST_CONNECTION_STATUS);
        this.events.publish(OWSEvents.BLUETOOTH_REQUEST_CURRENT_DEVICE);
        this.events.publish(OWSEvents.BLUETOOTH_REQUEST_ENABLE_STATUS);

        this.currentRawData = "";
        this.showRawData = false;
        this.refreshPairedDevices();
    }

    currentDeviceHandler = (currentDevice: any) => {
        this.zone.run(() => {
            this.currentDevice = currentDevice;
        });
    }

    connectionChangeHandler = (connected) => {
        this.zone.run(() => {
            this.isCurrentDeviceConnected = connected;
            this.dismissLoading();
        });
    }

    dataRxHandler = (data) => {
        this.zone.run(() => {
            this.currentRawData = data.rawdata + "<br>" + this.currentRawData;
        });
    }
    processBTStatusHandler = (enabled) => {
        if (!enabled) {
            this.showAlert("Check bluetooth access", "Bluetooth is not enabled");
        }
    }

    processPairedHandler = (list) => {
        this.dismissLoading();
        if (!list.devices) {
            this.showAlert("Error", "Bluetooth paired devices list error");
        } else {
            this.paired = list.devices;
            this.checkCurrentDeviceIsPaired();
        }
    }

    refreshPairedDevices() {
        this.showLoading("Requesting paired devices...");
        this.events.publish(OWSEvents.BLUETOOTH_REQUEST_PAIRED_DEVICES);
    }

    checkCurrentDeviceIsPaired() {
        this.isCurrentDeviceWithinPaired = false;
        for (let device of this.paired) {
            if (this.currentDevice && device.address == this.currentDevice.address) {
                this.isCurrentDeviceWithinPaired = true;
                break;
            }
        }
    }

    deviceSelected(device) {
        let buttons = [];
        if (this.currentDevice && device.address == this.currentDevice.address) {
            buttons.push(
                {
                    text: this.isCurrentDeviceConnected ? "Disconnect" : "Connect",
                    icon: "bluetooth",
                    cssClass: 'actionButton',
                    handler: () => {
                        this.toggleDeviceConnection(device);
                    }
                }
            );
            if (this.isCurrentDeviceConnected) {
                buttons.push(
                    {
                        text: (this.showRawData ? "Hide" : "Show") + " data monitor",
                        icon: "eye",
                        cssClass: 'actionButton',
                        handler: () => {
                            this.currentRawData = "";
                            this.showRawData = !this.showRawData;
                        }
                    }
                );
            }
        }
        buttons.push(
            {
                text: 'Set/unset OWS device',
                icon: "checkmark",
                cssClass: 'actionButton',
                handler: () => {
                    this.toggleDevice(device);
                }
            },
            {
                text: 'Cancel',
                role: 'cancel',
                icon: "close",
                cssClass: 'actionButtonCancel',
                handler: () => {
                }
            });
        let actionSheet = this.actionSheetCtrl.create({
            title: 'Paired device',
            cssClass: 'actionSheet',
            buttons: buttons
        });
        actionSheet.present();
    }

    toggleDeviceConnection(device) {
        this.showLoading("Switching connection...");
        if (this.isCurrentDeviceConnected) {
            this.events.publish(OWSEvents.BLUETOOTH_REQUEST_TO_DISCONNECT);
        } else {
            this.events.publish(OWSEvents.BLUETOOTH_REQUEST_TO_CONNECT);
        }
    }

    toggleDevice(device) {
        let confirm;
        if (this.currentDevice && device.address == this.currentDevice.address) {
            confirm = this.alertCtrl.create({
                title: "Unset this device as the OWS module?",
                message: "This will disconnect from the module and stop any further communication",
                buttons: [
                    {
                        text: 'Accept',
                        handler: () => {
                            this.currentDevice = null;
                            this.events.publish(OWSEvents.BLUETOOTH_CLEAR_CURRENT_DEVICE);
                            this.checkCurrentDeviceIsPaired();
                        }
                    },
                    {
                        text: 'Cancel',
                        handler: () => {}
                    }
                ]
            });
        } else {
            confirm = this.alertCtrl.create({
                title: "Use this device as the OWS module?",
                message: "If other device was previously selected this one will be used instead.",
                buttons: [
                    {
                        text: 'Accept',
                        cssClass: 'actionButton',
                        handler: () => {
                            this.events.publish(OWSEvents.BLUETOOTH_SET_CURRENT_DEVICE, device);
                            this.currentDevice = device;
                            this.checkCurrentDeviceIsPaired();
                        }
                    },
                    {
                        text: 'Cancel',
                        cssClass: 'actionButtonCancel',
                        handler: () => {}
                    }
                ]
            });
        }
        confirm.present();
    }

    openBluetoothSettings() {
        this.events.publish(OWSEvents.BLUETOOTH_SHOW_SETTINGS);
    }

    showAlert(title: string, msg: string) {
        let alert = this.alertCtrl.create({
            title: title,
            subTitle: msg,
            buttons: ['OK']
        });
        alert.present();
    }

    showLoading(msg: string = "") {
        if (msg == "") {
            msg = 'Please wait...';
        }
        this.loading = this.loadingCtrl.create({
            content: msg,
            spinner: 'crescent'
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

}
