import {Component, NgZone} from '@angular/core';
import {ViewChild} from '@angular/core';
import {DevicesPage} from '../../pages/devices/devices';
import {Events} from 'ionic-angular';
import {ActionSheetController} from 'ionic-angular';
import {LoadingController} from 'ionic-angular';
import {OWSEvents} from "../../app/services/OWSEvents";
import {OWSSample} from "../../app/models/OWSSample";

import {Chart} from 'chart.js';
import * as moment from 'moment';

@Component({
    selector: 'page-home',
    templateUrl: 'home.html'
})
export class HomePage {

    @ViewChild('windAndGustCanvas') windAndGustCanvas;
    @ViewChild('angleCanvas') angleCanvas;
    @ViewChild('rainCanvas') rainCanvas;
    @ViewChild('temperatureCanvas') temperatureCanvas;
    @ViewChild('humidityCanvas') humidityCanvas;
    @ViewChild('pressureCanvas') pressureCanvas;
    @ViewChild('lightCanvas') lightCanvas;

    devicesPage = DevicesPage;
    isCurrentDeviceConnected: boolean = false;

    chartSamples: Array<OWSSample> = [];
    temperatureChart: Chart;
    humidityChart: Chart;
    pressureChart: Chart;
    lightChart: Chart;
    windAndGustChart: Chart;
    rainChart: Chart;
    angleChart: Chart;

    latestSample: OWSSample = null;
    oldestSample: OWSSample = null;
    totalSamples: number = null;
    totalSamplesPendingUploadMain: number = null;
    totalSamplesPendingUploadSecondary: number = null;
    remoteConfigsMainEnabled: boolean = false;
    remoteConfigsSecondaryMainEnabled: boolean = false;

    showChartByLastXHours: number = 1;
    showChartDateFrom = moment().format("YYYY-MM-DD");
    showDateTimeSelection: boolean = false;
    showChartTimeRange = {lower: 0, upper: 24};
    lastChartUpdateTimestamp: number = 0;
    forceChartRefresh: boolean = true;
    minMillisToAutorefreshCharts: number = 60 * 1000;

    maxDaysToKeepData: number = 0;

    Math: Math = Math;
    loading: any = null;
    moment: any = moment;

    constructor(public events: Events, public actionSheetCtrl: ActionSheetController, public loadingCtrl: LoadingController, public zone: NgZone) {
    }

    ionViewDidLoad() {
        this.events.subscribe(OWSEvents.DB_ENGINE_READY, () => {
            this.events.publish(OWSEvents.CLOUD_REQUEST_CONFIGS);
            this.events.publish(OWSEvents.BLUETOOTH_REQUEST_CONNECTION_STATUS);
            this.events.publish(OWSEvents.DB_REQUEST_DAYS_LIMIT);
            this.requestDataByIntervalHandler();
        });

        this.temperatureChart = this.initChart(this.temperatureCanvas, [{label: "Temperature (Cº)", borderColor: '#ff8800'}]);
        this.humidityChart = this.initChart(this.humidityCanvas, [{label: "Humidity (%)", borderColor: '#00BFFF'}]);
        this.pressureChart = this.initChart(this.pressureCanvas, [{label: "Abs.Pressure (hPa)", borderColor: '#D24DFF'}]);
        this.windAndGustChart = this.initChart(this.windAndGustCanvas, [{label: "Wind (Km/h)", borderColor: '#00D936'}, {label: "Gust (Km/h)", borderColor: '#FF4000'}]);
        this.angleChart = this.initChart(this.angleCanvas, [{label: "Direction (0º/360º=N,180º=S)", borderColor: '#666666'}]);
        this.rainChart = this.initChart(this.rainCanvas, [{label: "Cumulative rain (mm)", borderColor: '#0040FF'}]);
        this.lightChart = this.initChart(this.lightCanvas, [{label: "Light (lux)", borderColor: '#FFFF00'}]);
    }


    ionViewDidLeave() {
        this.events.unsubscribe(OWSEvents.BLUETOOTH_CONNECTION_CHANGED, this.connectionChangeHandler);
        this.events.unsubscribe(OWSEvents.DB_SAVE_SUCCESS, this.requestDataByIntervalHandler);
        this.events.unsubscribe(OWSEvents.DB_SENT_SAMPLE_UPDATED, this.requestDataByIntervalHandler);
        this.events.unsubscribe(OWSEvents.DB_DATA_BY_INTERVAL, this.refreshDataHandler);
        this.events.unsubscribe(OWSEvents.DB_DAYS_LIMIT, this.requestMaxDaysLimitHandler);
        this.events.unsubscribe(OWSEvents.CLOUD_CONFIGS, this.setRemoteConfigsHandler);
    }

