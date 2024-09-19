import { Component, NgZone, ViewChild } from '@angular/core';

import { Chart, ChartOptions } from 'chart.js';
import { DevicesPage } from '../devices/devices.page';
import { OWSSample } from 'src/app/models/OWSSample';
import { OWSEventMgr } from 'src/app/services/OWSEventMgr';
import { ActionSheetController, LoadingController } from '@ionic/angular';
import { OWSEventsTypes } from 'src/app/services/OWSEventsTypes';

import * as moment from 'moment';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  @ViewChild('windAndGustCanvas') windAndGustCanvas: any;
  @ViewChild('angleCanvas') angleCanvas: any
  @ViewChild('rainCanvas') rainCanvas: any;
  @ViewChild('temperatureCanvas') temperatureCanvas: any;
  @ViewChild('humidityCanvas') humidityCanvas: any;
  @ViewChild('pressureCanvas') pressureCanvas: any;
  @ViewChild('lightCanvas') lightCanvas: any;

  devicesPage: any = DevicesPage;
  isCurrentDeviceConnected: boolean = false;

  chartSamples: Array<OWSSample> = [];
  temperatureChart: Chart | undefined;
  humidityChart: Chart | undefined;
  pressureChart: Chart | undefined;
  lightChart: Chart | undefined;
  windAndGustChart: Chart | undefined;
  rainChart: Chart | undefined;
  angleChart: Chart | undefined;

  latestSample: OWSSample | null = null;
  oldestSample: OWSSample | null = null;
  totalSamples: number | null = null;
  totalSamplesPendingUploadMain: number | null = null;
  totalSamplesPendingUploadSecondary: number | null = null;
  remoteConfigsMainEnabled: boolean = false;
  remoteConfigsSecondaryMainEnabled: boolean = false;

  showChartByLastXHours: number = 1;
  showChartDateFrom = moment().format("YYYY-MM-DD");
  showDateTimeSelection: boolean = false;
  showChartTimeRange = { lower: 0, upper: 24 };
  lastChartUpdateTimestamp: number = 0;
  forceChartRefresh: boolean = true;
  minMillisToAutorefreshCharts: number = 60 * 1000;

  maxDaysToKeepData: number = 0;

  Math: Math = Math;
  loading: any = null;
  moment: any = moment;

  constructor(public actionSheetCtrl: ActionSheetController,
    public loadingCtrl: LoadingController, public zone: NgZone) {
  }

  ngAfterViewInit() {
    OWSEventMgr.listen(OWSEventsTypes.DB_ENGINE_READY)?.subscribe(() => {
      OWSEventMgr.send(OWSEventsTypes.CLOUD_REQUEST_CONFIGS);
      OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_REQUEST_CONNECTION_STATUS);
      OWSEventMgr.send(OWSEventsTypes.DB_REQUEST_DAYS_LIMIT);
      this.requestDataByIntervalHandler();
    });

    this.temperatureChart = this.initChart(this.temperatureCanvas, [{ label: "Temperature (Cº)", borderColor: '#ff8800' }]);
    this.humidityChart = this.initChart(this.humidityCanvas, [{ label: "Humidity (%)", borderColor: '#00BFFF' }]);
    this.pressureChart = this.initChart(this.pressureCanvas, [{ label: "Abs.Pressure (hPa)", borderColor: '#D24DFF' }]);
    this.windAndGustChart = this.initChart(this.windAndGustCanvas, [{ label: "Wind (Km/h)", borderColor: '#00D936' }, { label: "Gust (Km/h)", borderColor: '#FF4000' }]);
    this.angleChart = this.initChart(this.angleCanvas, [{ label: "Direction (0º/360º=N,180º=S)", borderColor: '#666666' }]);
    this.rainChart = this.initChart(this.rainCanvas, [{ label: "Cumulative rain (mm)", borderColor: '#0040FF' }]);
    this.lightChart = this.initChart(this.lightCanvas, [{ label: "Light (lux)", borderColor: '#FFFF00' }]);

  }

  testChartData() {
    //create a test dataset for the temperature chart to test the updateChartData method with 10 measurements
    let testLabels = [];
    let testData = [];
    for (let i = 0; i < 10; i++) {
      testLabels.push(moment().add(i, 'minutes'));
      testData.push(Math.random() * 10 + 1000);
    }
    this.updateChartData(this.pressureChart, testLabels, testData);
  }


  ionViewDidEnter() {
    //this.showLoading();

    OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_CONNECTION_CHANGED)?.subscribe(this.connectionChangeHandler);
    OWSEventMgr.listen(OWSEventsTypes.DB_SAVE_SUCCESS)?.subscribe(this.requestDataByIntervalHandler);
    OWSEventMgr.listen(OWSEventsTypes.DB_SENT_SAMPLE_UPDATED)?.subscribe(this.requestDataByIntervalHandler);
    OWSEventMgr.listen(OWSEventsTypes.DB_DATA_BY_INTERVAL)?.subscribe(this.refreshDataHandler);
    OWSEventMgr.listen(OWSEventsTypes.DB_DAYS_LIMIT)?.subscribe(this.requestMaxDaysLimitHandler);
    OWSEventMgr.listen(OWSEventsTypes.CLOUD_CONFIGS)?.subscribe(this.setRemoteConfigsHandler);

    OWSEventMgr.send(OWSEventsTypes.CLOUD_REQUEST_CONFIGS);
    OWSEventMgr.send(OWSEventsTypes.DB_REQUEST_DAYS_LIMIT);
    OWSEventMgr.send(OWSEventsTypes.BLUETOOTH_REQUEST_CONNECTION_STATUS);

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
      const { main, secondary } = configs;
      this.remoteConfigsMainEnabled = main.enabled && main.retryUnsentSamples;
      this.remoteConfigsSecondaryMainEnabled = secondary.enabled && secondary.retryUnsentSamples;
    });
  }

  refreshDataHandler = (freshData: any) => {
    this.dismissLoading();

    const { rows, latest, oldest, total, pendingMain, pendingSecondary } = freshData;
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
    OWSEventMgr.send(OWSEventsTypes.DB_REQUEST_DATA_BY_INTERVAL, { from: fromDatetime, to: toDatetime });
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
    let cumulativeRain: any = [];
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

  updateChartData(chart: Chart | null | undefined, labels: Array<any>, data: Array<any>, datasetIndex: number = 0) {
    if (!chart) {
      return;
    }
    chart.data.labels = labels;
    if (chart.data.datasets) {
      chart.data.datasets[datasetIndex].data = data;
    }
    chart.update();
  }

  async showChartOptions() {
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
    let actionSheet = await this.actionSheetCtrl.create({
      header: 'Charts time interval',
      cssClass: 'actionSheet',
      buttons: buttons
    });
    actionSheet.present();
  }



  initChart(chartCanvas: any, datasetsConfigs: Array<any>, chartType = 'line'): Chart | undefined {
    let options: ChartOptions = {
      responsive: true,
      layout: {
        padding: {
          left: 5,
        }
      },
      scales: {
        xAxes: [{
          ticks: {
            fontSize: 9
          },
          type: 'time',
          time: {
            tooltipFormat: 'HH:mm',
            unit: 'second',
            displayFormats: {
              millisecond: 'HH:mm',
              second: 'HH:mm',
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'HH:mm',
              week: 'HH:mm',
              month: 'HH:mm',
              quarter: 'HH:mm',
              year: 'HH:mm'
            }
          }
        }]
      }
    };
    let data = {
      labels: [],
      datasets: [] as any[]
    }
    for (let i = 0; i < datasetsConfigs.length; i++) {
      const { label, borderColor } = datasetsConfigs[i];
      data.datasets.push({
        label: label,
        borderColor: borderColor,
        backgroundColor: borderColor,
        fill: false,
        spanGaps: false,
        data: []
      });
    }

    const { nativeElement } = chartCanvas;

    let chart = new Chart(nativeElement, {
      type: chartType,
      data: data,
      options: options
    });


    return chart;
  }

  async showLoading(msg: string = "", duration: number = 60 * 1000) {
    if (msg == "") {
      msg = 'Refreshing charts...';
    }
    this.loading = await this.loadingCtrl.create({
      message: msg,
      spinner: 'crescent',
      duration: duration
    });
    this.loading.present();
  }

  dismissLoading() {
    if (this.loading) {
      try {
        this.loading.dismiss();
      } catch (e) { }
    }
  }

}


