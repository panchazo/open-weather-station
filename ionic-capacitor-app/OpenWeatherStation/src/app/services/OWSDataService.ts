import { Injectable } from '@angular/core';
import { OWSEventMgr } from "../services/OWSEventMgr";
import { OWSSample } from "../models/OWSSample";
import { File } from '@awesome-cordova-plugins/file/ngx';
import { SQLiteObject, SQLite } from '@awesome-cordova-plugins/sqlite/ngx';

import * as moment from 'moment';
import { OWSEventsTypes } from './OWSEventsTypes';

@Injectable()
export class OWSDataService {

    private db: SQLiteObject | null = null;
    private dbFolderPath: string = 'databases/';
    private dbExportFolder: string = 'Download/';
    private dbExportName: string = "latest_openweatherstation_sqlite_3.db";

    private databaseName = "__owsdata_v1_0_0.db";
    private dbInitialized: boolean = false;
    private serviceInitialized: boolean = false;
    private maxDaysToKeepData: number = 180;

    constructor(private sqlite: SQLite, public file: File) {
    }

    initialize() {
        if (this.serviceInitialized) {
            return;
        }
        this.serviceInitialized = true;
        this.initEngineAndTables().then(() => {
            this.dbInitialized = true;
            this.processIncomingData();
            this.processSentDataToCloud();
            this.processLatestDataRequest();
            this.processMaxDaysRequest();
            this.processRequestOldestUnsentSample();
            this.processAllDataRequest();
            OWSEventMgr.send(OWSEventsTypes.DB_ENGINE_READY);
        }).catch((e) => { console.log("engine failure", e) });
    }

    private initEngineAndTables(): Promise<any> {
        return this.sqlite.create({
            name: this.databaseName,
            location: 'default' // the location field is required
        }).then((db) => {
            this.db = db;
            this.dropTable(false);
            return this.initializeDataTable();
        });
    }

    private processRequestOldestUnsentSample() {
        OWSEventMgr.listen(OWSEventsTypes.DB_REQUEST_OLDEST_UNSENT_SAMPLE)?.subscribe((configType: string = "main") => {
            this.getOldestUnsentSample(configType).then((sample: OWSSample) => {
                if (sample) {
                    OWSEventMgr.send(OWSEventsTypes.DB_OLDEST_UNSENT_SAMPLE, { sample: sample, configType: configType });
                }
            }).catch((e) => { console.log("db oldest", e) });
        });
    }

    private processMaxDaysRequest() {
        OWSEventMgr.listen(OWSEventsTypes.DB_REQUEST_DAYS_LIMIT)?.subscribe(() => {
            OWSEventMgr.send(OWSEventsTypes.DB_DAYS_LIMIT, this.maxDaysToKeepData);
        });
    }

    private processSentDataToCloud() {
        OWSEventMgr.listen(OWSEventsTypes.CLOUD_SEND_DATA_SUCCEEDED)?.subscribe((evPayload: any) => {
            let sampleId = evPayload.sample.id;
            let uploadedServer = evPayload.configType;
            let sentDateTime = moment.utc().format("YYYY-MM-DD HH:mm:ss");

            this.setSentSample(sampleId, uploadedServer, sentDateTime)
                .then((item) => {
                    OWSEventMgr.send(OWSEventsTypes.DB_SENT_SAMPLE_UPDATED, { configType: uploadedServer, sampleId: sampleId, sentDateTime: sentDateTime });
                }).catch((e) => { console.log("update failed", e) });
        });
    }

    private processIncomingData() {
        OWSEventMgr.listen(OWSEventsTypes.BLUETOOTH_NEW_DATA_AVAILABLE)?.subscribe((evPayload: any) => {
            if (!evPayload || !evPayload.data || evPayload.data.rt == null || evPayload.data.rt == 1) {
                return;
            }
            let sample: OWSSample = new OWSSample();
            sample.setFromOWSPayload(evPayload.data, evPayload.device);
            this.insertData(sample)
                .then((item) => {
                    sample.id = item.insertId;
                    OWSEventMgr.send(OWSEventsTypes.DB_SAVE_SUCCESS, sample);
                })
                .catch((e) => { console.log("insert failed", e) });
            this.cleanUpOldData()
                .then(() => { })
                .catch((e) => { console.log("cleanup failed", e) });
        });
    }

