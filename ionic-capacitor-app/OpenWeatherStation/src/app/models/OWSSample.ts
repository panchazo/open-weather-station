import * as moment from 'moment';

export class OWSSample {
    public id: string | null = null;
    public wind: number | null = null;
    public wind_angle: number | null = null;
    public gust: number | null = null;
    public gust_angle: number | null = null;
    public rain: number | null = null;
    public rain_hour: number | null = null;
    public temperature: number | null = null;
    public pressure: number | null = null;
    public humidity: number | null = null;
    public light: number | null = null;
    public ms: number | null = null;
    public created_at_utc: string | null = null;
    public created_at_local: string | null = null;
    public device_address: string | null = null;
    public uploaded_on_main: string | null = null;
    public uploaded_on_secondary: string | null = null;


    constructor(
        wind: number | null = null,
        wind_angle: number | null = null,
        gust: number | null = null,
        gust_angle: number | null = null,
        rain: number | null = null,
        rain_hour: number | null = null,
        temperature: number | null = null,
        pressure: number | null = null,
        humidity: number | null = null,
        light: number | null = null,
        ms: number | null = null,
        device_address: string | null = null,
        id: string | null = null,
        created_at_utc: string | null = null,
        created_at_local: string | null = null,
        uploaded_on_main: string | null = null,
        uploaded_on_secondary: string | null = null
    ) {
        this.id = id;
        this.wind = wind;
        this.wind_angle = wind_angle;
        this.gust = gust;
        this.gust_angle = gust_angle;
        this.rain = rain;
        this.rain_hour = rain_hour;
        this.temperature = temperature == -500 ? null : temperature;
        this.pressure = pressure == -500 ? null : pressure;
        this.humidity = humidity == -500 ? null : humidity;
        this.light = light == -500 ? null : light;
        this.ms = ms;
        this.device_address = device_address;
        this.created_at_utc = created_at_utc ? created_at_utc : moment.utc().format("YYYY-MM-DD HH:mm:ss");
        this.created_at_local = created_at_local ? created_at_local : moment().format("YYYY-MM-DD HH:mm:ss");
        this.uploaded_on_main = uploaded_on_main;
        this.uploaded_on_secondary = uploaded_on_secondary;
    }

    setFromDbItem(item: any): void {
        if (!item) {
            return;
        }
        this.id = item.id;
        this.wind = item.wind;
        this.wind_angle = item.wind_angle;
        this.gust = item.gust;
        this.gust_angle = item.gust_angle;
        this.rain = item.rain;
        this.rain_hour = item.rain_hour;
        this.temperature = item.temperature;
        this.pressure = item.pressure;
        this.humidity = item.humidity;
        this.light = item.light;
        this.ms = item.ms;
        this.device_address = item.device_address;
        this.created_at_utc = item.created_at_utc;
        this.created_at_local = item.created_at_local;
        this.uploaded_on_main = item.uploaded_on_main;
        this.uploaded_on_secondary = item.uploaded_on_secondary;
    }

    setFromOWSPayload(data: any, device: any): void {
        try {
            this.wind = data.ws;
            this.wind_angle = data.wa;
            this.gust = data.gs;
            this.gust_angle = data.ga;
            this.rain = data.rmm;
            this.temperature = data.t == -500 ? null : data.t;
            this.pressure = data.p == -500 ? null : data.p;
            this.humidity = data.h == -500 ? null : data.h;
            this.light = data.l == -500 ? null : data.l;
            this.ms = data.ms;
            this.device_address = device.address;
            this.created_at_utc = moment.utc().format("YYYY-MM-DD HH:mm:ss");
            this.created_at_local = moment().format("YYYY-MM-DD HH:mm:ss");
        } catch (e) {
            console.log("parseOWSPayload", e)
        }
    }

    getPropertyByName(property: string, format: string | null = null): any | string | number | null {
        if (format) {
            switch (property) {
                case "wind":
                    return this.convertWindSpeed(this[property], format);
                case "gust":
                    return this.convertWindSpeed(this[property], format);
                case "rain":
                    return this.convertRain(this[property], format);
                case "rain_hour":
                    return this.convertRain(this[property], format);
                case "temperature":
                    return this.convertTemperature(this[property], format);
                case "pressure":
                    return this.convertPressure(this[property], format);
                case "created_at_utc":
                    switch (format) {
                        case "local": return this["created_at_local"];
                        case "unix": return parseInt(moment.utc(this["created_at_utc"]).format("X"));
                        case "utc": return this["created_at_utc"];
                    }
            }
        }
        //get the property value of this
        return (this as any)[property];
    }


    public getRelativePressure(altitudeMts: number, format: string = "Pa") {
        return this.calculateSeaLevelPressure(altitudeMts ? altitudeMts : 0, this.getPropertyByName("temperature", "C"), this.getPropertyByName("pressure", "Pa"), format);
    }

    private convertWindSpeed(value: number | null, format: string | null = null) {
        if (value == null) {
            return null;
        }
        let factor = 1;
        let precision = 2;
        switch (format) {
            case "mtsph":
                factor = 60 * 60;
                break;
            case "mtsps":
                factor = 1;
                break;
            case "kmph":
                factor = 60 * 60 / 1000;
                break;
            case "mph":
                factor = 0.621371 * 60 * 60 / 1000;
                break;
            case "knts":
                factor = 0.539957 * 60 * 60 / 1000;
                break;
        }
        return this.round(value * factor, precision);
    }

    private convertRain(value: number | null, format: string | null = null) {
        if (value == null) {
            return null;
        }
        let factor = 1;
        let precision = 3;
        switch (format) {
            case "mm":
                factor = 1;
                break;
            case "in":
                factor = 0.03937007874;
                break;
        }
        return this.round(value * factor, precision);
    }

    private convertTemperature(value: number | null, format: string | null = null) {
        if (value == null) {
            return null;
        }
        let precision = 1;
        switch (format) {
            case "C":
                return this.round(value, precision);
            case "F":
                return this.round(value * 1.8 + 32, precision);
        }
        return value;
    }

    private convertPressure(value: number | null, format: string | null = null) {
        if (value == null) {
            return null;
        }
        let factor = 1;
        let precision = 0;
        switch (format) {
            case "Pa":
                factor = 1;
                precision = 0;
                break;
            case "hPa":
                factor = 1 / 100;
                precision = 2;
                break;
            case "kPa":
                factor = 1 / 1000;
                precision = 3;
                break;
            case "inHg":
                factor = 0.00029529983071445;
                precision = 4;
                break;
            case "mmHg":
                factor = 0.0075006156130264;
                precision = 4;
                break;
        }
        return this.round(value * factor, precision);
    }


    private calculateSeaLevelPressure(altitudeMts: number, tempC: number, pressurePa: number, returnFormat: string = "Pa") {
        let relPres: any = null;
        try {
            relPres = this.convertPressure((pressurePa / Math.pow(1 - ((0.0065 * altitudeMts) / (tempC + (0.0065 * altitudeMts) + 273.15)), 5.257)), returnFormat);
        } catch (e) { }
        return relPres;
    }

    private round(num: number, precision: number = 2) {
        if (!precision) {
            return num;
        }
        return Math.round(num * Math.pow(10, precision)) / Math.pow(10, precision);
    }
}