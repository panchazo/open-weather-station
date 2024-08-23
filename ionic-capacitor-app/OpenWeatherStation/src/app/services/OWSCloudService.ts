import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { OWSEventMgr } from "./OWSEventMgr";
import { OWSSample } from "../models/OWSSample";
import { OWSCloudConfig } from "../models/OWSCloudConfig";
import { OWSEventsTypes } from './OWSEventsTypes';
import { lastValueFrom } from 'rxjs';


@Injectable()
export class OWSCloudService {

    private serviceInitialized: boolean = false;
    private storageCloudConfigName: string = "OWSCloudConfiguration";
    private storageCloudLatestResponsesName: string = "OWSCloudResponses";
    private latestResponses: Array<any> = [];
    private resendSamplesCurrentInterval: any = { main: 5 * 1000, secondary: 5 * 1000 };
    private resendSamplesNormalInterval: any = { main: 5 * 1000, secondary: 5 * 1000 };
    private resendSamplesFallbackInterval: any = { main: 2 * 60 * 1000, secondary: 2 * 60 * 1000 };
    private mobileBattery = { level: 0, isPlugged: false };
    private configs: any = {};

    constructor(public storage: Storage, public http: HttpClient) { }

    initialize() {
        if (this.serviceInitialized) {
            return;
        }
        this.serviceInitialized = true;

        this.processNewSample();
        this.processConfigsRequest();
        this.processBatteryStatus();
        this.processSaveConfigs();
        this.processClearConfigs();
        this.processRequestLogs();
        this.processOldestUnsentSample();

        this.autoResendSamples("main");
        this.autoResendSamples("secondary");
        this.initLatestResponses();
    }

