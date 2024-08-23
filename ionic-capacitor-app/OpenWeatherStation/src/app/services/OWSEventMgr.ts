import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { OWSEventsTypes } from './OWSEventsTypes';

@Injectable({
    providedIn: 'root'
})
export class OWSEventMgr {

    constructor() { }

    private static channels: any = {};

    static send(eventType: string, payload: any = null, logEvent: boolean = false) {
        if (typeof OWSEventsTypes[eventType] == 'undefined') {
            console.error("The event type " + eventType + " is not recognized");
            return;
        }
        if (typeof OWSEventMgr.channels[eventType] == 'undefined') {
            OWSEventMgr.channels[eventType] = new Subject<any>();
        }
        if (logEvent) {
            console.log("Firing event: " + eventType, payload);
        }
        OWSEventMgr.channels[eventType].next(payload);

    }

    static listen(eventType: string): Observable<any> | null {
        if (typeof OWSEventsTypes[eventType] == 'undefined') {
            console.error("The event type " + eventType + " is not recognized");
            //return an observable that throws an error
            return new Observable<any>(observer => {
                observer.error("The event type " + eventType + " is not recognized");
            });
        }
        if (typeof OWSEventMgr.channels[eventType] == 'undefined') {
            OWSEventMgr.channels[eventType] = new Subject<any>();
        }
        return OWSEventMgr.channels[eventType].asObservable();
    }

}