    ionViewDidEnter() {
        this.showLoading();
        
        this.events.subscribe(OWSEvents.BLUETOOTH_CONNECTION_CHANGED, this.connectionChangeHandler);
        this.events.subscribe(OWSEvents.DB_SAVE_SUCCESS, this.requestDataByIntervalHandler);
        this.events.subscribe(OWSEvents.DB_SENT_SAMPLE_UPDATED, this.requestDataByIntervalHandler);
        this.events.subscribe(OWSEvents.DB_DATA_BY_INTERVAL, this.refreshDataHandler);
        this.events.subscribe(OWSEvents.DB_DAYS_LIMIT, this.requestMaxDaysLimitHandler);
        this.events.subscribe(OWSEvents.CLOUD_CONFIGS, this.setRemoteConfigsHandler);

        this.events.publish(OWSEvents.CLOUD_REQUEST_CONFIGS);
        this.events.publish(OWSEvents.DB_REQUEST_DAYS_LIMIT);
        this.events.publish(OWSEvents.BLUETOOTH_REQUEST_CONNECTION_STATUS);
        
        this.requestDataByIntervalHandler();
    }

    requestMaxDaysLimitHandler = (maxDays: number) => {
        this.zone.run(() => {
            this.maxDaysToKeepData = maxDays;
        });
    }

    connectionChangeHandler = (connected: boolean) => {
        this.zone.run(() => {
            this.isCurrentDeviceConnected = connected;
        });
    }

    setRemoteConfigsHandler = (configs: any) => {
        this.zone.run(() => {
            const {main, secondary} = configs;
            this.remoteConfigsMainEnabled = main.enabled && main.retryUnsentSamples;
            this.remoteConfigsSecondaryMainEnabled = secondary.enabled && secondary.retryUnsentSamples;
        });
    }

    refreshDataHandler = (freshData: any) => {
        this.dismissLoading();

        const {rows, latest, oldest, total, pendingMain, pendingSecondary} = freshData;
        this.lastChartUpdateTimestamp = Date.now();
        this.zone.run(() => {
            this.latestSample = latest;
            this.oldestSample = oldest;
            this.totalSamples = total;
            this.chartSamples = rows;
            if (!this.showDateTimeSelection || this.forceChartRefresh) {
                this.forceChartRefresh = false;
                this.updateCharts();
            }
            this.totalSamplesPendingUploadMain = pendingMain;
            this.totalSamplesPendingUploadSecondary = pendingSecondary;
        });
    }

    requestDataByIntervalHandler = () => {
        let elapsedMillis = Date.now() - this.lastChartUpdateTimestamp;
        if (elapsedMillis < this.minMillisToAutorefreshCharts) {
            return;
        }
        let fromDatetime = new Date();
        let toDatetime = new Date();

        if (this.showDateTimeSelection) {
            fromDatetime = new Date(this.showChartDateFrom + " 00:00:00");
            fromDatetime.setHours(this.showChartTimeRange.lower);
            toDatetime = new Date(this.showChartDateFrom + " 00:00:00");
            toDatetime.setHours(this.showChartTimeRange.upper);
        } else {
            fromDatetime.setHours(fromDatetime.getHours() - this.showChartByLastXHours);
        }
        this.events.publish(OWSEvents.DB_REQUEST_DATA_BY_INTERVAL, {from: fromDatetime, to: toDatetime});
    }

    updateChartDateTimeRange() {
        this.minMillisToAutorefreshCharts = 0;
        this.requestDataByIntervalHandler();
        this.forceChartRefresh = true;
        this.showLoading();
    }