    private processLatestDataRequest() {
        OWSEventMgr.listen(OWSEventsTypes.DB_REQUEST_DATA_BY_INTERVAL)?.subscribe((fromTo: any) => {
            if (!this.dbInitialized) {
                return;
            }
            let getDataPromise = this.findFromTo(fromTo.from, fromTo.to);
            let getLatestPromise = this.getLatestData();
            let getOldestPromise = this.getOldestData();
            let getTotalPromise = this.countTotalSamples();

            Promise.all([getDataPromise, getLatestPromise, getOldestPromise, getTotalPromise]).then((arrResults: Array<any>) => {
                let rows: Array<OWSSample> = arrResults[0];
                let latest: OWSSample = arrResults[1];
                let oldest: OWSSample = arrResults[2];
                const { total, main, secondary } = arrResults[3];
                OWSEventMgr.send(OWSEventsTypes.DB_DATA_BY_INTERVAL, { rows: rows, latest: latest, oldest: oldest, total: total, pendingMain: main, pendingSecondary: secondary });
            }).catch((e) => { });
        });
    }

    private processAllDataRequest() {
        OWSEventMgr.listen(OWSEventsTypes.DB_REQUEST_EXPORT)?.subscribe(() => {
            this.copyDbToExternalLocation()
                .then((fileData) => {
                    OWSEventMgr.send(OWSEventsTypes.DB_REQUEST_EXPORT_FINISHED, fileData);
                })
                .catch((err) => {
                    OWSEventMgr.send(OWSEventsTypes.DB_REQUEST_EXPORT_FINISHED, false);
                });
        });
    }

