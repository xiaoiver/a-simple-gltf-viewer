import { register } from 'register-service-worker';

const BASE_URL = '/a-simple-gltf-viewer';

// polyfill the CustomEvent in ie9/10/11
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent#Polyfill
(function () {
    // @ts-ignore
    if (typeof window.CustomEvent === 'function') return false;

    function CustomEvent(event: string, params: any) {
        params = params || { bubbles: false, cancelable: false, detail: undefined };
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(
            event,
            params.bubbles,
            params.cancelable,
            params.detail,
        );
        return evt;
    }

    // @ts-ignore
    CustomEvent.prototype = window.Event.prototype;
    // @ts-ignore
    window.CustomEvent = CustomEvent;
})();

function dispatchServiceWorkerEvent(eventName: string, eventData: any) {
    const event = new CustomEvent(eventName, { detail: eventData });
    window.dispatchEvent(event);
}

export default function () {
    register(`${BASE_URL}/service-worker.js`, {
        updated(registration) {
            dispatchServiceWorkerEvent('sw.updated', registration);
        },

        offline() {
            dispatchServiceWorkerEvent('sw.offline', {});
        },
    });
}