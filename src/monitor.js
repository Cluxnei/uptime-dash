const axios = require('axios');
const {select, insert} = require('./database.js');

const getMonitors = async () => {
    const sql = 'SELECT * FROM monitors;';
    const params = [];
    const rows = await select(sql, params);
    const promises = [];
    rows.forEach((row, index) => {
        const promise = new Promise((resolve, reject) => {
            select(`SELECT * FROM monitor_heart_beats WHERE monitor_id = ?;`, [row.id]).then((heartBeats) => {
                rows[index].heart_beats = heartBeats;
                select(`SELECT * FROM monitor_failures WHERE monitor_id = ?;`, [row.id]).then((failures) => {
                    rows[index].failures = failures;
                    resolve();
                }).catch(reject);
            }).catch(reject);
        });
        promises.push(promise);
    });
    await Promise.all(promises);
    console.log(rows);
    return rows;
};

const getResponseTime = (startTime) => {
    return Math.max(0, Math.round((new Date()).getTime() - startTime.getTime()));
}

const runMonitor = async (monitor, callbackSuccess, callbackError) => {
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
        callbackSuccess(monitor);
    } catch (error) { 
        if (error.isAxiosError) {       
            await insert('monitor_failures', {
                monitor_id: monitor.id,
                status_code: error.response && error.response.status,
                response_time: getResponseTime(startTime),
            });
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

module.exports = {
    getMonitors,
    runMonitors,
    stopMonitors,
};