    private processOldestUnsentSample() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.DB_OLDEST_UNSENT_SAMPLE);
        observable.subscribe({
            next: (response: any) => {
                let configType: string = response.configType;
                let sample: OWSSample = response.sample;
                this.sendSampleToServer(sample, this.configs[configType]).then(() => { }).catch((e) => { });
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });
    }

    private processRequestLogs() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.CLOUD_REQUEST_LOGS);
        observable.subscribe({
            next: (response: any) => {
                OWSEventMgr.send(OWSEventsTypes.CLOUD_LOGS, { responseLog: this.latestResponses });
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });
    }

    private processClearConfigs() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.CLOUD_REQUEST_CLEAR_CONFIGS);
        observable.subscribe({
            next: (response: any) => {
                this.clearConfig().then(() => {
                    OWSEventMgr.send(OWSEventsTypes.CLOUD_CLEAR_CONFIGS, true);
                }).catch(() => {
                    OWSEventMgr.send(OWSEventsTypes.CLOUD_CLEAR_CONFIGS, false);
                });
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });

    }

    private processSaveConfigs() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.CLOUD_REQUEST_SAVE_CONFIGS);
        observable.subscribe({
            next: (configs: any) => {
                this.saveConfig(configs).then(() => {
                    OWSEventMgr.send(OWSEventsTypes.CLOUD_SAVE_CONFIGS, true);
                }).catch(() => {
                    OWSEventMgr.send(OWSEventsTypes.CLOUD_SAVE_CONFIGS, false);
                });
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });

    }

    private processBatteryStatus() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.CLOUD_BATTERY_STATUS);
        observable.subscribe({
            next: (status: any) => {
                const { level, isPlugged } = status;
                this.mobileBattery.level = level;
                this.mobileBattery.isPlugged = isPlugged;
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });
    }

    private processConfigsRequest() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.CLOUD_REQUEST_CONFIGS);
        observable.subscribe({
            next: (configs: any) => {
                this.getConfig(true).then((configs) => {
                    OWSEventMgr.send(OWSEventsTypes.CLOUD_CONFIGS, configs);
                }).catch((e) => { });
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });
    }

    private processNewSample() {
        let observable: any = OWSEventMgr.listen(OWSEventsTypes.DB_SAVE_SUCCESS);
        observable.subscribe({
            next: (sample: OWSSample) => {
                this.getConfig().then((configs) => {
                    let mainConf: OWSCloudConfig = configs.main;
                    let secConf: OWSCloudConfig = configs.secondary;
                    let promises = [];
                    if (mainConf.enabled) {
                        promises.push(this.sendSampleToServer(sample, mainConf).catch((e) => {
                            return this.sendSampleToServer(sample, mainConf);
                        }));
                    }
                    if (secConf.enabled) {
                        promises.push(this.sendSampleToServer(sample, secConf).catch((e) => {
                            return this.sendSampleToServer(sample, secConf);
                        }));
                    }
                    return Promise.all(promises);
                }).catch((e) => { });
            },
            error: (e: any) => { },
            complete: (r: any) => { }
        });

    }

    private autoResendSamples(configType: string = "main") {
        setTimeout(() => {
            this.getConfig().then((config: any) => {
                if (!config[configType].enabled) {
                    this.resendSamplesCurrentInterval[configType] = this.resendSamplesFallbackInterval[configType];
                    return Promise.reject(configType + " config disabled");
                }
                if (!config[configType].retryUnsentSamples) {
                    this.resendSamplesCurrentInterval[configType] = this.resendSamplesFallbackInterval[configType];
                    return Promise.reject(configType + " retry disabled");
                }
                OWSEventMgr.send(OWSEventsTypes.DB_REQUEST_OLDEST_UNSENT_SAMPLE, configType);
                return;
            }).catch((e) => {
                this.resendSamplesCurrentInterval[configType] = this.resendSamplesFallbackInterval[configType];
            });
            this.autoResendSamples(configType);
        }, this.resendSamplesCurrentInterval[configType]);

    }

    private sendSampleToServer(sample: OWSSample, serverConfig: OWSCloudConfig): Promise<any> {
        let payload = {};

        payload = serverConfig.generatePayload(sample, this.mobileBattery);
        if (!payload) {
            return Promise.reject("No parseable data to send");
        }
        if (serverConfig.method == "get") {
            let urlAndData = serverConfig.getUrl() + "?" + this.serializeObjToGetUrl(payload);
            let headers = new HttpHeaders();
            let options = { headers: headers };
            return lastValueFrom(this.http.get(urlAndData, options)).then((response: any | Response) => {
                return this.processHttpResponse(response, serverConfig, sample);
            }).catch((response: Response) => {
                return this.processHttpResponse(response, serverConfig, sample);
            });

        }
        if (serverConfig.method == "post") {
            let headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' });
            let options = { headers: headers };
            return lastValueFrom(this.http.post(serverConfig.getUrl(), this.serializeObjToGetUrl(payload), options)).then((response: any | Response) => {
                return this.processHttpResponse(response, serverConfig, sample);
            }).catch((response: Response) => {
                return this.processHttpResponse(response, serverConfig, sample);
            });
        }

        if (serverConfig.method == "post_json") {
            let bodyString = JSON.stringify(payload); // Stringify payload
            let headers = new HttpHeaders({ 'Content-Type': 'application/json' }); // ... Set content type to JSON
            let options = { headers: headers };
            return lastValueFrom(this.http.post(serverConfig.getUrl(), bodyString, options)).then((response: any | Response) => {
                return this.processHttpResponse(response, serverConfig, sample);
            }).catch((response: Response) => {
                return this.processHttpResponse(response, serverConfig, sample);
            });
        }
        return Promise.reject("Not valid sample data to send");
    }



    private processHttpResponse(response: Response, serverConfig: OWSCloudConfig, sample: OWSSample): Promise<any> {
        let success = false;
        if (response.status == 0) {
            this.logResponse({ status: response.status ? 'none' : response.status, text: '(no internet connection)', url: serverConfig.url, success: success });
            OWSEventMgr.send(OWSEventsTypes.CLOUD_NO_INTERNET_CONNECTION, { sample: sample, configType: serverConfig.type ? serverConfig.type : "main", preventLieFi: serverConfig.preventLieFi, success: success });
            OWSEventMgr.send(OWSEventsTypes.CLOUD_SEND_DATA_ATTEMPT, { sample: sample, configType: serverConfig.type ? serverConfig.type : "main", success: success, responseLog: this.latestResponses });
            return Promise.reject(response);
        }
        if (!response || typeof response.text != "function") {
            this.logResponse({ status: response.status ? 'none' : response.status, text: '(response error)', url: serverConfig.url, success: success });
            OWSEventMgr.send(OWSEventsTypes.CLOUD_SEND_DATA_ATTEMPT, { sample: sample, configType: serverConfig.type ? serverConfig.type : "main", success: success, responseLog: this.latestResponses });
            return Promise.reject(response);
        }

        success = serverConfig.isSuccessResponse(response);

        this.logResponse({ status: response.status, text: response.text(), url: serverConfig.url, success: success });
        OWSEventMgr.send(OWSEventsTypes.CLOUD_SEND_DATA_ATTEMPT, { sample: sample, configType: serverConfig.type ? serverConfig.type : "main", success: success, responseLog: this.latestResponses });
        if (success) {
            OWSEventMgr.send(OWSEventsTypes.CLOUD_SEND_DATA_SUCCEEDED, { sample: sample, configType: serverConfig.type ? serverConfig.type : "main", success: success });
            this.resendSamplesCurrentInterval[serverConfig.type] = this.resendSamplesNormalInterval[serverConfig.type];
            return Promise.resolve(success);
        }
        return Promise.reject(response);
    }


    private logResponse(payload: any): Promise<any> {
        payload.datetime = new Date();
        if (!this.serviceInitialized) {
            return Promise.reject("cloud not initialized");
        }
        this.latestResponses.unshift(payload);
        if (this.latestResponses.length > 30) {
            this.latestResponses = this.latestResponses.slice(0, 30);
        }
        return this.storage.set(this.storageCloudLatestResponsesName, this.latestResponses);
    }

    private initLatestResponses() {
        if (!this.serviceInitialized) {
            return Promise.reject("cloud not initialized");
        }
        return this.storage.get(this.storageCloudLatestResponsesName).then((data) => {
            if (!data || !data.length) {
                this.latestResponses = [];
            } else {
                this.latestResponses = data;
            }
        }).catch((e) => {
            this.latestResponses = [];
        });
    }

    private saveConfig(configs: any): Promise<any> {
        this.configs = configs;
        return this.storage.set(this.storageCloudConfigName, configs);
    }

    private clearConfig(): Promise<any> {
        let main: OWSCloudConfig = new OWSCloudConfig();
        let secondary: OWSCloudConfig = new OWSCloudConfig("secondary");
        this.configs = { main: main, secondary: secondary };
        return this.storage.set(this.storageCloudConfigName, this.configs);
    }

    private getConfig(forceRefresh: boolean = false): Promise<any> {
        if (!forceRefresh && this.configs) {
            return Promise.resolve(this.configs);
        }
        return this.storage.get(this.storageCloudConfigName).then((data) => {
            let main: OWSCloudConfig = new OWSCloudConfig();
            let secondary: OWSCloudConfig = new OWSCloudConfig("secondary");
            if (!data || (!data.main && !data.secondary)) {
                this.configs = { main: main, secondary: secondary };
                return Promise.resolve(this.configs);
            }
            main.setFromStoredObj(data.main);
            secondary.setFromStoredObj(data.secondary);
            this.configs = { main: main, secondary: secondary };
            return Promise.resolve(this.configs);
        }).catch((e) => {
            return Promise.reject(e);
        });
    }


    private serializeObjToGetUrl(obj: any) {
        if (!obj) {
            return "";
        }
        var parts = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
            }
        }
        return parts.join('&');
    }


}