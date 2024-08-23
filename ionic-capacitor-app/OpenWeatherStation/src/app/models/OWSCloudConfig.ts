import { OWSSample } from "../models/OWSSample";
import { Md5 } from "ts-md5";

export class OWSCloudConfig {
    public type: string = "main";
    public enabled: boolean = false;
    public preventLieFi: boolean = false;
    public sendFieldsWithNullValues: boolean = true;
    public retryUnsentSamples: boolean = true;
    public sendHashUidPasswordCreatedAt: boolean = false;
    public service: string = "custom";
    public url: string = "";
    public send_payload_as_array: boolean = false;
    public append_password_to_url: boolean = false;
    public method: string = "post";
    public success: string = "data";
    public success_code: string = "200";
    public success_custom_code: string = "200";
    public success_data: string = "ok";
    public success_custom_data: string = "ok";

    public fields: any = {
        station_id: {
            send: true,
            override: "station_id",
            format: null,
            value: null
        },
        password: {
            send: true,
            override: "password",
            format: null,
            value: null
        },
        custom_1: {
            send: false,
            override: "custom_1",
            format: null,
            value: null
        },
        custom_2: {
            send: false,
            override: "custom_2",
            format: null,
            value: null
        },
        battery_level: {
            send: true,
            override: "battery_level",
            format: null
        },
        battery_is_plugged: {
            send: true,
            override: "is_plugged",
            format: null
        },
        created_at_utc: {
            send: true,
            override: "created_at",
            format: "local"
        },
        wind: {
            send: true,
            override: "wind",
            format: "mtsph"
        },
        gust: {
            send: true,
            override: "gust",
            format: "mtsph"
        },
        wind_angle: {
            send: true,
            override: "wind_angle",
            format: null
        },
        gust_angle: {
            send: true,
            override: "gust_angle",
            format: null
        },
        rain: {
            send: true,
            override: "rain",
            format: "mm"
        },
        rain_hour: {
            send: true,
            override: "rain_hour",
            format: "mm"
        },
        temperature: {
            send: true,
            override: "temperature",
            format: "C"
        },
        humidity: {
            send: true,
            override: "humidity",
            format: null
        },
        pressure: {
            send: true,
            override: "pressure",
            format: "Pa"
        },
        relative_pressure: {
            send: true,
            override: "relative_pressure",
            format: "Pa",
            value: 0
        },
        light: {
            send: true,
            override: "light",
            format: null
        }
    };

    constructor(type = "main") {
        this.type = type;
    }

    setFromStoredObj(storedConfig: any) {
        this.type = storedConfig.type;
        this.enabled = storedConfig.enabled ? true : false;
        this.preventLieFi = storedConfig.preventLieFi ? true : false;
        this.sendFieldsWithNullValues = storedConfig.sendFieldsWithNullValues ? true : false;
        this.service = storedConfig.service;
        this.url = storedConfig.url;
        this.send_payload_as_array = storedConfig.send_payload_as_array ? true : false;
        this.append_password_to_url = storedConfig.append_password_to_url ? true : false;
        this.retryUnsentSamples = storedConfig.retryUnsentSamples ? true : false;
        this.sendHashUidPasswordCreatedAt = storedConfig.sendHashUidPasswordCreatedAt ? true : false;
        this.method = storedConfig.method;
        this.success = storedConfig.success;
        this.success_code = storedConfig.success_code;
        this.success_custom_code = storedConfig.success_custom_code;
        this.success_data = storedConfig.success_data;
        this.success_custom_data = storedConfig.success_custom_data;
        this.fields = storedConfig.fields;
    }

    getUrl(): string {
        if (this.append_password_to_url && this.method != "get") {
            return this.url + "?" + this.fields.password.override + "=" + this.fields.password.value;
        }
        return this.url;
    }