    private initializeDataTable(): Promise<any> {
        if (!this.db) {
            return Promise.reject("DB not initialized");
        }
        let sql = 'CREATE TABLE IF NOT EXISTS samples(';
        sql += 'id INTEGER PRIMARY KEY AUTOINCREMENT,';
        sql += 'wind REAL, wind_angle REAL, gust REAL,';
        sql += 'gust_angle REAL, rain REAL, rain_hour REAL, temperature REAL,';
        sql += 'pressure REAL, humidity REAL, light REAL,';
        sql += 'ms REAL, created_at_utc TEXT NOT NULL, created_at_local TEXT NOT NULL,';
        sql += 'device_address TEXT, uploaded_on_main TEXT, uploaded_on_secondary TEXT)';

        return this.db.executeSql(sql, []);
    }
    private setSentSample(id: any, server: any, dateTime: any): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }
        let sql = "UPDATE samples SET uploaded_on_" + server + "='" + dateTime + "' WHERE id=?";
        return this.db.executeSql(sql, [id]);

    }

    private insertData(sample: OWSSample): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        return this.getSampleLastHourRain(sample).then((sample: OWSSample) => {

            if (!this.dbInitialized || !this.db) {
                return Promise.reject("DB not initialized");
            }

            let sql = 'INSERT INTO samples(wind, wind_angle, gust, gust_angle,';
            sql += 'rain, rain_hour, temperature, pressure, humidity, light, ms, created_at_utc,';
            sql += 'created_at_local, device_address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

            return this.db.executeSql(sql, [
                sample.wind, sample.wind_angle, sample.gust,
                sample.gust_angle, sample.rain, sample.rain_hour, sample.temperature,
                sample.pressure, sample.humidity, sample.light,
                sample.ms, sample.created_at_utc, sample.created_at_local,
                sample.device_address
            ]);
        }).catch((e) => { console.log("insert failed", e) });
    }

    private getSampleLastHourRain(sample: OWSSample): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        let oneHourAgo = moment(sample.created_at_utc).subtract(1, 'hour').format("YYYY-MM-DD HH:mm:ss");

        let sql = "SELECT sum(rain) as rain_hour FROM samples WHERE rain IS NOT NULL AND created_at_utc > '" + oneHourAgo + "' AND created_at_utc <= '" + sample.created_at_utc + "'";

        return this.db.executeSql(sql, [])
            .then((response) => {
                sample.rain_hour = (sample.rain ? sample.rain : 0) + (response.rows.item(0).rain_hour ? response.rows.item(0).rain_hour : 0);
                return Promise.resolve(sample);
            });
    }



    private countTotalSamples(): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        let sql = 'SELECT count(*) as count, 0 as destination FROM samples UNION ALL';
        sql += ' SELECT count(*) as count, 1 as destination  FROM samples  WHERE uploaded_on_main is NULL';
        sql += ' UNION ALL SELECT count(*) as count, 2 as destination ';
        sql += ' FROM samples WHERE uploaded_on_secondary is NULL ORDER BY destination ASC';

        return this.db.executeSql(sql, [])
            .then((response) => {
                return Promise.resolve({
                    total: response.rows.item(0).count,
                    main: response.rows.item(1).count,
                    secondary: response.rows.item(2).count
                });
            });
    }

    private getOldestUnsentSample(configType: string = "main"): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        if (configType != "main") {
            configType = "secondary";
        }

        let sql = 'SELECT * FROM samples WHERE ';
        sql += " uploaded_on_" + configType + " IS NULL ";
        sql += " AND id < (SELECT max(id) FROM samples)";
        sql += " ORDER BY created_at_utc ASC LIMIT 1";

        return this.db.executeSql(sql, [])
            .then(response => {
                if (response.rows.length > 0) {
                    let sample: OWSSample = new OWSSample();
                    sample.setFromDbItem(response.rows.item(0));
                    return Promise.resolve(sample);
                }
                return Promise.resolve(null);
            });
    }

    private findFromTo(dateTimeFromObj: any, dateTimeToObj = new Date): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        let dateTimeFromStrings = moment(dateTimeFromObj).utc().format("YYYY-MM-DD HH:mm:ss");
        let dateTimeToStrings = moment(dateTimeToObj).utc().format("YYYY-MM-DD HH:mm:ss");

        let sql = 'SELECT * FROM samples WHERE ';
        sql += "created_at_utc >= '" + dateTimeFromStrings + "'";
        sql += " AND created_at_utc <= '" + dateTimeToStrings + "'";
        sql += " ORDER BY created_at_utc ASC";


        return this.db.executeSql(sql, [])
            .then((response) => {
                let samples: Array<OWSSample> = [];
                for (let index = 0; index < response.rows.length; index++) {
                    let sample = new OWSSample();
                    sample.setFromDbItem(response.rows.item(index));
                    samples.push(sample);
                }
                return Promise.resolve(samples);
            });
    }

    private getOldestData(): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        let sql = 'SELECT * FROM samples ORDER BY created_at_utc ASC LIMIT 1';

        return this.db.executeSql(sql, [])
            .then(response => {
                let sample: OWSSample | null = null;
                if (response.rows.length > 0) {
                    sample = new OWSSample();
                    sample.setFromDbItem(response.rows.item(0));
                }
                return Promise.resolve(sample);
            });
    }

    private getLatestData(): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        let sql = 'SELECT * FROM samples ORDER BY created_at_utc DESC LIMIT 1';

        return this.db.executeSql(sql, [])
            .then(response => {
                let sample: OWSSample | null = null;
                if (response.rows.length > 0) {
                    sample = new OWSSample();
                    sample.setFromDbItem(response.rows.item(0));
                }
                return Promise.resolve(sample);
            });
    }

    private cleanUpOldData(): Promise<any> {
        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }
        let oldestRecordDatetime = moment().subtract(this.maxDaysToKeepData, "days").utc().format("YYYY-MM-DD HH:mm:ss");
        let sql = "DELETE FROM samples WHERE created_at_utc <= '" + oldestRecordDatetime + "'";
        return this.db.executeSql(sql, []);
    }

    private dropTable(use: false): Promise<any> {
        if (!use) {
            return Promise.resolve();
        }

        if (!this.dbInitialized || !this.db) {
            return Promise.reject("DB not initialized");
        }

        let sql = 'DROP TABLE IF EXISTS samples';
        return this.db.executeSql(sql, [])
            .then(() => {
                console.log("table_dropped");
            })
            .catch(error => {
                console.log("drop catch", error);
            });
    }



    private copyDbToExternalLocation(): Promise<any> {
        let dbPath: string = this.file.applicationStorageDirectory + this.dbFolderPath;
        let exportPath: string = this.file.externalRootDirectory + this.dbExportFolder;

        return this.file.removeFile(exportPath, this.dbExportName)
            .then(() => {
                return this.file.copyFile(dbPath, this.databaseName, exportPath, this.dbExportName)
                    .then((fileEntry) => {
                        return Promise.resolve({ exportPath: exportPath, exportFileName: this.dbExportName, fileEntry: fileEntry });
                    }).catch((err) => {
                        return Promise.reject('copy error');
                    });
            })
            .catch(() => {
                return this.file.copyFile(dbPath, this.databaseName, exportPath, this.dbExportName)
                    .then((fileEntry) => {
                        return Promise.resolve({ exportPath: exportPath, exportFileName: this.dbExportName, fileEntry: fileEntry });
                    }).catch((err) => {
                        return Promise.reject('copy error');
                    });
            });
    }

}