import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { BluetoothSerial } from '@awesome-cordova-plugins/bluetooth-serial/ngx';
import { OWSEventMgr } from "./OWSEventMgr";
import { OWSEventsTypes } from './OWSEventsTypes';

@Injectable()
export class OWSDeviceService {

    private storageOwsDeviceObjName: string = "currentOwsDevice";
    private currentOwsDevice: any = null;
    private currentOwsDeviceInitialized: boolean = false;
    private connected: boolean = false;
    private retryTimeout = 30000;
    private dataRxSubscribed: boolean = false;
    private serviceInitialized: boolean = false;
    private rebootCurrentDeviceInterval: any = null;
    private rebootCurrentDeviceHours: number = 6;

    constructor(public bt: BluetoothSerial, public storage: Storage) { }

    initialize() {
        if (this.serviceInitialized) {
            return;
        }
        this.serviceInitialized = true;

        this.initCurrentDevice();
        this.processBluetoothFailedConnection();
        this.processBluetoothConnectionSucceed();
        this.processBluetoothConnectionStatus();
        this.processBluetoothEnableStatus();
        this.processBluetoothSettings();
        this.processRequestCurrentDevice();
        this.processClearCurrentDevice();
        this.processPairedDevices();
        this.processSetCurrentDevice();
        this.processDisconnect();
        this.processConnect();
    }

    private processDisconnect() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_REQUEST_TO_DISCONNECT)?.subscribe(() => {
            this.disconnect();
        });
    }

    private processConnect() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_REQUEST_TO_CONNECT)?.subscribe(() => {
            this.connect();
        });
    }

    private processSetCurrentDevice() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_SET_CURRENT_DEVICE)?.subscribe((device: any) => {
            if (!this.currentOwsDevice || this.currentOwsDevice.address != device.address) {
                this.connected = false;
                this.currentOwsDevice = device;
                this.storage.set(this.storageOwsDeviceObjName, device);
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CURRENT_DEVICE, this.currentOwsDevice);
                this.bt.disconnect().then(
                    () => {
                        OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CLOSE, Date.now());
                        OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
                        this.connect();
                    }).catch((error: any) => {
                        OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CLOSE);
                        OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
                        this.connect();
                    });
            }
        });
    }

    private processPairedDevices() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_REQUEST_PAIRED_DEVICES)?.subscribe(() => {
            this.listPairedDevices().then((devices) => {
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_PAIRED_DEVICES, { devices: devices });
            }).catch((err) => {
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_PAIRED_DEVICES, { devices: false });
            });
        });
    }

    private processClearCurrentDevice() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_CLEAR_CURRENT_DEVICE)?.subscribe(() => {
            this.currentOwsDevice = null;
            this.storage.set(this.storageOwsDeviceObjName, null).then(() => { }, (err) => { });
            this.disconnect();
        });
    }

    private processRequestCurrentDevice() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_REQUEST_CURRENT_DEVICE)?.subscribe(() => {
            OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CURRENT_DEVICE, this.currentOwsDevice);
        });
    }


    private processBluetoothSettings() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_SHOW_SETTINGS)?.subscribe(() => {
            this.bt.showBluetoothSettings();
        });
    }

    private processBluetoothEnableStatus() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_REQUEST_ENABLE_STATUS)?.subscribe(() => {
            this.isBluetoothEnabled().then(() => {
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_ENABLE_STATUS, true);
            }).catch(() => {
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_ENABLE_STATUS, false);
            });
        });
    }

    private processBluetoothConnectionStatus() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_REQUEST_CONNECTION_STATUS)?.subscribe(() => {
            OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
        });
    }

    private processBluetoothConnectionSucceed() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_CONNECTION_SUCCEEDED)?.subscribe(() => {
            if (this.dataRxSubscribed) {
                return;
            }
            this.bt.subscribe('\n').subscribe((rawdata) => {
                this.dataRxSubscribed = true;
                if (!this.connected) {
                    this.connected = true;
                    OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_SUCCEEDED);
                    OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
                }
                this.processIncomingData(rawdata);
            });

        });
    }

    private processBluetoothFailedConnection() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_CONNECTION_FAILED)?.subscribe((error: any) => {
            this.retryConnection(error);
        });
    }

    private initCurrentDevice() {
        this.storage.get(this.storageOwsDeviceObjName).then((device) => {
            this.currentOwsDevice = device;
            this.currentOwsDeviceInitialized = true;
            OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_INITIALIZED, device);
            this.connect();
        }).catch((e) => { console.log("init current", e) });
    }

    private connect() {
        if (!this.currentOwsDevice || !this.currentOwsDevice.address) {
            return;
        }
        this.isBluetoothEnabled().then(() => {
            this.bt.connect(this.currentOwsDevice.address).subscribe(
                () => {
                    if (!this.connected) {
                        this.connected = true;
                        OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_SUCCEEDED);
                        OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);

                        clearInterval(this.rebootCurrentDeviceInterval);
                        this.rebootCurrentDeviceInterval = setInterval(() => {
                            this.bt.write("R");
                            setTimeout(() => {
                                this.connect();
                            }, 10 * 1000);
                        }, this.rebootCurrentDeviceHours * 60 * 60 * 1000);
                    }
                }, (error) => {
                    this.connected = false;
                    OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_FAILED);
                    OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
                });
        }).catch((e) => {
            clearInterval(this.rebootCurrentDeviceInterval);
            this.connected = false;
            OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_FAILED);
            OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
        });

    }

    private retryConnection(error: any) {
        setTimeout(() => { this.connect() }, this.retryTimeout);
    }

    private disconnect() {
        clearInterval(this.rebootCurrentDeviceInterval);
        this.bt.disconnect().then(
            () => {
                this.connected = false;
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CLOSE);
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
            }).catch((error) => {
                this.connected = false;
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CLOSE, error);
                OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED, this.connected);
            });
    }

    private processIncomingData(rawdata: any) {
        let parsedData: any = null;
        let evName = OWSEventsTypes.BLUETOOTH_NEW_DATA_AVAILABLE;
        try {
            parsedData = JSON.parse(rawdata);
        } catch (e) {
        }
        OWSEventMgr.send(evName, { data: parsedData, device: this.currentOwsDevice, rawdata: rawdata, realTime: parsedData && parsedData.rt ? true : false });

        //send ack to OWS device
        if (this.connected) {
            this.bt.write("T");
        }
    }

    private isBluetoothEnabled(): Promise<any> {
        return this.bt.isEnabled();
    }

    private listPairedDevices(): Promise<any> {
        return this.bt.list();
    }


}