    generatePayload(sample: OWSSample, battery: any): any {
        try {
            let payload: any = {};
            let sampleFields = ["created_at_utc", "wind", "wind_angle", "gust", "gust_angle", "rain", "rain_hour", "temperature", "pressure", "light", "humidity"];
            if (this.fields.station_id.send) {
                payload[this.fields.station_id.override ? this.fields.station_id.override : "station_id"] = this.fields.station_id.value;
            }
            if (this.fields.password.send && !this.append_password_to_url) {
                payload[this.fields.password.override ? this.fields.password.override : "password"] = this.fields.password.value;
            }
            if (this.fields.custom_1.send) {
                payload[this.fields.custom_1.override ? this.fields.custom_1.override : "custom_1"] = this.fields.custom_1.value;
            }
            if (this.fields.custom_2.send) {
                payload[this.fields.custom_2.override ? this.fields.custom_2.override : "custom_2"] = this.fields.custom_2.value;
            }
            if (this.fields.battery_level.send) {
                payload[this.fields.battery_level.override ? this.fields.battery_level.override : "battery_level"] = battery.level;
            }
            if (this.fields.battery_is_plugged.send) {
                payload[this.fields.battery_is_plugged.override ? this.fields.battery_is_plugged.override : "battery_is_plugged"] = battery.isPlugged;
            }
            if (this.fields.relative_pressure.send) {
                payload[this.fields.relative_pressure.override ? this.fields.relative_pressure.override : "relative_pressure"] = sample.getRelativePressure(this.fields.relative_pressure.value, this.fields.relative_pressure.format);
            }

            for (let i = 0; i < sampleFields.length; i++) {
                let sampleField = sampleFields[i];
                if (this.fields[sampleField].send && (this.sendFieldsWithNullValues || sample.getPropertyByName(sampleField) != null)) {
                    let payloadFieldName = this.fields[sampleField].override ? this.fields[sampleField].override : sampleField;
                    payload[payloadFieldName] = sample.getPropertyByName(sampleField, this.fields[sampleField].format);
                }
            }

            if (this.sendHashUidPasswordCreatedAt) {
                try {
                    payload["hash"] = Md5.hashStr("" + sample.getPropertyByName("created_at_utc", "unix") + this.fields.station_id.value + this.fields.password.value);
                } catch (e) {
                    payload["hash"] = "error-computing-hash";
                }
            }

            if (this.send_payload_as_array) {
                return [payload];
            }
            return payload;
        }
        catch (e) {
            console.log("cat", e);
            return false;
        }
    }

    isSuccessResponse(response: any): boolean {
        let success = false;
        if (this.success == "code" && this.success_code == "200" && response.status == 200) {
            success = true;
        }
        if (this.success == "code" && this.success_code == "custom" && response.status == parseInt(this.success_custom_code)) {
            success = true;
        }
        if (this.success == "data" && this.success_data != "custom" && this.success_data != "any" && this.success_data != "non_zero" && response.text().indexOf(this.success_data) >= 0) {
            success = true;
        }
        if (this.success == "data" && this.success_data == "any" && response.text().length > 0) {
            success = true;
        }
        if (this.success == "data" && this.success_data == "non_zero" && response.text() != "0") {
            success = true;
        }
        if (this.success == "data" && this.success_data == "custom" && response.text().indexOf(this.success_custom_data) >= 0) {
            success = true;
        }
        return success;

    }