    updateCharts() {
        let labels = [];
        let temperature = [];
        let pressure = [];
        let humidity = [];
        let wind = [];
        let gust = [];
        let angle = [];
        let cumulativeRain = [];
        let light = [];

        for (let sample of this.chartSamples) {
            labels.push(moment(sample.created_at_local));
            temperature.push(sample.getPropertyByName("temperature", "C"));
            pressure.push(sample.getPropertyByName("pressure", "hPa"));
            humidity.push(sample.getPropertyByName("humidity"));
            wind.push(sample.getPropertyByName("wind", "kmph"));
            gust.push(sample.getPropertyByName("gust", "kmph"));
            angle.push(sample.getPropertyByName("wind_angle"));
            light.push(sample.getPropertyByName("light", "kmph"));
            if (cumulativeRain.length > 0) {
                cumulativeRain.push(cumulativeRain[cumulativeRain.length - 1] + sample.getPropertyByName("rain", "mm"));
            } else {
                cumulativeRain.push(sample.getPropertyByName("rain", "mm"));
            }
        }

        this.updateChartData(this.windAndGustChart, labels, wind);
        this.updateChartData(this.windAndGustChart, labels, gust, 1);
        this.updateChartData(this.angleChart, labels, angle);
        this.updateChartData(this.rainChart, labels, cumulativeRain);
        this.updateChartData(this.temperatureChart, labels, temperature);
        this.updateChartData(this.humidityChart, labels, humidity);
        this.updateChartData(this.pressureChart, labels, pressure);
        this.updateChartData(this.lightChart, labels, light);
    }

    updateChartData(chart: Chart, labels: Array<any>, data: Array<any>, datasetIndex: number = 0) {
        chart.data.labels = labels;
        chart.data.datasets[datasetIndex].data = data;
        chart.update();
    }

    showChartOptions() {
        let buttons = [];

        buttons.push(
            {
                text: 'Show past hour',
                cssClass: 'actionButton',
                handler: () => {
                    this.showDateTimeSelection = false;
                    this.showChartByLastXHours = 1;
                    this.lastChartUpdateTimestamp = 0;
                    this.showLoading();
                    this.requestDataByIntervalHandler();
                }
            },
            {
                text: 'Show past 2 hours',
                cssClass: 'actionButton',
                handler: () => {
                    this.showDateTimeSelection = false;
                    this.showChartByLastXHours = 2;
                    this.lastChartUpdateTimestamp = 0;
                    this.showLoading();
                    this.requestDataByIntervalHandler();
                }
            },
            {
                text: 'Show past 6 hours',
                cssClass: 'actionButton',
                handler: () => {
                    this.showDateTimeSelection = false;
                    this.showChartByLastXHours = 6;
                    this.lastChartUpdateTimestamp = 0;
                    this.showLoading();
                    this.requestDataByIntervalHandler();
                }
            },
            {
                text: 'Show past 12 hours',
                cssClass: 'actionButton',
                handler: () => {
                    this.showDateTimeSelection = false;
                    this.showChartByLastXHours = 12;
                    this.lastChartUpdateTimestamp = 0;
                    this.showLoading();
                    this.requestDataByIntervalHandler();
                }
            },
            {
                text: 'Show past 24hs',
                cssClass: 'actionButton',
                handler: () => {
                    this.showDateTimeSelection = false;
                    this.showChartByLastXHours = 24;
                    this.lastChartUpdateTimestamp = 0;
                    this.showLoading();
                    this.requestDataByIntervalHandler();
                }
            },
            {
                text: 'Custom date and time range',
                cssClass: 'actionButton',
                handler: () => {
                    if (this.oldestSample && this.latestSample) {
                        this.showDateTimeSelection = true;
                    }
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
            title: 'Charts time interval',
            cssClass: 'actionSheet',
            buttons: buttons
        });
        actionSheet.present();
    }



    initChart(chartCanvas, datasetsConfigs: Array<any>, chartType = 'line'): Chart {
        let options = {
            responsive: true,
            layout: {
                padding: {
                    left: 5,
                }
            },
            scales: {
                xAxes: [{
                    ticks: {
                        beginAtZero: true,
                        fontSize: 9
                    },
                    type: 'time',
                    time: {
                        tooltipFormat: 'HH:mm',
                        displayFormats: {
                            'millisecond': 'HH:mm',
                            'second': 'HH:mm',
                            'minute': 'HH:mm',
                            'hour': 'HH:mm',
                            'day': 'HH:mm',
                            'week': 'HH:mm',
                            'month': 'HH:mm',
                            'quarter': 'HH:mm',
                            'year': 'HH:mm'
                        }
                    }
                }]
            }
        };
        let data = {
            labels: [],
            datasets: []
        }
        for (let i = 0; i < datasetsConfigs.length; i++) {
            const {label, borderColor} = datasetsConfigs[i];
            data.datasets.push({
                label: label,
                borderColor: borderColor,
                backgroundColor: borderColor,
                fill: false,
                spanGaps: false,
                data: []
            });
        }
        const {nativeElement} = chartCanvas
        return new Chart(nativeElement, {
            type: chartType,
            data: data,
            options: options
        });

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

}

