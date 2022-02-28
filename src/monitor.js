const axios = require('axios');
const {select, insert, _delete} = require('./database.js');

const fillMonitorHeartBeats = async (monitor) => {
    await new Promise((resolve, reject) => {
        select(`SELECT * FROM monitor_heart_beats WHERE monitor_id = ? ORDER BY id DESC;`, [monitor.id]).then((heartBeats) => {
            monitor.heart_beats = heartBeats;
            monitor.last_heart_beat = heartBeats[0];
            select(`SELECT * FROM monitor_failures WHERE monitor_id = ?;`, [monitor.id]).then((failures) => {
                monitor.failures = failures;
                resolve();
            }).catch(reject);
        }).catch(reject);
    });
    return monitor;
};

const getMonitors = async () => {
    const sql = 'SELECT * FROM monitors;';
    const params = [];
    const rows = await select(sql, params);
    const promises = [];
    rows.forEach((row) => {
        const promise = fillMonitorHeartBeats(row);
        promises.push(promise);
    });
    await Promise.all(promises);
    return rows;
};

const getResponseTime = (startTime) => {
    return Math.max(0, Math.round((new Date()).getTime() - startTime.getTime()));
}

const runMonitor = async (monitor, callbackSuccess, callbackError) => {
    console.log('Garbage monitor data...');
    await garbageMonitorData();

    const startTime = new Date();
    try {
        const response = await axios.call(monitor.method, monitor.url, {
            maxRedirects: monitor.max_redirects,
            validateStatus: (status) => {
                return status >= monitor.min_acceptable_status_code && status <= monitor.max_acceptable_status_code;
            },
            headers: monitor.headers && monitor.headers.length ? JSON.parse(monitor.headers) : {},
            data: monitor.body && monitor.body.length ? JSON.parse(monitor.body) : {},
        });
        await insert('monitor_heart_beats', {
            monitor_id: monitor.id,
            status_code: response.status,
            response_time: getResponseTime(startTime),
        });
        await fillMonitorHeartBeats(monitor);
        callbackSuccess(monitor);
    } catch (error) { 
        if (error.isAxiosError) {       
            await insert('monitor_failures', {
                monitor_id: monitor.id,
                status_code: error.response && error.response.status,
                response_time: getResponseTime(startTime),
            });
            await fillMonitorHeartBeats(monitor);
        }
        callbackError(monitor, error);
    }
};

const runMonitors = async (monitors, callbackSuccess, callbackError) => {
    const intervalIds = [];
    monitors.forEach((monitor) => {
        const intervalId = setInterval(async () => {
            await runMonitor(monitor, callbackSuccess, callbackError);
        }, monitor.heart_beat_interval * 1000);
        intervalIds.push(intervalId);
    });
    return intervalIds;
};

const stopMonitors = (intervalIds) => {
    intervalIds.forEach((intervalId) => {
        clearInterval(intervalId);
    });
};

const dateToDateTimeString = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    
    const Ymd = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const His = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${Ymd} ${His}`;
};

const garbageMonitorData = async () => {
    const monitors = await getMonitors();
    const promises = [];
    monitors.forEach(monitor => {
        const last_heart_beat = monitor.last_heart_beat;
        const keep_data_for_days = monitor.keep_data_for_days;
        if (!last_heart_beat || !keep_data_for_days) {
            return;
        }
        const deleteAfter = new Date((new Date()).getTime() - (keep_data_for_days * 24 * 60 * 60 * 1000));
        const deleteAfterString = dateToDateTimeString(deleteAfter);

            const promise = new Promise((resolve, reject) => {
                Promise.all([
                    new Promise((res, rej) => {
                        select('SELECT id FROM monitor_heart_beats WHERE monitor_id = ? AND created_at < ?;', [monitor.id, deleteAfterString]).then(idsToDelete => {
                            if (idsToDelete.length !== 0) {
                                console.log(`Deleting ${idsToDelete.length} monitor_heart_beats for monitor ${monitor.id}...`);
                                _delete('monitor_heart_beats', idsToDelete.map(id => id.id)).then(res).catch(rej);
                                return;
                            }
                            res();
                        }).catch(rej);
                    }),
                    new Promise((res, rej) => {
                        select('SELECT id FROM monitor_failures WHERE monitor_id = ? AND created_at < ?;', [monitor.id, deleteAfterString]).then(idsToDelete => {
                            if (idsToDelete.length !== 0) {
                                console.log(`Deleting ${idsToDelete.length} monitor_failures for monitor ${monitor.id}...`);
                                _delete('monitor_failures', idsToDelete.map(id => id.id)).then(res).catch(rej);
                                return;
                            }
                            res();
                        }).catch(rej);
                    }),
                ]).then(resolve).catch(reject);
            });
            promises.push(promise);
    });
    await Promise.all(promises);
};

module.exports = {
    getMonitors,
    runMonitors,
    stopMonitors,
    garbageMonitorData,
};