    public setServiceDefaults() {
        switch (this.service) {
            case "wunderground":
                this.send_payload_as_array = false;
                this.append_password_to_url = false;
                this.url = "https://weatherstation.wunderground.com/weatherstation/updateweatherstation.php";
                this.method = "get";
                this.success = "data";
                this.success_data = "success";
                this.sendFieldsWithNullValues = true;
                this.retryUnsentSamples = false;
                this.sendHashUidPasswordCreatedAt = false;

                this.fields.station_id.send = true;
                this.fields.station_id.override = "ID";

                this.fields.password.send = true;
                this.fields.password.override = "PASSWORD";

                this.fields.custom_1.send = true;
                this.fields.custom_1.override = "action";
                this.fields.custom_1.value = "updateraw";

                this.fields.custom_2.send = false;

                this.fields.battery_level.send = false;
                this.fields.battery_is_plugged.send = false;

                this.fields.created_at_utc.send = true;
                this.fields.created_at_utc.override = "dateutc";
                this.fields.created_at_utc.format = "utc";

                this.fields.wind.send = true;
                this.fields.wind.override = "windspeedmph";
                this.fields.wind.format = "mph";

                this.fields.gust.send = true;
                this.fields.gust.override = "windgustmph";
                this.fields.gust.format = "mph";

                this.fields.wind_angle.send = true;
                this.fields.wind_angle.override = "winddir";


                this.fields.gust_angle.send = true;
                this.fields.gust_angle.override = "windgustdir";

                this.fields.rain.send = false;

                this.fields.rain_hour.send = true;
                this.fields.rain_hour.override = "rainin";
                this.fields.rain_hour.format = "in";

                this.fields.temperature.send = true;
                this.fields.temperature.override = "tempf";
                this.fields.temperature.format = "F";

                this.fields.humidity.send = true;
                this.fields.humidity.override = "humidity";

                this.fields.pressure.send = false;

                this.fields.relative_pressure.send = true;
                this.fields.relative_pressure.override = "baromin";
                this.fields.relative_pressure.format = "inHg";
                this.fields.relative_pressure.value = 0;

                this.fields.light.send = false;
                break;

            case "thingspeak":

                this.send_payload_as_array = false;
                this.append_password_to_url = false;
                this.url = "https://api.thingspeak.com/update.json";
                this.method = "post_json";
                this.success = "data";
                this.success_data = "non_zero";
                this.sendFieldsWithNullValues = true;
                this.retryUnsentSamples = false;
                this.sendHashUidPasswordCreatedAt = false;

                this.fields.station_id.send = false;

                this.fields.password.send = true;
                this.fields.password.override = "api_key";

                this.fields.custom_1.send = false;
                this.fields.custom_2.send = false;

                this.fields.battery_level.send = false;
                this.fields.battery_is_plugged.send = false;

                this.fields.created_at_utc.send = true;
                this.fields.created_at_utc.override = "created_at";
                this.fields.created_at_utc.format = "utc";

                this.fields.wind.send = true;
                this.fields.wind.override = "field1";
                this.fields.wind.format = "kmph";

                this.fields.gust.send = true;
                this.fields.gust.override = "field2";
                this.fields.gust.format = "kmph";

                this.fields.wind_angle.send = true;
                this.fields.wind_angle.override = "field3";


                this.fields.gust_angle.send = true;
                this.fields.gust_angle.override = "field4";

                this.fields.rain.send = true;
                this.fields.rain.override = "field5";
                this.fields.rain.format = "mm";

                this.fields.rain_hour.send = false;

                this.fields.temperature.send = true;
                this.fields.temperature.override = "field6";
                this.fields.temperature.format = "C";

                this.fields.humidity.send = true;
                this.fields.humidity.override = "field7";

                this.fields.pressure.send = false;

                this.fields.relative_pressure.send = true;
                this.fields.relative_pressure.override = "field8";
                this.fields.relative_pressure.format = "hPa";
                this.fields.relative_pressure.value = 0;

                this.fields.light.send = false;

                break;

            case "openweathermap":

                this.send_payload_as_array = true;
                this.append_password_to_url = true;
                this.url = "http://api.openweathermap.org/data/3.0/measurements";
                this.method = "post_json";
                this.success = "code";
                this.success_code = "custom";
                this.success_custom_code = "204";
                this.sendFieldsWithNullValues = true;
                this.retryUnsentSamples = false;
                this.sendHashUidPasswordCreatedAt = false;

                this.fields.station_id.send = true;
                this.fields.station_id.override = "station_id";

                this.fields.password.send = true;
                this.fields.password.override = "appid";

                this.fields.custom_1.send = false;
                this.fields.custom_2.send = false;

                this.fields.battery_level.send = false;
                this.fields.battery_is_plugged.send = false;

                this.fields.created_at_utc.send = true;
                this.fields.created_at_utc.override = "dt";
                this.fields.created_at_utc.format = "unix";

                this.fields.wind.send = true;
                this.fields.wind.override = "wind_speed";
                this.fields.wind.format = "mtsps";

                this.fields.gust.send = true;
                this.fields.gust.override = "wind_gust";
                this.fields.gust.format = "mtsps";

                this.fields.wind_angle.send = true;
                this.fields.wind_angle.override = "wind_deg";

                this.fields.gust_angle.send = false;

                this.fields.rain.send = false;

                this.fields.rain_hour.send = true;
                this.fields.rain_hour.override = "rain_1h";
                this.fields.rain_hour.format = "mm";

                this.fields.temperature.send = true;
                this.fields.temperature.override = "temperature";
                this.fields.temperature.format = "C";

                this.fields.humidity.send = true;
                this.fields.humidity.override = "humidity";

                this.fields.pressure.send = true;
                this.fields.pressure.override = "pressure";
                this.fields.pressure.format = "hPa";

                this.fields.relative_pressure.send = false;

                this.fields.light.send = false;

                break;
            case "windguru":
                this.send_payload_as_array = false;
                this.append_password_to_url = false;
                this.url = "http://www.windguru.cz/upload/api.php";
                this.method = "get";
                this.success = "data";
                this.success_data = "custom";
                this.success_custom_data = "OK";
                this.sendFieldsWithNullValues = false;
                this.retryUnsentSamples = false;
                this.sendHashUidPasswordCreatedAt = true;

                this.fields.station_id.send = true;
                this.fields.station_id.override = "uid";

                this.fields.password.send = true;
                this.fields.password.override = "special_api_password";

                this.fields.custom_1.send = true;
                this.fields.custom_1.override = "interval";
                this.fields.custom_1.value = 60;

                this.fields.custom_2.send = false;

                this.fields.battery_level.send = false;
                this.fields.battery_is_plugged.send = false;

                this.fields.created_at_utc.send = true;
                this.fields.created_at_utc.override = "salt";
                this.fields.created_at_utc.format = "unix";

                this.fields.wind.send = true;
                this.fields.wind.override = "wind_avg";
                this.fields.wind.format = "knts";

                this.fields.gust.send = true;
                this.fields.gust.override = "wind_max";
                this.fields.gust.format = "knts";

                this.fields.wind_angle.send = true;
                this.fields.wind_angle.override = "wind_direction";

                this.fields.gust_angle.send = false;

                this.fields.rain.send = false;

                this.fields.rain_hour.send = true;
                this.fields.rain_hour.override = "precip";
                this.fields.rain_hour.format = "mm";

                this.fields.temperature.send = true;
                this.fields.temperature.override = "temperature";
                this.fields.temperature.format = "C";

                this.fields.humidity.send = true;
                this.fields.humidity.override = "rh";

                this.fields.pressure.send = false;

                this.fields.relative_pressure.send = true;
                this.fields.relative_pressure.override = "mslp";
                this.fields.relative_pressure.format = "hPa";

                this.fields.light.send = false;

                break;
        }
    }

}