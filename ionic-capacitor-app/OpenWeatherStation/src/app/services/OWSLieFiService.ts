import { Injectable } from '@angular/core';
import { OWSEventMgr } from './OWSEventMgr';
import { OWSEventsTypes } from './OWSEventsTypes';

declare var cordova: any;

@Injectable()
export class OWSLieFiService {

    private serviceInitialized: boolean = false;
    private wifiManager: any;
    private currentFailedAttempts: number = 0;
    private isCheckingIfWifiIsWorkingAgain: boolean = false;

    private maxFailedAttemptsThreshold: number = 5;
    private maxMinutesOnAlternateConnection: number = 60;
    private failedAttempsCheckingWifiIsWorkingAgain: number = 5;

    constructor() {
    }

    initialize() {
        if (this.serviceInitialized) {
            return;
        }
        this.serviceInitialized = true;
        try {
            this.wifiManager = cordova.plugins.WifiManager;
            OWSEventMgr.listen(OWSEventsTypes.CLOUD_NO_INTERNET_CONNECTION)?.subscribe(this.manageFailedHTTPRequestHandler);
            OWSEventMgr.listen(OWSEventsTypes.CLOUD_SEND_DATA_SUCCEEDED)?.subscribe(this.manageSuccessHTTPRequestHandler);
        } catch (e) { }
    }

    private manageFailedHTTPRequestHandler = (settings: any) => {
        let preventLieFi = settings.preventLieFi ? true : false;
        if (!preventLieFi) {
            return;
        }
        this.currentFailedAttempts++;
        if ((this.currentFailedAttempts > this.maxFailedAttemptsThreshold && !this.isCheckingIfWifiIsWorkingAgain) ||
            (this.currentFailedAttempts > this.failedAttempsCheckingWifiIsWorkingAgain && this.isCheckingIfWifiIsWorkingAgain)) {
            this.switchConnection();
        }
    }

    private manageSuccessHTTPRequestHandler = () => {
        this.currentFailedAttempts = 0;
        this.wifiManager.isWifiEnabled((err: any, isWifiEnabled: any) => {
            if (isWifiEnabled) {
                this.isCheckingIfWifiIsWorkingAgain = false;
            }
        });
    }

    private switchConnection() {
        this.wifiManager.isWifiEnabled((err: any, isWifiEnabled: any) => {
            if (err) {
                return;
            }
            this.currentFailedAttempts = 0;
            if (isWifiEnabled) {
                this.restoreWifiAfterGivenTime();
            } else {
                this.isCheckingIfWifiIsWorkingAgain = false;
            }
            this.wifiManager.setWifiEnabled(!isWifiEnabled, function (err: any, success: any) { });
        });
    }

    private restoreWifiAfterGivenTime() {
        setTimeout(() => {
            this.wifiManager.isWifiEnabled((err: any, isWifiEnabled: any) => {
                if (err || isWifiEnabled) {
                    return;
                }
                this.currentFailedAttempts = 0;
                this.isCheckingIfWifiIsWorkingAgain = true;
                this.wifiManager.setWifiEnabled(true, function (err: any, success: any) { });
            });
        }, this.maxMinutesOnAlternateConnection * 60 * 1000);
    }
}